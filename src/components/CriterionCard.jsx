import { memo, useState } from 'react'
import { Ban, Check, CircleHelp, Minus, MessageSquarePlus, Sparkles, Trash2, X } from 'lucide-react'
import { STATUS } from '../lib/checklist'
import PhotoStrip from './PhotoStrip'
import { useImageDrop } from '../lib/useImageDrop'

const ORDER = ['pass', 'partial', 'fail', 'na']
const STATUS_ICONS = { pass: Check, partial: Minus, fail: X, na: Ban }

function CriterionCard({ criterion, value = {}, onChange, photos, uploading = 0, onAddPhotos, onOpenPhoto }) {
  const [showHelp, setShowHelp] = useState(false)
  const [showNote, setShowNote] = useState(Boolean(value.note))
  const { status, note, autoStatus, autoDetail, source } = value
  // Toda la tarjeta recibe imágenes arrastradas (la tira de miniaturas es un blanco muy pequeño).
  const { dragging, dropProps } = useImageDrop((files) => onAddPhotos(criterion.id, files), Boolean(onAddPhotos))

  const setStatus = (s) => onChange(criterion.id, { status: status === s ? null : s, source: 'manual' })
  const useAuto = () => onChange(criterion.id, { status: autoStatus, source: 'auto' })
  const removeNote = () => {
    setShowNote(false)
    if (note) onChange(criterion.id, { note: null })
  }

  return (
    <article className={`criterion status-${status || 'none'} ${dragging ? 'drop-active' : ''}`} {...dropProps}>
      <div className="criterion-head">
        <div className="criterion-title">
          <h4>{criterion.title}</h4>
          <button type="button" className="help-toggle" onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp}>
            <CircleHelp size={16} aria-hidden="true" /> {showHelp ? 'Ocultar' : '¿Qué se evalúa?'}
          </button>
        </div>
        {criterion.auto && <span className="chip chip-plain small" title="Este criterio tiene revisión automática"><Sparkles size={12} aria-hidden="true" /> Auto</span>}
      </div>

      {showHelp && <p className="criterion-help">{criterion.help}</p>}

      {autoDetail && (
        <p className={`auto-detail ${autoStatus ? `tone-${autoStatus}` : ''}`}>
          <span className="auto-tag">{autoStatus ? STATUS[autoStatus].label : 'Revisar'}</span>
          <span>{autoDetail}</span>
          {source === 'manual' && autoStatus && status !== autoStatus && (
            <button type="button" className="link-btn" onClick={useAuto}>Usar sugerencia</button>
          )}
        </p>
      )}

      <div className="status-picker" role="radiogroup" aria-label={`Evaluación: ${criterion.title}`}>
        {ORDER.map((s) => {
          const Icon = STATUS_ICONS[s]
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={status === s}
              className={`status-btn s-${s} ${status === s ? 'active' : ''}`}
              onClick={() => setStatus(s)}
            >
              <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
              <span>{STATUS[s].label}</span>
            </button>
          )
        })}
      </div>

      {showNote ? (
        <div className="note-row">
          <textarea
            className="input note-input"
            rows={2}
            placeholder="Comentario para el alumno (aparece en el informe)…"
            value={note || ''}
            onChange={(e) => onChange(criterion.id, { note: e.target.value })}
            onBlur={(e) => !e.target.value.trim() && removeNote()}
            autoFocus={!note}
          />
          <button type="button" className="btn btn-ghost note-delete" onClick={removeNote} aria-label="Eliminar comentario" title="Eliminar comentario">
            <Trash2 size={18} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button type="button" className="link-btn add-note" onClick={() => setShowNote(true)}>
          <MessageSquarePlus size={18} aria-hidden="true" /> Agregar comentario
        </button>
      )}

      {onAddPhotos && (
        <PhotoStrip
          editable
          compact
          photos={photos}
          uploading={uploading}
          onAdd={(files) => onAddPhotos(criterion.id, files)}
          onOpen={(i) => onOpenPhoto(criterion.id, i)}
        />
      )}
    </article>
  )
}

export default memo(CriterionCard)
