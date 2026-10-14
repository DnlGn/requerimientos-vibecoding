import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ExternalLink, Lock, MessageCircle, Printer, Target, ThumbsUp } from 'lucide-react'
import { supabase, publicReportUrl } from '../lib/supabase'
import { CATEGORIES, STATUS } from '../lib/checklist'
import { computeScore, level } from '../lib/scoring'
import AutoResults from '../components/AutoResults'
import ScoreRing from '../components/ScoreRing'
import Spinner from '../components/Spinner'

const STATUS_ORDER = ['fail', 'partial', 'pass', 'na']
const dateFmt =new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' })

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
          <Lock size={48} strokeWidth={1.5} className="empty-icon" aria-hidden="true" />
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
                  <a href={r.url} target="_blank" rel="noreferrer" className="icon-link">{r.url.replace(/^https?:\/\//, '')} <ExternalLink size={16} aria-hidden="true" /></a>
                </>
              )}
            </p>
            <p className="small report-date">Actualizado el {dateFmt.format(new Date(r.updated_at))}</p>
          </div>
          <div className="report-score">
            <ScoreRing value={stats.score} size={140} stroke={11} label="de 100" />
            <strong className={`tone-text-${lv.tone}`}>{lv.label}</strong>
            {stats.evaluated < stats.total && (
              <span className="partial-note">Evaluación parcial: {stats.evaluated} de {stats.total} criterios</span>
            )}
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
                  <span className="cat-bar-label"><c.icon size={18} aria-hidden="true" /> {c.title}</span>
                  <span className="bar"><span className={`bar-fill tone-${tone}`} style={{ width: `${st.score ?? 0}%` }} /></span>
                  <strong className="cat-bar-value">{st.score ?? '—'}</strong>
                </a>
              )
            })}
          </div>
        </section>

        {(r.strengths || r.improvements || r.general_notes) && (
          <section className="report-section feedback-grid">
            {r.strengths && <div className="card feedback good"><h3 className="icon-heading"><ThumbsUp size={20} aria-hidden="true" /> Fortalezas</h3><Paragraphs text={r.strengths} /></div>}
            {r.improvements && <div className="card feedback next"><h3 className="icon-heading"><Target size={20} aria-hidden="true" /> Próximos pasos</h3><Paragraphs text={r.improvements} /></div>}
            {r.general_notes && <div className="card feedback"><h3 className="icon-heading"><MessageCircle size={20} aria-hidden="true" /> Comentario general</h3><Paragraphs text={r.general_notes} /></div>}
          </section>
        )}

        {r.auto_results && (
          <section className="report-section">
            <h2>Análisis automático</h2>
            <AutoResults results={r.auto_results} showErrors={false} />
          </section>
        )}

        <section className="report-section">
          <h2>Detalle de la evaluación</h2>
          {CATEGORIES.map((c) => {
            // Primero lo que hay que corregir; los criterios sin evaluar no se muestran.
            const shown = c.criteria
              .filter((cr) => evals[cr.id]?.status)
              .sort((x, y) => STATUS_ORDER.indexOf(evals[x.id].status) - STATUS_ORDER.indexOf(evals[y.id].status))
            const pending = c.criteria.length - shown.length
            return (
              <div key={c.id} id={`cat-${c.id}`} className="card report-cat">
                <div className="report-cat-head">
                  <h3 className="icon-heading"><c.icon size={22} aria-hidden="true" /> {c.title}</h3>
                  <span className="chip">{stats.byCategory[c.id].score ?? '—'}/100</span>
                </div>
                <p className="muted small">{c.summary}</p>
                {shown.length === 0 && <p className="small muted">Esta categoría aún no ha sido evaluada.</p>}
                <ul className="report-criteria">
                  {shown.map((cr) => {
                    const e = evals[cr.id]
                    return (
                      <li key={cr.id} className={`rc status-${e.status || 'none'}`}>
                        <span className="rc-badge">{STATUS[e.status].label}</span>
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
                {shown.length > 0 && pending > 0 && <p className="small muted pending-note">{pending} criterio(s) de esta categoría sin evaluar.</p>}
              </div>
            )
          })}
        </section>

        <footer className="report-footer">
          <div className="qr-box small-qr"><QRCodeSVG value={url} size={112} marginSize={1} /></div>
          <div>
            <p className="small muted">Escanea para abrir este informe</p>
            <p className="small">{url.replace(/^https?:\/\//, '')}</p>
            <button className="btn btn-secondary no-print" onClick={() => window.print()}><Printer size={18} aria-hidden="true" /> Imprimir / Guardar PDF</button>
          </div>
        </footer>
      </main>
    </div>
  )
}
