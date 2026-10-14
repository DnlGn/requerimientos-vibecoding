import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ExternalLink, Lock, MessageCircle, NotebookPen, Pencil, Play, QrCode, RefreshCw, RotateCcw, LayoutDashboard, Target, ThumbsUp, Trash2, Wand2 } from 'lucide-react'
import { supabase, publicReportUrl } from '../lib/supabase'
import { CATEGORIES, applyAutoSuggestions } from '../lib/checklist'
import { computeScore, level, suggestImprovements, suggestStrengths } from '../lib/scoring'
import { STEPS, normalizeUrl, runFullAnalysis } from '../lib/analyzer'
import CriterionCard from '../components/CriterionCard'
import AutoResults from '../components/AutoResults'
import DevicePreview from '../components/DevicePreview'
import ScoreRing from '../components/ScoreRing'
import QrModal from '../components/QrModal'
import Spinner from '../components/Spinner'

const SAVE_DELAY = 800
const STEP_LABELS = { site: 'HTML, metadata y archivos', mobile: 'PageSpeed · celular', desktop: 'PageSpeed · escritorio' }

export default function AnalysisEditor() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [a, setA] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [section, setSection] = useState('resumen')
  const [saveState, setSaveState] = useState('saved')
  const [progress, setProgress] = useState(null)
  const [showQr, setShowQr] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [editInfo, setEditInfo] = useState(false)

  const latest = useRef(null)
  const pending = useRef({})
  const timer = useRef(null)
  const autostarted = useRef(false)
  const mainRef = useRef(null)

  useEffect(() => {
    supabase
      .from('analyses')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) return setLoadError(error.message)
        latest.current = data
        setA(data)
      })
  }, [id])

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const patch = pending.current
    if (!Object.keys(patch).length) return
    pending.current = {}
    setSaveState('saving')
    const { error } = await supabase.from('analyses').update(patch).eq('id', id)
    if (error) {
      pending.current = { ...patch, ...pending.current }
      setSaveState('error')
    } else if (!Object.keys(pending.current).length) setSaveState('saved')
  }, [id])

  // Aplica cambios locales al instante y los guarda en Supabase con debounce.
  const update = useCallback(
    (patch, { immediate = false } = {}) => {
      const next = { ...latest.current, ...patch }
      if (patch.evaluations) patch = { ...patch, score: computeScore(next.evaluations).score }
      latest.current = { ...next, ...patch }
      setA(latest.current)
      pending.current = { ...pending.current, ...patch }
      setSaveState('dirty')
      clearTimeout(timer.current)
      if (immediate) flush()
      else timer.current = setTimeout(flush, SAVE_DELAY)
    },
    [flush],
  )

  // Guardar al salir de la pestaña o desmontar
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [flush])

  const setCriterion = useCallback(
    (cid, patch) => {
      const evals = latest.current.evaluations || {}
      update({ evaluations: { ...evals, [cid]: { ...evals[cid], ...patch } } })
    },
    [update],
  )

  const runAnalysis = useCallback(async (steps = STEPS) => {
    const url = latest.current?.url
    if (!url) return
    setProgress(Object.fromEntries(steps.map((s) => [s, 'pending'])))
    const results = await runFullAnalysis(url, (step, state) => setProgress((p) => ({ ...p, [step]: state })), {
      steps,
      previous: latest.current.auto_results,
    })
    const evaluations = applyAutoSuggestions(latest.current.evaluations || {}, results)
    update({ auto_results: results, evaluations }, { immediate: true })
    setProgress(null)
  }, [update])

  useEffect(() => {
    if (a && location.state?.autostart && !a.auto_results && !autostarted.current) {
      autostarted.current = true
      navigate(location.pathname, { replace: true, state: null })
      runAnalysis()
    }
  }, [a, location, navigate, runAnalysis])

  const stats = useMemo(() => (a ? computeScore(a.evaluations || {}) : null), [a])

  function go(s) {
    setSection(s)
    mainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function togglePublish() {
    setPublishing(true)
    await flush()
    const publish = latest.current.status !== 'published'
    update({ status: publish ? 'published' : 'draft', published_at: publish ? new Date().toISOString() : latest.current.published_at }, { immediate: true })
    setPublishing(false)
  }

  function fillSuggestion(field, text) {
    if (!text) return window.alert(field === 'strengths' ? 'Aún no hay categorías con puntaje alto (85 o más) para destacar.' : 'No hay criterios marcados como "No cumple" o "Parcial".')
    const current = (latest.current[field] || '').trim()
    if (current && !window.confirm('¿Reemplazar el texto actual por la sugerencia? Puedes editarla después.')) return
    update({ [field]: text })
  }

  async function remove() {
    if (!window.confirm(`¿Eliminar el análisis de "${a.project_name}"? Esta acción no se puede deshacer.`)) return
    clearTimeout(timer.current)
    pending.current = {}
    const { error } = await supabase.from('analyses').delete().eq('id', id)
    if (error) return window.alert(error.message)
    navigate('/', { replace: true })
  }

  if (loadError) return <div className="page"><p className="alert alert-error">{loadError}</p><Link to="/" className="icon-link"><ArrowLeft size={16} aria-hidden="true" /> Volver</Link></div>
  if (!a) return <Spinner />

  const lv = level(stats.score)
  const sections = [
    { id: 'resumen', icon: LayoutDashboard, title: 'Resumen' },
    ...CATEGORIES.map((c) => ({ id: c.id, icon: c.icon, title: c.title, st: stats.byCategory[c.id] })),
    { id: 'cierre', icon: NotebookPen, title: 'Conclusiones' },
  ]
  const idx = sections.findIndex((s) => s.id === section)
  const category = CATEGORIES.find((c) => c.id === section)
  const canAnalyze = a.mode === 'auto' && a.url
  const failedSteps = Object.keys(a.auto_results?.errors || {})

  return (
    <div className="editor">
      <header className="editor-head">
        <Link to="/" className="back-link" aria-label="Volver a proyectos"><ArrowLeft size={22} aria-hidden="true" /></Link>
        <div className="editor-title">
          <h1>{a.project_name}</h1>
          <p className="muted small truncate">
            {[a.student_name, a.course].filter(Boolean).join(' · ')}
            {a.url && (
              <>
                {' · '}
                {a.mode === 'auto' ? <a href={a.url} target="_blank" rel="noreferrer">{a.url.replace(/^https?:\/\//, '')}</a> : a.url}
              </>
            )}
            <button className="link-btn" onClick={() => setEditInfo((v) => !v)}>
              {editInfo ? <Check size={14} aria-hidden="true" /> : <Pencil size={14} aria-hidden="true" />} {editInfo ? 'Listo' : 'Editar datos'}
            </button>
          </p>
        </div>
        <span className={`save-state ${saveState}`} aria-live="polite">
          {saveState === 'saved' && <Check size={16} aria-hidden="true" />}
          {saveState === 'error' && <AlertTriangle size={16} aria-hidden="true" />}
          {{ saved: 'Guardado', dirty: 'Cambios sin guardar', saving: 'Guardando…', error: 'Error al guardar' }[saveState]}
        </span>
        <div className="editor-actions">
          {a.status === 'published' && (
            <a className="btn btn-secondary" href={publicReportUrl(a.share_slug)} target="_blank" rel="noreferrer"><ExternalLink size={18} aria-hidden="true" /> Ver informe</a>
          )}
          <button className="btn btn-primary" onClick={() => setShowQr(true)}><QrCode size={18} aria-hidden="true" /> {a.status === 'published' ? 'QR / Compartir' : 'Publicar informe'}</button>
        </div>
      </header>

      {editInfo && (
        <div className="card info-editor grid-2">
          <label className="field"><span>Proyecto</span><input value={a.project_name} onChange={(e) => update({ project_name: e.target.value })} /></label>
          <label className="field"><span>URL</span><input value={a.url || ''} inputMode="url" onChange={(e) => update({ url: e.target.value })} onBlur={(e) => a.mode === 'auto' && e.target.value && update({ url: normalizeUrl(e.target.value) })} /></label>
          <label className="field"><span>Alumno(s)</span><input value={a.student_name || ''} onChange={(e) => update({ student_name: e.target.value })} /></label>
          <label className="field"><span>Curso / grupo</span><input value={a.course || ''} onChange={(e) => update({ course: e.target.value })} /></label>
          <div className="field">
            <span>Modo</span>
            <div className="segmented">
              <button className={a.mode === 'auto' ? 'active' : ''} onClick={() => update({ mode: 'auto' })}>Con link</button>
              <button className={a.mode === 'manual' ? 'active' : ''} onClick={() => update({ mode: 'manual' })}>Solo manual</button>
            </div>
          </div>
        </div>
      )}

      <div className="editor-body">
        <nav className="section-nav" aria-label="Secciones">
          <div className="section-nav-score">
            <ScoreRing value={stats.score} size={76} stroke={7} />
            <div>
              <strong className={`tone-text-${lv.tone}`}>{lv.label}</strong>
              <span className="small muted">{stats.evaluated}/{stats.total} criterios</span>
            </div>
          </div>
          <ul>
            {sections.map((s) => (
              <li key={s.id}>
                <button className={`section-link ${section === s.id ? 'active' : ''}`} onClick={() => go(s.id)} aria-current={section === s.id ? 'page' : undefined}>
                  <s.icon size={20} className="section-icon" aria-hidden="true" />
                  <span className="section-name">{s.title}</span>
                  {s.st && (
                    <span className={`section-badge ${s.st.pending === 0 ? 'done' : ''}`}>
                      {s.st.pending === 0 ? (s.st.score ?? '—') : `${s.st.evaluated}/${s.st.total}`}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section className="editor-main" ref={mainRef}>
          {section === 'resumen' && (
            <div className="stack">
              {canAnalyze ? (
                <div className="card run-card">
                  <div>
                    <h2 className="card-title">Análisis automático</h2>
                    <p className="muted small">
                      {a.auto_results?.ranAt
                        ? `Último análisis: ${new Date(a.auto_results.ranAt).toLocaleString('es')}`
                        : 'Revisa rendimiento (LCP, CLS…), metadata, llms.txt, robots, sitemap, API keys expuestas y más.'}
                    </p>
                  </div>
                  <button className="btn btn-primary btn-lg" onClick={() => runAnalysis()} disabled={!!progress}>
                    {progress ? <RefreshCw size={20} className="spin" aria-hidden="true" /> : a.auto_results ? <RefreshCw size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
                    {progress ? 'Analizando…' : a.auto_results ? 'Volver a analizar' : 'Analizar ahora'}
                  </button>
                  {!progress && failedSteps.length > 0 && (
                    <div className="retry-box">
                      <p className="small">
                        <AlertTriangle size={16} className="inline-icon" aria-hidden="true" />
                        Falló: {failedSteps.map((s) => STEP_LABELS[s]).join(', ')}. El resto del análisis se guardó.
                      </p>
                      <button className="btn btn-secondary" onClick={() => runAnalysis(failedSteps)}>
                        <RotateCcw size={18} aria-hidden="true" /> Reintentar solo eso
                      </button>
                    </div>
                  )}
                  {progress && (
                    <ul className="progress-list">
                      {Object.entries(progress).map(([k, v]) => (
                        <li key={k} className={`step-${v}`}>
                          <span className="step-dot" aria-hidden="true" />
                          {STEP_LABELS[k]}
                          <span className="small muted">{{ pending: 'En cola', running: 'En curso…', done: 'Listo', error: 'Error' }[v]}</span>
                        </li>
                      ))}
                      <li className="small muted">PageSpeed suele tardar entre 20 y 60 segundos (máximo 3 minutos).</li>
                    </ul>
                  )}
                </div>
              ) : (
                <div className="card">
                  <h2 className="card-title">Análisis manual</h2>
                  <p className="muted">Este proyecto se evalúa sin link. Recorre cada categoría y marca cada criterio. Los criterios que no puedas verificar, márcalos como “No aplica”.</p>
                </div>
              )}

              <div className="category-overview">
                {CATEGORIES.map((c) => {
                  const st = stats.byCategory[c.id]
                  return (
                    <button key={c.id} className="card cat-tile" onClick={() => go(c.id)}>
                      <c.icon size={26} className="cat-icon" aria-hidden="true" />
                      <span className="cat-name">{c.title}</span>
                      <span className="small muted">{st.evaluated}/{st.total} · peso {c.weight}%</span>
                      <span className="bar"><span style={{ width: `${st.score ?? 0}%` }} className={`bar-fill tone-${st.score == null ? 'muted' : st.score >= 80 ? 'great' : st.score >= 50 ? 'warn' : 'bad'}`} /></span>
                    </button>
                  )
                })}
              </div>

              <AutoResults results={a.auto_results} />
            </div>
          )}

          {category && (
            <div className="stack">
              <div className="category-head">
                <h2 className="icon-heading"><category.icon size={26} aria-hidden="true" /> {category.title}</h2>
                <p className="muted">{category.summary}</p>
              </div>
              {category.id === 'responsive' && a.mode === 'auto' && <DevicePreview url={a.url} />}
              {category.criteria.map((cr) => (
                <CriterionCard key={cr.id} criterion={cr} value={a.evaluations?.[cr.id]} onChange={setCriterion} />
              ))}
            </div>
          )}

          {section === 'cierre' && (
            <div className="stack">
              <div className="category-head">
                <h2 className="icon-heading"><NotebookPen size={26} aria-hidden="true" /> Conclusiones</h2>
                <p className="muted">Lo que escribas aquí aparece en el informe, excepto las notas privadas.</p>
              </div>
              <div className="field card">
                <div className="field-head">
                  <label htmlFor="f-strengths" className="icon-label"><ThumbsUp size={18} aria-hidden="true" /> Fortalezas</label>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => fillSuggestion('strengths', suggestStrengths(a.evaluations))}>
                    <Wand2 size={16} aria-hidden="true" /> Sugerir
                  </button>
                </div>
                <textarea id="f-strengths" className="input" rows={4} value={a.strengths || ''} onChange={(e) => update({ strengths: e.target.value })} placeholder="¿Qué hizo especialmente bien el alumno?" />
              </div>
              <div className="field card">
                <div className="field-head">
                  <label htmlFor="f-improvements" className="icon-label"><Target size={18} aria-hidden="true" /> Próximos pasos / mejoras prioritarias</label>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => fillSuggestion('improvements', suggestImprovements(a.evaluations))}>
                    <Wand2 size={16} aria-hidden="true" /> Sugerir
                  </button>
                </div>
                <textarea id="f-improvements" className="input" rows={6} value={a.improvements || ''} onChange={(e) => update({ improvements: e.target.value })} placeholder="Las mejoras con más impacto, en orden." />
              </div>
              <label className="field card">
                <span className="icon-label"><MessageCircle size={18} aria-hidden="true" /> Comentario general</span>
                <textarea className="input" rows={4} value={a.general_notes || ''} onChange={(e) => update({ general_notes: e.target.value })} />
              </label>
              <label className="field card private">
                <span className="icon-label"><Lock size={18} aria-hidden="true" /> Notas privadas <em className="muted small">(solo tú las ves)</em></span>
                <textarea className="input" rows={3} value={a.private_notes || ''} onChange={(e) => update({ private_notes: e.target.value })} placeholder="Observaciones de la presentación, recordatorios…" />
              </label>
              <div className="card closing-card">
                <ScoreRing value={stats.score} size={96} />
                <div>
                  <strong className={`tone-text-${lv.tone}`}>{lv.label}</strong>
                  <p className="muted small">{stats.total - stats.evaluated > 0 ? `Quedan ${stats.total - stats.evaluated} criterios sin evaluar.` : 'Todos los criterios están evaluados.'}</p>
                </div>
                <button className="btn btn-primary btn-lg" onClick={() => setShowQr(true)}><QrCode size={20} aria-hidden="true" /> {a.status === 'published' ? 'Ver QR' : 'Publicar informe'}</button>
              </div>
              <button className="btn btn-danger-ghost" onClick={remove}><Trash2 size={18} aria-hidden="true" /> Eliminar análisis</button>
            </div>
          )}

          <div className="pager">
            {idx > 0 ? <button className="btn btn-secondary btn-lg" onClick={() => go(sections[idx - 1].id)}><ArrowLeft size={20} aria-hidden="true" /> {sections[idx - 1].title}</button> : <span />}
            {idx < sections.length - 1 && <button className="btn btn-primary btn-lg" onClick={() => go(sections[idx + 1].id)}>{sections[idx + 1].title} <ArrowRight size={20} aria-hidden="true" /></button>}
          </div>
        </section>
      </div>

      {showQr && <QrModal analysis={a} onClose={() => setShowQr(false)} onTogglePublish={togglePublish} busy={publishing} />}
    </div>
  )
}
