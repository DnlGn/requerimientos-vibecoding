import { supabase } from './supabase'
import { poolRuns, runPageSpeed } from './pagespeed'

export const STEPS = ['site', 'mobile', 'desktop']

export function normalizeUrl(raw) {
  const v = (raw || '').trim()
  if (!v) return ''
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}

// Links que no se pueden analizar automáticamente: no son una página pública
// (piden iniciar sesión, son editores o solo existen en el computador del alumno).
const NON_PUBLIC = [
  {
    test: (h) => h === 'ai.studio' || h === 'aistudio.google.com',
    kind: 'aistudio',
    message: 'Es un link de Google AI Studio: abre el proyecto dentro del editor y pide iniciar sesión con Google, así que el análisis vería la página de login. Pide al alumno que lo publique (Deploy → Cloud Run, o exportarlo a Vercel/Netlify) y analiza esa URL pública.',
  },
  {
    test: (h) => h === 'accounts.google.com',
    kind: 'login',
    message: 'Es una página de inicio de sesión de Google, no el proyecto.',
  },
  {
    test: (h) => h === 'localhost' || h.endsWith('.local') || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h),
    kind: 'local',
    message: 'Es una dirección local: solo funciona en el computador del alumno. Necesita estar publicada en internet.',
  },
  {
    test: (h) => h === 'github.com' || h === 'gitlab.com',
    kind: 'repo',
    message: 'Es un repositorio de código, no la página publicada. Si usa GitHub Pages, la URL pública es usuario.github.io/proyecto.',
  },
  {
    test: (h) => h.endsWith('figma.com') || h === 'docs.google.com' || h === 'drive.google.com',
    kind: 'document',
    message: 'Es un documento o diseño, no una página web publicada.',
  },
]

export function nonPublicLink(raw) {
  try {
    const host = new URL(normalizeUrl(raw)).hostname.toLowerCase()
    return NON_PUBLIC.find((n) => n.test(host)) ?? null
  } catch {
    return null
  }
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
  const blocked = nonPublicLink(url)
  if (blocked) {
    steps.forEach((s) => onProgress?.(s, 'error', blocked.message))
    return { url, ranAt: new Date().toISOString(), site: null, mobile: null, desktop: null, errors: Object.fromEntries(STEPS.map((s) => [s, blocked.message])) }
  }
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

  // Si el HTML no cambió desde el análisis anterior, las mediciones de PageSpeed se acumulan:
  // así un sitio sin cambios converge a la misma nota en vez de variar en cada análisis.
  const prevHash = keep?.site?.contentHash
  if (prevHash && results.site?.contentHash === prevHash) {
    for (const strategy of ['mobile', 'desktop']) {
      if (steps.includes(strategy) && !results.errors[strategy]) {
        results[strategy] = poolRuns(results[strategy], keep[strategy], strategy)
      }
    }
  }
  return results
}
