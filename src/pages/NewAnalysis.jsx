import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link2, PenLine } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { normalizeUrl } from '../lib/analyzer'

export default function NewAnalysis() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('auto')
  const [form, setForm] = useState({ project_name: '', student_name: '', course: '', url: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const rawUrl = form.url.trim()
    const url = mode === 'auto' ? normalizeUrl(rawUrl) : rawUrl || null
    const { data, error } = await supabase
      .from('analyses')
      .insert({
        project_name: form.project_name.trim(),
        student_name: form.student_name.trim() || null,
        course: form.course.trim() || null,
        url,
        mode,
      })
      .select('id')
      .single()
    setBusy(false)
    if (error) return setError(error.message)
    navigate(`/analisis/${data.id}`, { state: { autostart: mode === 'auto' } })
  }

  return (
    <div className="page narrow-page">
      <h1>Nuevo análisis</h1>
      <form className="card stack" onSubmit={submit}>
        <fieldset className="mode-picker">
          <legend>¿Cómo quieres analizar?</legend>
          <label className={`mode-option ${mode === 'auto' ? 'selected' : ''}`}>
            <input type="radio" name="mode" value="auto" checked={mode === 'auto'} onChange={() => setMode('auto')} />
            <Link2 size={28} className="mode-icon" aria-hidden="true" />
            <strong>Con link</strong>
            <span className="muted small">Análisis automático de rendimiento, metadata y archivos, más tus anotaciones.</span>
          </label>
          <label className={`mode-option ${mode === 'manual' ? 'selected' : ''}`}>
            <input type="radio" name="mode" value="manual" checked={mode === 'manual'} onChange={() => setMode('manual')} />
            <PenLine size={28} className="mode-icon" aria-hidden="true" />
            <strong>Sin link</strong>
            <span className="muted small">Evaluación 100% manual con la rúbrica (proyecto local, presentación, etc.).</span>
          </label>
        </fieldset>

        {mode === 'auto' && (
          <label className="field">
            <span>URL del proyecto</span>
            <input
              type="text"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              required
              placeholder="mi-proyecto.vercel.app"
              value={form.url}
              onChange={set('url')}
            />
          </label>
        )}
        <label className="field">
          <span>Nombre del proyecto</span>
          <input required placeholder="Ej: EcoRuta" value={form.project_name} onChange={set('project_name')} />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Alumno(s)</span>
            <input placeholder="Nombre y apellido" value={form.student_name} onChange={set('student_name')} />
          </label>
          <label className="field">
            <span>Curso / grupo</span>
            <input placeholder="Ej: 4°A" value={form.course} onChange={set('course')} />
          </label>
        </div>
        {mode === 'manual' && (
          <label className="field">
            <span>Link de referencia <em className="muted">(opcional, no se analiza)</em></span>
            <input type="text" placeholder="Repositorio, Figma, link de AI Studio…" value={form.url} onChange={set('url')} />
          </label>
        )}
        {error && <p className="alert alert-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost btn-lg" onClick={() => navigate(-1)}>Cancelar</button>
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? 'Creando…' : mode === 'auto' ? 'Crear y analizar' : 'Crear y evaluar'}
          </button>
        </div>
      </form>
    </div>
  )
}
