import { CATEGORIES, STATUS } from './checklist'

export function categoryStats(category, evaluations) {
  let sum = 0
  let counted = 0
  let pending = 0
  for (const c of category.criteria) {
    const s = evaluations[c.id]?.status
    if (!s) pending++
    else if (STATUS[s]?.value != null) {
      sum += STATUS[s].value
      counted++
    }
  }
  return {
    score: counted ? Math.round((sum / counted) * 100) : null,
    evaluated: category.criteria.length - pending,
    total: category.criteria.length,
    pending,
  }
}

export function computeScore(evaluations = {}) {
  let weighted = 0
  let weights = 0
  const byCategory = {}
  for (const cat of CATEGORIES) {
    const st = categoryStats(cat, evaluations)
    byCategory[cat.id] = st
    if (st.score != null) {
      weighted += st.score * cat.weight
      weights += cat.weight
    }
  }
  const total = CATEGORIES.reduce((n, c) => n + c.criteria.length, 0)
  const evaluated = Object.values(byCategory).reduce((n, s) => n + s.evaluated, 0)
  return { score: weights ? Math.round(weighted / weights) : null, byCategory, evaluated, total }
}

export function level(score) {
  if (score == null) return { label: 'Sin evaluar', tone: 'muted' }
  if (score >= 90) return { label: 'Nivel profesional', tone: 'great' }
  if (score >= 75) return { label: 'Muy bien encaminado', tone: 'good' }
  if (score >= 55) return { label: 'En desarrollo', tone: 'warn' }
  return { label: 'Inicial', tone: 'bad' }
}

// Umbrales oficiales de Core Web Vitals
export function metricTone(metric, v) {
  if (v == null) return 'muted'
  const t = { lcp: [2500, 4000], fcp: [1800, 3000], cls: [0.1, 0.25], tbt: [200, 600], si: [3400, 5800], ttfb: [800, 1800], inp: [200, 500] }[metric]
  if (!t) return 'muted'
  return v <= t[0] ? 'great' : v <= t[1] ? 'warn' : 'bad'
}

export function scoreTone(v) {
  if (v == null) return 'muted'
  return v >= 90 ? 'great' : v >= 50 ? 'warn' : 'bad'
}

export function formatMetric(metric, v) {
  if (v == null) return '—'
  if (metric === 'cls') return v.toFixed(3)
  return v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`
}
