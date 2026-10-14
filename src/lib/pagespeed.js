// Google PageSpeed Insights (Lighthouse 13+) — se llama directo desde el navegador.
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
    },
    field: fieldData(data),
    screenshot: a['final-screenshot']?.details?.data ?? null,
    failing,
  }
}

export async function runPageSpeed(url, strategy) {
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
