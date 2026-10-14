import { supabase } from './supabase'
import { runPageSpeed } from './pagespeed'

export const STEPS = ['site', 'mobile', 'desktop']

export function normalizeUrl(raw) {
  const v = (raw || '').trim()
  if (!v) return ''
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}

async function runSite(url) {
  const { data, error } = await supabase.functions.invoke('analyze-site', { body: { url } })
  if (!error) return data
  const status = error.context?.status
  let body = null
  try {
    body = await error.context?.json?.()
  } catch { /* sin body */ }
  if (status === 404 && body?.code === 'NOT_FOUND') throw new Error('La Edge Function "analyze-site" no está desplegada en Supabase.')
  if (status === 401) throw new Error(body?.error || 'Sesión expirada: vuelve a iniciar sesión.')
  if (error.name === 'FunctionsFetchError') throw new Error('No se pudo contactar la Edge Function (¿sin conexión?).')
  throw new Error(body?.error || body?.message || error.message)
}

const RUNNERS = {
  site: runSite,
  mobile: (url) => runPageSpeed(url, 'mobile'),
  desktop: (url) => runPageSpeed(url, 'desktop'),
}

// Ejecuta las fuentes pedidas en paralelo. Si se pasa `previous`, conserva los
// resultados de las fuentes que no se vuelven a ejecutar (para reintentar solo lo que falló).
export async function runFullAnalysis(rawUrl, onProgress, { steps = STEPS, previous = null } = {}) {
  const url = normalizeUrl(rawUrl)
  const keep = previous && previous.url === url ? previous : null
  const results = {
    ...(keep || {}),
    url,
    ranAt: new Date().toISOString(),
    errors: Object.fromEntries(Object.entries(keep?.errors || {}).filter(([k]) => !steps.includes(k))),
  }
  await Promise.all(
    steps.map(async (key) => {
      onProgress?.(key, 'running')
      try {
        results[key] = await RUNNERS[key](url)
        onProgress?.(key, 'done')
      } catch (e) {
        results[key] = keep?.[key] ?? null
        results.errors[key] = e.message
        onProgress?.(key, 'error', e.message)
      }
    }),
  )
  return results
}
