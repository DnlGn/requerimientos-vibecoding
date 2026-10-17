import { useRef } from 'react'
import { Camera, ImagePlus, Loader2, Lock } from 'lucide-react'
import { photoUrl } from '../lib/photos'

// Miniaturas de fotos + botones para tomar una foto (cámara de la tablet) o elegir de la galería.
// En computador también se puede pegar una captura (Ctrl+V) con la tira enfocada.
export default function PhotoStrip({ photos = [], editable = false, uploading = 0, onAdd, onOpen, compact = false }) {
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)

  if (!editable && !photos.length) return null

  const pick = (e) => {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (files.length) onAdd(files)
  }

  const paste = (e) => {
    const files = [...e.clipboardData.items].filter((i) => i.type.startsWith('image/')).map((i) => i.getAsFile()).filter(Boolean)
    if (files.length) {
      e.preventDefault()
      onAdd(files)
    }
  }

  return (
    <div className={`photo-strip ${compact ? 'compact' : ''}`} onPaste={editable ? paste : undefined}>
      {(photos.length > 0 || uploading > 0) && (
        <ul className="photo-thumbs">
          {photos.map((p, i) => (
            <li key={p.id}>
              <button type="button" className="photo-thumb" onClick={() => onOpen(i)} aria-label={p.caption || `Ver foto ${i + 1}`}>
                <img src={photoUrl(p.path)} alt={p.caption || ''} loading="lazy" decoding="async" width={p.width || undefined} height={p.height || undefined} />
                {p.is_private && <span className="photo-badge" title="Privada: no aparece en el informe"><Lock size={12} aria-hidden="true" /></span>}
              </button>
            </li>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <li key={`up-${i}`}>
              <span className="photo-thumb uploading" role="status">
                <Loader2 size={22} className="spin" aria-hidden="true" />
                <span className="sr-only">Subiendo foto…</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="photo-actions">
          <button type="button" className="link-btn" onClick={() => cameraRef.current?.click()}>
            <Camera size={18} aria-hidden="true" /> Tomar foto
          </button>
          <button type="button" className="link-btn" onClick={() => galleryRef.current?.click()}>
            <ImagePlus size={18} aria-hidden="true" /> Subir imagen
          </button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
          <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={pick} />
        </div>
      )}
    </div>
  )
}
