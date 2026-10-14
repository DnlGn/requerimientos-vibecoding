import { memo, useState } from 'react'
import { STATUS } from '../lib/checklist'

const ORDER = ['pass', 'partial', 'fail', 'na']

function CriterionCard({ criterion, value = {}, onChange }) {
  const [showHelp, setShowHelp] = useState(false)
  const [showNote, setShowNote] = useState(Boolean(value.note))
  const { status, note, autoStatus, autoDetail, source } = value

  const setStatus = (s) => onChange(criterion.id, { status: status === s ? null : s, source: 'manual' })
  const useAuto = () => onChange(criterion.id, { status: autoStatus, source: 'auto' })

  return (
    <article className={`criterion status-${status || 'none'}`}>
      <div className="criterion-head">
        <div className="criterion-title">
          <h4>{criterion.title}</h4>
          <button type="button" className="help-toggle" onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp}>
            {showHelp ? 'Ocultar' : '¿Qué se evalúa?'}
          </button>
        </div>
        {criterion.auto && <span className="chip chip-plain small" title="Este criterio tiene revisión automática">Auto</span>}
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
        {ORDER.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={status === s}
            className={`status-btn s-${s} ${status === s ? 'active' : ''}`}
            onClick={() => setStatus(s)}
          >
            {STATUS[s].label}
          </button>
        ))}
      </div>

      {showNote ? (
        <textarea
          className="input note-input"
          rows={2}
          placeholder="Comentario para el alumno (aparece en el informe)…"
          value={note || ''}
          onChange={(e) => onChange(criterion.id, { note: e.target.value })}
          autoFocus={!note}
        />
      ) : (
        <button type="button" className="link-btn add-note" onClick={() => setShowNote(true)}>+ Agregar comentario</button>
      )}
    </article>
  )
}

export default memo(CriterionCard)
