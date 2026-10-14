// Google PageSpeed Insights (Lighthouse 13+) — se llama directo desde el navegador.
import { performanceScore } from './lighthouseScore'

const ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']
// Sitios pesados pueden tardar 2–3 minutos; cortamos antes para no dejar la UI colgada.
const TIMEOUT_MS = 180000

// Auditorías que, si fallan, se listan como oportunidades en el informe.
// Lighthouse 13 reemplazó muchas auditorías por "insights"; se incluyen ambos nombres.
const KEY_AUDITS = [
  'lcp-discovery-insight',
  'lcp-breakdown-insight',
  'render-blocking-insight',
  'render-blocking-resources',
  'image-delivery-insight',
  'modern-image-formats',
  'uses-responsive-images',
  'image-size-responsive',
  'unsized-images',
  'unused-javascript',
  'unused-css-rules',
  'legacy-javascript-insight',
  'duplicated-javascript-insight',
  'font-display-insight',
  'cache-insight',
  'document-latency-insight',
  'cls-culprits-insight',
  'forced-reflow-insight',
  'dom-size-insight',
  'color-contrast',
  'image-alt',
  'button-name',
  'link-name',
  'label',
  'heading-order',
  'target-size',
  'meta-viewport',
  'errors-in-console',
  'is-on-https',
  'meta-description',
  'document-title',
  'html-has-lang',
  'crawlable-anchors',
]

const num = (audit) => (audit && typeof audit.numericValue === 'number' ? audit.numericValue : null)
// Devuelve el score de la primera auditoría aplicable de la lista.
const score = (a, ...ids) => {
  for (const id of ids) {
    const x = a[id]
    if (x && typeof x.score === 'number' && x.scoreDisplayMode !== 'notApplicable') return x.score
  }
  return null
}

// Bytes que se podrían ahorrar optimizando imágenes (los insights de LH13 puntúan casi binario,
// así que el tamaño real del ahorro es mejor señal que el score).
function imageSavingsBytes(a) {
  const insight = a['image-delivery-insight']
  if (insight?.details?.items?.length) return insight.details.items.reduce((n, i) => n + (i.wastedBytes || 0), 0)
  const legacy = a['modern-image-formats'] ?? a['uses-optimized-images']
  return legacy?.details?.overallSavingsBytes ?? null
}

// Checks fallidos del insight de descubrimiento del LCP (p. ej. fetchpriority, lazy-load).
function failedChecks(audit) {
  const out = []
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (typeof node.label === 'string' && node.value === false) out.push(node.label)
    Object.values(node).forEach(walk)
  }
  walk(audit?.details)
  return [...new Set(out)]
}

// Qué elemento es el LCP y en qué fase se pierde el tiempo. Sin esto, un consejo como
// "aplicar fetchpriority" no dice a qué elemento (en móvil suele no ser la imagen hero).
function lcpInfo(a) {
  const items = a['lcp-breakdown-insight']?.details?.items ?? []
  const node = items.find((i) => i.type === 'node') ?? a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node
  const table = items.find((i) => i.type === 'table')?.items ?? []
  const phases = Object.fromEntries(table.filter((p) => p.subpart).map((p) => [p.subpart, p.duration]))
  return {
    element: node ? { label: node.nodeLabel || null, selector: node.selector || null, snippet: node.snippet || null } : null,
    phases: Object.keys(phases).length ? phases : null,
  }
}

function usesCompression(a) {
  const check = a['document-latency-insight']?.details?.items?.usesCompression
  if (typeof check?.value === 'boolean') return check.value
  const legacy = a['uses-text-compression']
  return typeof legacy?.score === 'number' ? legacy.score >= 0.9 : null
}

function fieldData(data) {
  const exp = data.loadingExperience?.metrics ? data.loadingExperience : data.originLoadingExperience
  const m = exp?.metrics
  if (!m) return null
  return {
    scope: exp === data.loadingExperience ? 'page' : 'origin',
    lcp: m.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
    cls: m.CUMULATIVE_LAYOUT_SHIFT_SCORE ? m.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : null,
    inp: m.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
    overall: exp.overall_category ?? null,
  }
}

