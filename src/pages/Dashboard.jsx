import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { level } from '../lib/scoring'
import ScoreRing from '../components/ScoreRing'
import Spinner from '../components/Spinner'

const dateFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })

export default function Dashboard() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [course, setCourse] = useState('')
  const [status, setStatus] = useState('all')

  useEffect(() => {
    supabase
      .from('analyses')
      .select('id, project_name, student_name, course, url, mode, status, score, share_slug, updated_at')
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => (error ? setError(error.message) : setItems(data)))
  }, [])

  const courses = useMemo(() => [...new Set((items || []).map((i) => i.course).filter(Boolean))].sort(), [items])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (items || []).filter(
      (i) =>
        (!term || [i.project_name, i.student_name, i.url].some((v) => v?.toLowerCase().includes(term))) &&
        (!course || i.course === course) &&
        (status === 'all' || i.status === status),
    )
  }, [items, q, course, status])

  const stats = useMemo(() => {
    const list = items || []
    const scored = list.filter((i) => i.score != null)
    return {
      total: list.length,
      published: list.filter((i) => i.status === 'published').length,
      avg: scored.length ? Math.round(scored.reduce((s, i) => s + Number(i.score), 0) / scored.length) : null,
    }
  }, [items])

  if (error) return <div className="page"><p className="alert alert-error">{error}</p></div>
  if (!items) return <Spinner />

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Proyectos analizados</h1>
          <p className="muted">
            {stats.total} análisis · {stats.published} publicados{stats.avg != null && ` · promedio ${stats.avg}/100`}
          </p>
        </div>
        <Link to="/nuevo" className="btn btn-primary btn-lg">+ Nuevo análisis</Link>
      </div>

      {items.length > 0 && (
        <div className="filters">
          <input type="search" className="input" placeholder="Buscar proyecto, alumno o URL…" value={q} onChange={(e) => setQ(e.target.value)} />
          {courses.length > 0 && (
            <select className="input" value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">Todos los cursos</option>
              {courses.map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
          <div className="segmented">
            {[['all', 'Todos'], ['draft', 'Borradores'], ['published', 'Publicados']].map(([v, l]) => (
              <button key={v} className={status === v ? 'active' : ''} onClick={() => setStatus(v)}>{l}</button>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty card">
          <div className="empty-icon" aria-hidden="true">🧪</div>
          <h2>Aún no hay análisis</h2>
          <p className="muted">Crea el primero con el link del proyecto, o hazlo solo con anotaciones manuales.</p>
          <Link to="/nuevo" className="btn btn-primary btn-lg">Comenzar</Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="muted center">Ningún proyecto coincide con los filtros.</p>
      ) : (
        <ul className="project-grid">
          {filtered.map((i) => {
            const score = i.score == null ? null : Math.round(Number(i.score))
            const lv = level(score)
            return (
              <li key={i.id}>
                <Link to={`/analisis/${i.id}`} className="project-card card">
                  <ScoreRing value={score} size={64} stroke={6} />
                  <div className="project-card-body">
                    <h3>{i.project_name}</h3>
                    <p className="muted small">{[i.student_name, i.course].filter(Boolean).join(' · ') || 'Sin alumno asignado'}</p>
                    <p className="small truncate">{i.url ? i.url.replace(/^https?:\/\//, '') : 'Análisis manual (sin link)'}</p>
                    <div className="chips">
                      <span className={`chip ${i.status === 'published' ? 'chip-ok' : ''}`}>{i.status === 'published' ? 'Publicado' : 'Borrador'}</span>
                      <span className={`chip tone-${lv.tone}`}>{lv.label}</span>
                      <span className="chip chip-plain">{dateFmt.format(new Date(i.updated_at))}</span>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
