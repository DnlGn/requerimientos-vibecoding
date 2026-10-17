import { supabase } from './supabase'

const BUCKET = 'analysis-photos'
const MAX_SIDE = 1600
const QUALITY = 0.82

// Las fotos de una tablet pesan 4–12 MB: se reducen a 1600 px y se convierten a WebP
// (~150–300 KB) antes de subir, para que el informe público cargue rápido.
async function compress(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()
  const toBlob = (type) => new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY))
  // Safari antiguo no codifica WebP y devuelve PNG: en ese caso se usa JPEG.
  let blob = await toBlob('image/webp')
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg')
  return { blob, width, height }
}

export function photoUrl(path) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export async function listPhotos(analysisId) {
  const { data, error } = await supabase
    .from('analysis_photos')
    .select('*')
    .eq('analysis_id', analysisId)
    .order('created_at')
  if (error) throw error
  return data
}

export async function uploadPhoto(analysisId, file, { criterionId = null } = {}) {
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" no es una imagen`)
  const { data: auth } = await supabase.auth.getUser()
  const { blob, width, height } = await compress(file)
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${auth.user.id}/${analysisId}/${crypto.randomUUID()}.${ext}`
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000' })
  if (upErr) throw upErr
  const { data, error } = await supabase
    .from('analysis_photos')
    .insert({ analysis_id: analysisId, path, criterion_id: criterionId, width, height })
    .select('*')
    .single()
  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw error
  }
  return data
}

export async function updatePhoto(id, patch) {
  const { error } = await supabase.from('analysis_photos').update(patch).eq('id', id)
  if (error) throw error
}

export async function deletePhotos(photos) {
  if (!photos.length) return
  const { error } = await supabase.storage.from(BUCKET).remove(photos.map((p) => p.path))
  if (error) throw error
  const { error: dbErr } = await supabase.from('analysis_photos').delete().in('id', photos.map((p) => p.id))
  if (dbErr) throw dbErr
}