function summarize(data) {
  const lh = data.lighthouseResult
  const a = lh.audits
  const scores = {}
  for (const c of CATEGORIES) {
    const s = lh.categories[c]?.score
    scores[c] = typeof s === 'number' ? Math.round(s * 100) : null
  }
  const failing = [...new Set(KEY_AUDITS)]
    .map((id) => a[id])
    .filter((x) => x && typeof x.score === 'number' && x.score < 0.9 && x.scoreDisplayMode !== 'notApplicable' && x.scoreDisplayMode !== 'informative')
    .map((x) => ({ id: x.id, title: x.title, score: x.score, display: x.displayValue || failedChecks(x).join(' · ') || null }))

  return {
    fetchedAt: lh.fetchTime,
    lighthouseVersion: lh.lighthouseVersion,
    scores,
    metrics: {
      lcp: num(a['largest-contentful-paint']),
      fcp: num(a['first-contentful-paint']),
      cls: num(a['cumulative-layout-shift']),
      tbt: num(a['total-blocking-time']),
      si: num(a['speed-index']),
      ttfb: num(a['server-response-time']),
    },
    audits: {
      viewport: score(a, 'meta-viewport', 'viewport'),
      colorContrast: score(a, 'color-contrast'),
      imageAlt: score(a, 'image-alt'),
      errorsInConsole: score(a, 'errors-in-console'),
      targetSize: score(a, 'target-size', 'tap-targets'),
      imageDelivery: score(a, 'image-delivery-insight', 'modern-image-formats', 'uses-optimized-images'),
      responsiveImages: score(a, 'image-size-responsive', 'uses-responsive-images'),
      unsizedImages: score(a, 'unsized-images'),
      renderBlocking: score(a, 'render-blocking-insight', 'render-blocking-resources'),
      imageSavingsBytes: imageSavingsBytes(a),
      lcpDiscovery: score(a, 'lcp-discovery-insight'),
      lcpDiscoveryFailed: failedChecks(a['lcp-discovery-insight']),
      lcpElement: lcpInfo(a).element,
      lcpPhases: lcpInfo(a).phases,
      compression: usesCompression(a),
    },
    field: fieldData(data),
    screenshot: a['final-screenshot']?.details?.data ?? null,
    failing,
  }
}

// Lighthouse varía entre ejecuciones y en móvil puede ser bimodal (p. ej. LCP 1,6 s o 5,3 s en
// el mismo sitio sin cambios). Google recomienda la mediana de 5 ejecuciones; escritorio es
// mucho más estable y basta con 3. Se ejecutan en paralelo.
const RUNS = { mobile: 5, desktop: 3 }

// PageSpeed devuelve en caché el último resultado de una URL: sin esto, las "N mediciones"
// serían la misma repetida. Un parámetro único hace que cada una sea independiente.
function bust(url, i) {
  try {
    const u = new URL(url)
    u.searchParams.set('_vc', `${Date.now().toString(36)}${i}`)
    return u.toString()
  } catch {
    return url
  }
}

