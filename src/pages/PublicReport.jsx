import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase, publicReportUrl } from '../lib/supabase'
import { CATEGORIES, STATUS } from '../lib/checklist'
import { computeScore, level } from '../lib/scoring'
import AutoResults from '../components/AutoResults'
import ScoreRing from '../components/ScoreRing'
import Spinner from '../components/Spinner'

const dateFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' })

function Paragraphs({ text }) {
  return text.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)
}

export default function PublicReport() {
  const { slug } = useParams()
  const [r, setR] = useState(undefined)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.rpc('get_public_report', { p_slug: slug }).then(({ data, error }) => {
      if (error) setError(error.message)
      else setR(data?.[0] ?? null)
    })
  }, [slug])

  useEffect(() => {
    if (r) document.title = `Informe · ${r.project_name} | VibeCheck`
    return () => { document.title = 'VibeCheck' }
  }, [r])

  if (error) return <div className="center-page"><p className="alert alert-error">{error}</p></div>
  if (r === undefined) return <Spinner full />
  if (r === null)
    return (
      <div className="center-page">
        <div className="card narrow center">
          <div className="empty-icon" aria-hidden="true">🔒</div>
          <h1>Informe no disponible</h1>
          <p className="muted">Este informe no existe o todavía no ha sido publicado.</p>
        </div>
      </div>
    )

  const evals = r.evaluations || {}
  const stats = computeScore(evals)
  const lv = level(stats.score)
  const url = publicReportUrl(r.share_slug)

  return (
    <div className="report">
      <header className="report-hero">
        <div className="report-hero-inner">
          <div className="report-hero-text">
            <span className="eyebrow">Informe de análisis · VibeCheck</span>
            <h1>{r.project_name}</h1>
            <p className="report-meta">
              {[r.student_name, r.course].filter(Boolean).join(' · ')}
              {r.url && r.mode === 'auto' && (
                <>
                  <br />
                  <a href={r.url} target="_blank" rel="noreferrer">{r.url.replace(/^https?:\/\//, '')} ↗</a>
                </>
              )}
            </p>
            <p className="small report-date">Actualizado el {dateFmt.format(new Date(r.updated_at))}</p>
          </div>
          <div className="report-score">
            <ScoreRing value={stats.score} size={140} stroke={11} label="de 100" />
            <strong className={`tone-text-${lv.tone}`}>{lv.label}</strong>
          </div>
        </div>
      </header>

      <main className="report-body">
        <section className="report-section">
          <h2>Resultado por categoría</h2>
          <div className="cat-bars">
            {CATEGORIES.map((c) => {
              const st = stats.byCategory[c.id]
              const tone = st.score == null ? 'muted' : st.score >= 80 ? 'great' : st.score >= 50 ? 'warn' : 'bad'
              return (
                <a key={c.id} href={`#cat-${c.id}`} className="cat-bar">
                  <span className="cat-bar-label"><span aria-hidden="true">{c.icon}</span> {c.title}</span>
                  <span className="bar"><span className={`bar-fill tone-${tone}`} style={{ width: `${st.score ?? 0}%` }} /></span>
                  <strong className="cat-bar-value">{st.score ?? '—'}</strong>
                </a>
              )
            })}
          </div>
        </section>

        {(r.strengths || r.improvements || r.general_notes) && (
          <section className="report-section feedback-grid">
            {r.strengths && <div className="card feedback good"><h3>💪 Fortalezas</h3><Paragraphs text={r.strengths} /></div>}
            {r.improvements && <div className="card feedback next"><h3>🎯 Próximos pasos</h3><Paragraphs text={r.improvements} /></div>}
            {r.general_notes && <div className="card feedback"><h3>💬 Comentario general</h3><Paragraphs text={r.general_notes} /></div>}
          </section>
        )}

        {r.auto_results && (
          <section className="report-section">
            <h2>Análisis automático</h2>
            <AutoResults results={r.auto_results} />
          </section>
        )}

        <section className="report-section">
          <h2>Detalle de la evaluación</h2>
          {CATEGORIES.map((c) => (
            <div key={c.id} id={`cat-${c.id}`} className="card report-cat">
              <div className="report-cat-head">
                <h3><span aria-hidden="true">{c.icon}</span> {c.title}</h3>
                <span className="chip">{stats.byCategory[c.id].score ?? '—'}/100</span>
              </div>
              <p className="muted small">{c.summary}</p>
              <ul className="report-criteria">
                {c.criteria.map((cr) => {
                  const e = evals[cr.id] || {}
                  return (
                    <li key={cr.id} className={`rc status-${e.status || 'none'}`}>
                      <span className="rc-badge">{e.status ? STATUS[e.status].label : 'Sin evaluar'}</span>
                      <div className="rc-body">
                        <strong>{cr.title}</strong>
                        {e.autoDetail && <span className="small muted">{e.autoDetail}</span>}
                        {e.note && <p className="rc-note">{e.note}</p>}
                        {(e.status === 'fail' || e.status === 'partial') && <details className="small"><summary>¿Cómo mejorarlo?</summary><p>{cr.help}</p></details>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </section>

        <footer className="report-footer">
          <div className="qr-box small-qr"><QRCodeSVG value={url} size={112} marginSize={1} /></div>
          <div>
            <p className="small muted">Escanea para abrir este informe</p>
            <p className="small">{url.replace(/^https?:\/\//, '')}</p>
            <button className="btn btn-secondary no-print" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
          </div>
        </footer>
      </main>
    </div>
  )
}
