// Google PageSpeed Insights (Lighthouse) — se llama directo desde el navegador.
const ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

// Auditorías que nos interesan para el informe (si fallan, se listan como oportunidades).
const KEY_AUDITS = [
  'largest-contentful-paint-element',
  'render-blocking-resources',
  'render-blocking-insight',
  'uses-responsive-images',
  'image-delivery-insight',
  'modern-image-formats',
  'uses-optimized-images',
  'offscreen-images',
  'unused-javascript',
  'unused-css-rules',
  'unminified-javascript',
  'uses-text-compression',
  'font-display',
  'font-display-insight',
  'lcp-lazy-loaded',
  'prioritize-lcp-image',
  'unsized-images',
  'color-contrast',
  'image-alt',
  'button-name',
  'link-name',
  'label',
  'heading-order',
  'tap-targets',
  'target-size',
  'font-size',
  'viewport',
  'errors-in-console',
  'is-on-https',
  'meta-description',
  'document-title',
  'html-has-lang',
  'crawlable-anchors',
]

const num = (audit) => (audit && typeof audit.numericValue === 'number' ? audit.numericValue : null)

function summarize(data) {
  const lh = data.lighthouseResult
  const a = lh.audits
  const scores = {}
  for (const c of CATEGORIES) {
    const s = lh.categories[c]?.score
    scores[c] = typeof s === 'number' ? Math.round(s * 100) : null
  }
  const failing = KEY_AUDITS
    .map((id) => a[id])
    .filter((x) => x && typeof x.score === 'number' && x.score < 0.9 && x.scoreDisplayMode !== 'notApplicable')
    .map((x) => ({ id: x.id, title: x.title, score: x.score, display: x.displayValue || null }))

  const field = data.loadingExperience?.metrics
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
      viewport: a.viewport?.score ?? null,
      colorContrast: a['color-contrast']?.score ?? null,
      imageAlt: a['image-alt']?.score ?? null,
      errorsInConsole: a['errors-in-console']?.score ?? null,
      fontSize: a['font-size']?.score ?? null,
      targetSize: (a['target-size'] ?? a['tap-targets'])?.score ?? null,
      modernImages: (a['modern-image-formats'] ?? a['image-delivery-insight'])?.score ?? null,
      responsiveImages: (a['uses-responsive-images'] ?? a['image-delivery-insight'])?.score ?? null,
      renderBlocking: (a['render-blocking-resources'] ?? a['render-blocking-insight'])?.score ?? null,
    },
    field: field
      ? {
          lcp: field.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
          cls: field.CUMULATIVE_LAYOUT_SHIFT_SCORE ? field.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : null,
          inp: field.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
          overall: data.loadingExperience.overall_category ?? null,
        }
      : null,
    screenshot: a['final-screenshot']?.details?.data ?? null,
    failing,
  }
}

export async function runPageSpeed(url, strategy, signal) {
  const params = new URLSearchParams({ url, strategy, locale: 'es' })
  CATEGORIES.forEach((c) => params.append('category', c))
  const key = import.meta.env.VITE_PSI_API_KEY
  if (key) params.set('key', key)

  const res = await fetch(`${ENDPOINT}?${params}`, { signal })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.lighthouseResult) {
    const msg = data?.error?.message || `PageSpeed respondió ${res.status}`
    throw new Error(res.status === 429 ? 'Límite de consultas de PageSpeed alcanzado. Configura VITE_PSI_API_KEY o espera unos minutos.' : msg)
  }
  return summarize(data)
}
