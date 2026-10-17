import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, Lock, Trash2, X } from 'lucide-react'
import { photoUrl } from '../lib/photos'

// Visor a pantalla completa. En el editor permite escribir un pie de foto,
// marcarla como privada (no sale en el informe) o eliminarla.
export default function PhotoViewer({ photos, index, onIndex, onClose, editable = false, onUpdate, onDelete }) {
  const photo = photos[index]

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && index < photos.length - 1) onIndex(index + 1)
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, photos.length, onIndex, onClose])

  if (!photo) return null

  const saveCaption = (e) => {
    const value = e.target.value.trim() || null
    if (value !== (photo.caption || null)) onUpdate(photo, { caption: value })
  }

  return (
    <div className="viewer-backdrop" onClick={onClose}>
      <div className="viewer" role="dialog" aria-modal="true" aria-label="Foto" onClick={(e) => e.stopPropagation()}>
        <button className="viewer-close" onClick={onClose} aria-label="Cerrar"><X size={22} aria-hidden="true" /></button>
        <figure className="viewer-figure">
          <img src={photoUrl(photo.path)} alt={photo.caption || ''} />
          {!editable && photo.caption && <figcaption>{photo.caption}</figcaption>}
        </figure>
        {photos.length > 1 && (
          <>
            <button className="viewer-nav prev" onClick={() => onIndex(index - 1)} disabled={index === 0} aria-label="Foto anterior"><ChevronLeft size={28} aria-hidden="true" /></button>
            <button className="viewer-nav next" onClick={() => onIndex(index + 1)} disabled={index === photos.length - 1} aria-label="Foto siguiente"><ChevronRight size={28} aria-hidden="true" /></button>
            <span className="viewer-count">{index + 1} / {photos.length}</span>
          </>
        )}
        {editable && (
          <div className="viewer-tools">
            <input
              className="input"
              placeholder="Pie de foto (opcional, aparece en el informe)"
              key={photo.id}
              defaultValue={photo.caption || ''}
              onBlur={saveCaption}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
            <button
              className={`btn ${photo.is_private ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onUpdate(photo, { is_private: !photo.is_private })}
              aria-pressed={photo.is_private}
            >
              <Lock size={18} aria-hidden="true" /> {photo.is_private ? 'Privada' : 'Visible en informe'}
            </button>
            <button className="btn btn-danger-ghost" onClick={() => window.confirm('¿Eliminar esta foto?') && onDelete(photo)}>
              <Trash2 size={18} aria-hidden="true" /> Eliminar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
