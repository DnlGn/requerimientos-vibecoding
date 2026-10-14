// Edge Function: analyze-site
// Descarga el HTML de un proyecto y revisa metadata, archivos de posicionamiento
// (robots.txt, sitemap.xml, llms.txt, llms-full.txt, manifest) y señales de calidad.
// El navegador no puede hacer esto directamente por CORS, por eso vive aquí.

import { DOMParser, type Element } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UA =
  "Mozilla/5.0 (compatible; VibeCheckBot/1.0; +https://supabase.com) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

const AI_BOTS = ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-Web", "anthropic-ai", "Google-Extended", "PerplexityBot", "CCBot"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function isPrivateHost(host: string) {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return h === "[::1]";
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

async function timedFetch(url: string, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = performance.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,text/plain,*/*" },
    });
    const ttfb = Math.round(performance.now() - started);
    const text = await res.text();
    return { ok: res.ok, status: res.status, url: res.url, headers: res.headers, text, ttfb, ms: Math.round(performance.now() - started) };
  } finally {
    clearTimeout(t);
  }
}

// Muchos hosts de SPA devuelven index.html para cualquier ruta (status 200).
// Eso NO cuenta como que el archivo existe.
function looksLikeHtml(text: string, contentType: string | null) {
  const head = text.trimStart().slice(0, 200).toLowerCase();
  return (contentType ?? "").includes("text/html") || head.startsWith("<!doctype") || head.startsWith("<html");
}

async function checkTextFile(base: URL, path: string) {
  const target = new URL(path, base).toString();
  try {
    const r = await timedFetch(target, 8000);
    const ct = r.headers.get("content-type");
    const exists = r.ok && r.text.trim().length > 0 && !looksLikeHtml(r.text, ct);
    return {
      url: target,
      exists,
      status: r.status,
      contentType: ct,
      bytes: exists ? new TextEncoder().encode(r.text).length : 0,
      lines: exists ? r.text.split("\n").length : 0,
      preview: exists ? r.text.slice(0, 1200) : null,
      spaFallback: r.ok && !exists && looksLikeHtml(r.text, ct),
      _text: exists ? r.text : "",
    };
  } catch (e) {
    return { url: target, exists: false, status: 0, error: String(e), _text: "" };
  }
}

function analyzeRobots(text: string) {
  if (!text) return null;
  const lines = text.split("\n").map((l) => l.split("#")[0].trim()).filter(Boolean);
  let agents: string[] = [];
  let lastWasAgent = false;
  const groups: { agents: string[]; disallow: string[]; allow: string[] }[] = [];
  const sitemaps: string[] = [];
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!lastWasAgent) {
        agents = [];
        groups.push({ agents, disallow: [], allow: [] });
      }
      agents.push(val);
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      const g = groups[groups.length - 1];
      if (key === "sitemap") sitemaps.push(val);
      else if (g && key === "disallow") g.disallow.push(val);
      else if (g && key === "allow") g.allow.push(val);
    }
  }
  const blocks = (agent: string) =>
    groups.some((g) => g.agents.some((a) => a.toLowerCase() === agent.toLowerCase()) && g.disallow.includes("/"));
  const blocksAll = blocks("*");
  const blockedAiBots = AI_BOTS.filter((b) => blocks(b) || (blocksAll && !groups.some((g) => g.agents.some((a) => a.toLowerCase() === b.toLowerCase()))));
  return {
    blocksAll,
    sitemaps,
    mentionedAiBots: AI_BOTS.filter((b) => text.toLowerCase().includes(b.toLowerCase())),
    blockedAiBots,
  };
}

function maskKey(k: string) {
  return k.slice(0, 6) + "…" + k.slice(-4);
}

// verify_jwt también deja pasar la anon key (que es pública), así que además
// confirmamos que el token pertenece a un usuario con sesión iniciada.
async function isSignedIn(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!auth.startsWith("Bearer ") || !url || !anon) return false;
  const res = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: auth, apikey: anon } });
  if (!res.ok) return false;
  const user = await res.json().catch(() => null);
  return Boolean(user?.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  if (!(await isSignedIn(req))) return json({ error: "Debes iniciar sesión para analizar sitios" }, 401);

  let input: { url?: string };
  try {
    input = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  let target: URL;
  try {
    const raw = (input.url ?? "").trim();
    target = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return json({ error: "URL inválida" }, 400);
  }
  if (!["http:", "https:"].includes(target.protocol) || isPrivateHost(target.hostname)) {
    return json({ error: "Solo se permiten URLs públicas http(s)" }, 400);
  }

  let page;
  try {
    page = await timedFetch(target.toString(), 15000);
  } catch (e) {
    return json({ error: `No se pudo acceder a la página: ${String(e)}` }, 502);
  }

  const finalUrl = new URL(page.url || target.toString());
  const origin = new URL(finalUrl.origin + "/");
  const html = page.text;
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return json({ error: "No se pudo interpretar el HTML" }, 500);

  const meta = (sel: string) => doc.querySelector(sel)?.getAttribute("content")?.trim() || null;
  const link = (sel: string) => {
    const href = doc.querySelector(sel)?.getAttribute("href");
    if (!href) return null;
    try {
      return new URL(href, finalUrl).toString();
    } catch {
      return href;
    }
  };

  // --- Metadata ---
  const title = doc.querySelector("title")?.textContent?.trim() || null;
  const og = {
    title: meta('meta[property="og:title"]'),
    description: meta('meta[property="og:description"]'),
    image: meta('meta[property="og:image"]'),
    url: meta('meta[property="og:url"]'),
    type: meta('meta[property="og:type"]'),
    siteName: meta('meta[property="og:site_name"]'),
    locale: meta('meta[property="og:locale"]'),
  };
  const twitter = {
    card: meta('meta[name="twitter:card"]'),
    title: meta('meta[name="twitter:title"]'),
    description: meta('meta[name="twitter:description"]'),
    image: meta('meta[name="twitter:image"]'),
  };
  const jsonLd = (Array.from(doc.querySelectorAll('script[type="application/ld+json"]')) as Element[]).map((s) => {
    try {
      const data = JSON.parse(s.textContent || "");
      const items = Array.isArray(data) ? data : data["@graph"] ?? [data];
      return items.map((i: Record<string, unknown>) => i["@type"]).flat().filter(Boolean);
    } catch {
      return ["(JSON inválido)"];
    }
  }).flat();

  // --- Estructura y contenido ---
  const body = doc.querySelector("body");
  const bodyClone = body?.cloneNode(true) as typeof body;
  bodyClone?.querySelectorAll("script, style, noscript, template").forEach((n) => (n as unknown as { remove(): void }).remove());
  const visibleText = (bodyClone?.textContent || "").replace(/\s+/g, " ").trim();
  const headings = {
    h1: (Array.from(doc.querySelectorAll("h1")) as Element[]).map((h) => h.textContent.trim()).slice(0, 5),
    h2: doc.querySelectorAll("h2").length,
    h3: doc.querySelectorAll("h3").length,
  };
  const imgs = (Array.from(doc.querySelectorAll("img")) as Element[]);
  const images = {
    total: imgs.length,
    missingAlt: imgs.filter((i) => !i.hasAttribute("alt")).length,
    lazy: imgs.filter((i) => i.getAttribute("loading") === "lazy").length,
    withoutDimensions: imgs.filter((i) => !i.getAttribute("width") || !i.getAttribute("height")).length,
  };
  const semantic = ["header", "nav", "main", "footer", "article", "section"].filter((t) => doc.querySelector(t));

  // --- Scripts y señales típicas de proyectos de Google AI Studio ---
  const scripts = (Array.from(doc.querySelectorAll("script")) as Element[]);
  const externalScripts = scripts.map((s) => s.getAttribute("src")).filter(Boolean) as string[];
  const tailwindCdn = externalScripts.some((s) => s.includes("cdn.tailwindcss.com"));
  const importMap = doc.querySelector('script[type="importmap"]');
  const importMapHosts = importMap
    ? [...new Set(((importMap.textContent || "").match(/https?:\/\/[^/"']+/g) || []).map((u) => new URL(u).host))]
    : [];
  const babelStandalone = externalScripts.some((s) => /babel(\.min)?\.js|@babel\/standalone/.test(s));
  const isSpaShell = visibleText.length < 120 && !!doc.querySelector("#root, #app, #__next");
  const noscript = !!doc.querySelector("noscript");

  // Busca API keys de Google (AIza...) en el HTML y en los bundles JS propios.
  const keyRegex = /AIza[0-9A-Za-z_-]{35}/g;
  const foundKeys = new Set<string>((html.match(keyRegex) || []));
  const ownBundles = externalScripts
    .map((s) => { try { return new URL(s, finalUrl); } catch { return null; } })
    .filter((u): u is URL => !!u && u.origin === finalUrl.origin)
    .slice(0, 4);
  let jsBytes = 0;
  await Promise.all(ownBundles.map(async (u) => {
    try {
      const r = await timedFetch(u.toString(), 8000);
      jsBytes += new TextEncoder().encode(r.text).length;
      (r.text.match(keyRegex) || []).forEach((k) => foundKeys.add(k));
      if (/process\.env\.(GEMINI_)?API_KEY|GEMINI_API_KEY/.test(r.text) && /generativelanguage|GoogleGenAI|@google\/genai/.test(r.text)) {
        foundKeys.add("__gemini_client_usage__");
      }
    } catch { /* ignorar bundle inaccesible */ }
  }));
  const exposedKeys = [...foundKeys].filter((k) => k.startsWith("AIza")).map(maskKey);
  const geminiInClient = foundKeys.has("__gemini_client_usage__");

  // --- Archivos de posicionamiento ---
  const [robots, llms, llmsFull] = await Promise.all([
    checkTextFile(origin, "/robots.txt"),
    checkTextFile(origin, "/llms.txt"),
    checkTextFile(origin, "/llms-full.txt"),
  ]);
  // El sitemap puede tener otro nombre (Astro genera /sitemap-index.xml, WordPress /sitemap_index.xml).
  // Primero se usan los declarados en robots.txt y luego los nombres habituales.
  const robotsSitemaps = analyzeRobots(robots._text)?.sitemaps ?? [];
  const sitemapCandidates = [...new Set([...robotsSitemaps, "/sitemap.xml", "/sitemap-index.xml", "/sitemap_index.xml"])].slice(0, 5);
  let sitemap = await checkTextFile(origin, sitemapCandidates[0]);
  for (const candidate of sitemapCandidates.slice(1)) {
    if (sitemap.exists) break;
    sitemap = await checkTextFile(origin, candidate);
  }
  const manifestHref = link('link[rel="manifest"]');
  const manifest = manifestHref
    ? await checkTextFile(origin, manifestHref)
    : { url: null, exists: false, _text: "" };
  let manifestData: Record<string, unknown> | null = null;
  if (manifest.exists) {
    try {
      const m = JSON.parse(manifest._text);
      manifestData = { name: m.name, short_name: m.short_name, icons: (m.icons || []).length, display: m.display, theme_color: m.theme_color };
    } catch { /* manifest inválido */ }
  }
  const sitemapUrls = sitemap.exists ? (sitemap._text.match(/<loc>/g) || []).length : 0;
  const sitemapIsIndex = sitemap.exists && /<sitemapindex/i.test(sitemap._text);
  const strip = <T extends { _text?: string }>(o: T) => {
    const { _text, ...rest } = o;
    return rest;
  };

  const htmlBytes = new TextEncoder().encode(html);
  const sizeBytes = htmlBytes.length;
  // Huella del HTML: si no cambia entre análisis, el cliente acumula las mediciones de
  // PageSpeed en vez de reemplazarlas (la nota converge en lugar de saltar).
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", htmlBytes));
  const contentHash = Array.from(digest.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");

  return json({
    analyzedAt: new Date().toISOString(),
    contentHash,
    requestedUrl: target.toString(),
    finalUrl: finalUrl.toString(),
    status: page.status,
    https: finalUrl.protocol === "https:",
    timing: { ttfbMs: page.ttfb, totalMs: page.ms },
    response: {
      htmlBytes: sizeBytes,
      cacheControl: page.headers.get("cache-control"),
      server: page.headers.get("server"),
      ownJsBytes: jsBytes,
    },
    meta: {
      title,
      titleLength: title?.length ?? 0,
      description: meta('meta[name="description"]'),
      descriptionLength: meta('meta[name="description"]')?.length ?? 0,
      viewport: meta('meta[name="viewport"]'),
      charset: doc.querySelector("meta[charset]")?.getAttribute("charset") ?? null,
      lang: doc.documentElement?.getAttribute("lang") ?? null,
      canonical: link('link[rel="canonical"]'),
      robots: meta('meta[name="robots"]'),
      themeColor: meta('meta[name="theme-color"]'),
      favicon: link('link[rel~="icon"]'),
      appleTouchIcon: link('link[rel~="apple-touch-icon"]'),
      author: meta('meta[name="author"]'),
      keywords: meta('meta[name="keywords"]'),
      og,
      twitter,
      jsonLd,
    },
    content: {
      visibleTextLength: visibleText.length,
      headings,
      images,
      semantic,
      links: doc.querySelectorAll("a[href]").length,
      isSpaShell,
      noscript,
    },
    tech: {
      externalScripts: externalScripts.slice(0, 20),
      tailwindCdn,
      importMapHosts,
      babelStandalone,
      exposedKeys,
      geminiInClient,
    },
    files: {
      robots: { ...strip(robots), analysis: analyzeRobots(robots._text) },
      sitemap: { ...strip(sitemap), urls: sitemapUrls, isIndex: sitemapIsIndex },
      llms: strip(llms),
      llmsFull: strip(llmsFull),
      manifest: { ...strip(manifest), data: manifestData },
    },
  });
});
