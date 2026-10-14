// Réplica del cálculo del puntaje de rendimiento de Lighthouse 10+ (curvas log-normales y pesos
// oficiales). Se usa para calcular el puntaje a partir de las métricas medianas: con resultados
// bimodales, la mediana de los puntajes salta, mientras que el puntaje de las medianas es estable
// y coincide con las métricas que muestra el informe.
// Referencia: https://developer.chrome.com/docs/lighthouse/performance/performance-scoring

const CURVES = {
  mobile: {
    fcp: { p10: 1800, median: 3000, weight: 0.1 },
    si: { p10: 3387, median: 5800, weight: 0.1 },
    lcp: { p10: 2500, median: 4000, weight: 0.25 },
    tbt: { p10: 200, median: 600, weight: 0.3 },
    cls: { p10: 0.1, median: 0.25, weight: 0.25 },
  },
  desktop: {
    fcp: { p10: 934, median: 1600, weight: 0.1 },
    si: { p10: 1311, median: 2300, weight: 0.1 },
    lcp: { p10: 1200, median: 2400, weight: 0.25 },
    tbt: { p10: 150, median: 350, weight: 0.3 },
    cls: { p10: 0.1, median: 0.25, weight: 0.25 },
  },
}

// Aproximación de erf usada por Lighthouse (Abramowitz y Stegun 7.1.26).
function erf(x) {
  const sign = Math.sign(x)
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  return sign * (1 - y * Math.exp(-ax * ax))
}

function logNormalScore({ p10, median }, value) {
  if (value <= 0) return 1
  const standardized = (Math.log(value / median) * 0.9061938024368232) / -Math.log(p10 / median)
  const score = (1 - erf(standardized)) / 2
  if (value <= p10) return Math.max(0.9, Math.min(1, score))
  if (value <= median) return Math.max(0.5, Math.min(0.8999999999, score))
  return Math.max(0, Math.min(0.4999999999, score))
}

// Devuelve el puntaje 0–100, o null si falta alguna métrica.
export function performanceScore(metrics, strategy) {
  const curves = CURVES[strategy]
  if (!curves) return null
  let total = 0
  for (const [key, curve] of Object.entries(curves)) {
    const v = metrics[key]
    if (typeof v !== 'number') return null
    total += Math.round(logNormalScore(curve, v) * 100) / 100 * curve.weight
  }
  return Math.round(total * 100)
}
