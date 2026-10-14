import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && key)

export const supabase = isConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

export function publicReportUrl(slug) {
  const base = (import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin).replace(/\/$/, '')
  return `${base}/r/${slug}`
}