const median = (values) => {
  const v = values.filter((x) => typeof x === 'number').sort((a, b) => a - b)
  if (!v.length) return null
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

// Máximo de mediciones que se acumulan entre análisis de una misma versión de la página.
const MAX_SAMPLES = 15
const METRIC_KEYS = ['lcp', 'fcp', 'cls', 'tbt', 'si', 'ttfb']

const toSample = (r) => ({ ...Object.fromEntries(METRIC_KEYS.map((k) => [k, r.metrics[k]])), perf: r.scores.performance })

// Medición inestable (bimodal): hay mediciones con LCP bueno (≤ 2,5 s) y otras claramente
// peores, y el grupo minoritario es al menos el 20 % (para no reaccionar a un caso aislado).
function isUnstable(lcps) {
  const v = lcps.filter((x) => typeof x === 'number')
  if (v.length < 2) return false
  const fast = v.filter((x) => x <= 2500).length
  const minority = Math.min(fast, v.length - fast)
  const spreadOk = Math.max(...v) - Math.min(...v) > 1000
  return spreadOk && minority >= Math.max(1, Math.ceil(v.length * 0.2))
}

// Métricas = mediana de cada una; el puntaje de rendimiento se calcula desde esas medianas
// (la mediana de los puntajes salta cuando los resultados son bimodales).
function aggregate(samples, strategy) {
  const metrics = Object.fromEntries(METRIC_KEYS.map((k) => [k, median(samples.map((s) => s[k]))]))
  const perf = samples.length > 1 ? performanceScore(metrics, strategy) : null
  return {
    metrics,
    performance: perf ?? median(samples.map((s) => s.perf)),
    runs: samples.length,
    spread: { performance: samples.map((s) => s.perf), lcp: samples.map((s) => Math.round(s.lcp ?? 0)) },
    unstable: isUnstable(samples.map((s) => s.lcp)),
  }
}

function combine(runs, strategy) {
  const samples = runs.map(toSample)
  const agg = aggregate(samples, strategy)
  // La ejecución con el LCP más cercano a la mediana aporta las auditorías, el elemento LCP,
  // la captura y las oportunidades, para que el detalle corresponda al resultado informado.
  const base = [...runs].sort((a, b) => Math.abs((a.metrics.lcp ?? 0) - agg.metrics.lcp) - Math.abs((b.metrics.lcp ?? 0) - agg.metrics.lcp))[0]
  const scores = Object.fromEntries(Object.keys(base.scores).map((k) => [k, median(runs.map((r) => r.scores[k]))]))
  Object.keys(scores).forEach((k) => scores[k] != null && (scores[k] = Math.round(scores[k])))
  scores.performance = agg.performance
  const { metrics, ...rest } = agg
  return {
    ...base,
    ...rest,
    scores,
    metrics,
    audits: { ...base.audits, imageSavingsBytes: median(runs.map((r) => r.audits.imageSavingsBytes)) },
    samples,
    analyses: 1,
  }
}

// Suma las mediciones de un análisis anterior de la MISMA versión de la página (mismo HTML).
export function poolRuns(current, previous, strategy) {
  if (!previous?.samples?.length || !current?.samples) return current
  const samples = [...previous.samples, ...current.samples].slice(-MAX_SAMPLES)
  const { metrics, performance, ...rest } = aggregate(samples, strategy)
  return {
    ...current,
    ...rest,
    metrics,
    scores: { ...current.scores, performance },
    samples,
    analyses: (previous.analyses ?? 1) + 1,
  }
}

export async function runPageSpeed(url, strategy, runs = RUNS[strategy] ?? 3) {
  const settled = await Promise.allSettled(Array.from({ length: runs }, (_, i) => runOnce(bust(url, i), strategy)))
  const ok = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value)
  if (!ok.length) throw settled[0].reason
  return combine(ok, strategy)
}

async function runOnce(url, strategy) {
  const params = new URLSearchParams({ url, strategy, locale: 'es' })
  CATEGORIES.forEach((c) => params.append('category', c))
  const key = import.meta.env.VITE_PSI_API_KEY
  if (key) params.set('key', key)

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  let res
  try {
    res = await fetch(`${ENDPOINT}?${params}`, { signal: ctrl.signal })
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('PageSpeed tardó más de 3 minutos. El sitio puede ser muy pesado: reintenta más tarde.')
    throw new Error('No se pudo conectar con PageSpeed. Revisa tu conexión.')
  } finally {
    clearTimeout(timer)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.lighthouseResult) {
    if (res.status === 429) throw new Error('Límite de consultas de PageSpeed alcanzado. Revisa VITE_PSI_API_KEY o espera unos minutos.')
    const msg = data?.error?.message || `PageSpeed respondió ${res.status}`
    if (/FAILED_DOCUMENT_REQUEST|ERRORED_DOCUMENT_REQUEST|NO_FCP|DNS/i.test(msg)) throw new Error('Lighthouse no pudo cargar la página (¿la URL está caída o es privada?).')
    throw new Error(msg)
  }
  return summarize(data)
}
