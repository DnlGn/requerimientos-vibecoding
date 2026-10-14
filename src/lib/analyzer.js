import { supabase } from './supabase'
import { runPageSpeed } from './pagespeed'

export function normalizeUrl(raw) {
  const v = (raw || '').trim()
  if (!v) return ''
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}

async function runSite(url) {
  const { data, error } = await supabase.functions.invoke('analyze-site', { body: { url } })
  if (error) {
    let msg = error.message
    try {
      const body = await error.context?.json?.()
      if (body?.error) msg = body.error
    } catch { /* sin body */ }
    throw new Error(msg)
  }
  return data
}

// Ejecuta las 3 fuentes en paralelo y avisa el progreso de cada una.
export async function runFullAnalysis(rawUrl, onProgress) {
  const url = normalizeUrl(rawUrl)
  const steps = { site: runSite(url), mobile: runPageSpeed(url, 'mobile'), desktop: runPageSpeed(url, 'desktop') }
  const results = { url, ranAt: new Date().toISOString(), errors: {} }
  await Promise.all(
    Object.entries(steps).map(async ([key, p]) => {
      onProgress?.(key, 'running')
      try {
        results[key] = await p
        onProgress?.(key, 'done')
      } catch (e) {
        results[key] = null
        results.errors[key] = e.message
        onProgress?.(key, 'error', e.message)
      }
    }),
  )
  return results
}
