import { useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronUp, Monitor, Smartphone, X } from 'lucide-react'
import ScoreRing from './ScoreRing'
import { formatMetric, metricTone } from '../lib/scoring'

const SCORE_LABELS = { performance: 'Rendimiento', accessibility: 'Accesibilidad', 'best-practices': 'Buenas prácticas', seo: 'SEO' }
const METRICS = [
  ['lcp', 'LCP', 'Elemento principal visible'],
  ['cls', 'CLS', 'Estabilidad visual'],
  ['tbt', 'TBT', 'Bloqueo por JavaScript'],
  ['fcp', 'FCP', 'Primer contenido'],
  ['si', 'Speed Index', 'Velocidad de carga visual'],
]

const PHASE_LABELS = [
  ['timeToFirstByte', 'Servidor'],
  ['resourceLoadDelay', 'Espera'],
  ['resourceLoadDuration', 'Descarga'],
  ['elementRenderDelay', 'Renderizado'],
]

function LcpBreakdown({ audits }) {
  const { lcpElement: el, lcpPhases: phases } = audits
  if (!el && !phases) return null
  const parts = phases ? PHASE_LABELS.map(([k, l]) => [k, l, phases[k] || 0]).filter(([, , v]) => v > 0) : []
  const total = parts.reduce((n, [, , v]) => n + v, 0)
  return (
    <div className="lcp-box">
      {el && (
        <p className="small">
          <strong>Elemento LCP:</strong> {el.label || el.snippet || el.selector}
          {el.selector && <code className="lcp-selector">{el.selector.split(' > ').pop()}</code>}
        </p>
      )}
      {total > 0 && (
        <>
          <div className="phase-bar" role="img" aria-label={parts.map(([, l, v]) => `${l} ${Math.round((v / total) * 100)}%`).join(', ')}>
            {parts.map(([k, , v]) => <span key={k} className={`phase phase-${k}`} style={{ width: `${(v / total) * 100}%` }} />)}
          </div>
          <ul className="phase-legend">
            {parts.map(([k, l, v]) => (
              <li key={k}><span className={`phase-dot phase-${k}`} aria-hidden="true" />{l} {Math.round((v / total) * 100)} %</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function Device({ data, label, icon: Icon }) {
  if (!data) return null
  return (
    <section className="device-block">
      <h4 className="device-title">
        <Icon size={18} aria-hidden="true" /> {label}
        {data.runs > 1 && (
          <span className="chip chip-plain" title={`Rendimiento en cada medición: ${data.spread.performance.join(', ')}`}>
            Mediana de {data.runs} mediciones{data.analyses > 1 ? ` · ${data.analyses} análisis` : ''}
          </span>
        )}
      </h4>
      <div className="score-row">
        {Object.entries(SCORE_LABELS).map(([k, l]) => (
          <div key={k} className="score-cell">
            <ScoreRing value={data.scores[k]} size={68} stroke={6} />
            <span className="small">{l}</span>
          </div>
        ))}
      </div>
      <div className="metric-grid">
        {METRICS.map(([k, l, d]) => (
          <div key={k} className={`metric tone-${metricTone(k, data.metrics[k])}`}>
            <span className="metric-label">{l}</span>
            <strong className="metric-value">{formatMetric(k, data.metrics[k])}</strong>
            <span className="metric-desc">{d}</span>
          </div>
        ))}
      </div>
      {data.runs > 1 && (
        <p className="small muted">
          Rendimiento por medición: entre {Math.min(...data.spread.performance)} y {Math.max(...data.spread.performance)}. Lighthouse varía entre
          ejecuciones: se usa la mediana de cada métrica y el puntaje se calcula a partir de ellas.
          {data.analyses > 1 && ' Como la página no cambió desde el análisis anterior, se acumulan las mediciones.'}
        </p>
      )}
      {data.unstable && (
        <p className="alert alert-warn small">
          <AlertTriangle size={16} className="inline-icon" aria-hidden="true" />
          Medición inestable: {data.spread.lcp.filter((x) => x > 2500).length} de {data.spread.lcp.length} mediciones tuvieron un LCP sobre 2,5 s
          (entre {formatMetric('lcp', Math.min(...data.spread.lcp))} y {formatMetric('lcp', Math.max(...data.spread.lcp))}).
          A veces el elemento principal se pinta tarde (CSS que bloquea, fuentes, JavaScript o animaciones de entrada).
        </p>
      )}
      <LcpBreakdown audits={data.audits} />
      {data.field && (
        <p className="small muted">
          Datos reales de usuarios{data.field.scope === 'origin' ? ' (todo el dominio)' : ''}, Chrome UX Report: LCP {formatMetric('lcp', data.field.lcp)} · CLS {formatMetric('cls', data.field.cls)} · INP {formatMetric('inp', data.field.inp)}
        </p>
      )}
    </section>
  )
}

function FileRow({ label, file, extra }) {
  const [open, setOpen] = useState(false)
  if (!file) return null
  return (
    <li className={`file-row ${file.exists ? 'ok' : 'missing'}`}>
      <button type="button" className="file-row-head" onClick={() => file.preview && setOpen((o) => !o)} aria-expanded={open} disabled={!file.preview}>
        <span className="file-icon" aria-hidden="true">{file.exists ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}</span>
        <code>{label}</code>
        <span className="small muted file-extra">{file.exists ? extra : file.spaFallback ? 'devuelve el index.html' : 'no encontrado'}</span>
        {file.preview && (open ? <ChevronUp size={18} className="chev" aria-hidden="true" /> : <ChevronDown size={18} className="chev" aria-hidden="true" />)}
      </button>
      {open && <pre className="code-block file-preview">{file.preview}</pre>}
    </li>
  )
}

export default function AutoResults({ results, showErrors = true }) {
  if (!results) return null
  const { site, mobile, desktop, errors = {} } = results
  const shot = mobile?.screenshot || desktop?.screenshot
  const m = site?.meta
  const host = site ? new URL(site.finalUrl).host : ''

  return (
    <div className="auto-results">
      {showErrors && Object.entries(errors).length > 0 && (
        <div className="alert alert-warn">
          {Object.entries(errors).map(([k, v]) => (
            <p key={k}><strong>{{ site: 'Análisis HTML', mobile: 'PageSpeed móvil', desktop: 'PageSpeed escritorio' }[k]}:</strong> {v}</p>
          ))}
        </div>
      )}

      {site?.tech.exposedKeys.length > 0 && (
        <div className={`alert ${site.tech.geminiInClient ? 'alert-error' : 'alert-warn'}`}>
          <AlertTriangle size={18} className="inline-icon" aria-hidden="true" />
          <strong>API key de Google visible en el código público:</strong> {site.tech.exposedKeys.join(', ')}.{' '}
          {site.tech.geminiInClient
            ? 'El sitio llama a Gemini desde el navegador: cualquiera puede copiar la key y gastar la cuota. Hay que revocarla en Google AI Studio y moverla a un backend.'
            : 'Si es una key de Gemini, hay que revocarla y moverla a un backend. Si es de Firebase, es pública por diseño (debe protegerse con reglas de seguridad).'}
        </div>
      )}

      {(mobile || desktop) && (
        <div className="card">
          <h3 className="card-title">Rendimiento y Core Web Vitals</h3>
          <div className="devices">
            <Device data={mobile} label="Celular" icon={Smartphone} />
            <Device data={desktop} label="Escritorio" icon={Monitor} />
          </div>
        </div>
      )}

      <div className="results-split">
        {shot && (
          <div className="card shot-card">
            <h3 className="card-title">Captura móvil</h3>
            <img src={shot} alt="Captura de la página en celular" className="phone-shot" loading="lazy" />
          </div>
        )}

        {site && (
          <div className="card">
            <h3 className="card-title">Así se ve en Google</h3>
            <div className="serp">
              <span className="serp-host">{host}</span>
              <span className="serp-title">{m.title || '(sin título)'}</span>
              <span className="serp-desc">{m.description || 'Sin meta description: Google elegirá un texto cualquiera de la página.'}</span>
            </div>
            <h3 className="card-title">Así se ve al compartir</h3>
            <div className="og-card">
              {m.og.image ? <img src={m.og.image} alt="" loading="lazy" /> : <div className="og-noimg">Sin og:image</div>}
              <div className="og-body">
                <span className="small muted">{host}</span>
                <strong>{m.og.title || m.title || '(sin título)'}</strong>
                <span className="small">{m.og.description || m.description || ''}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {site && (
        <div className="card">
          <h3 className="card-title">Archivos de posicionamiento</h3>
          <ul className="file-list">
            <FileRow label="/llms.txt" file={site.files.llms} extra={`${site.files.llms.lines} líneas`} />
            <FileRow label="/llms-full.txt" file={site.files.llmsFull} extra={`${(site.files.llmsFull.bytes / 1024).toFixed(1)} KB`} />
            <FileRow label="/robots.txt" file={site.files.robots} extra={site.files.robots.analysis?.sitemaps.length ? 'declara sitemap' : ''} />
            <FileRow
              label={site.files.sitemap.exists ? site.files.sitemap.url.replace(/^https?:\/\/[^/]+/, '') : '/sitemap.xml'}
              file={site.files.sitemap}
              extra={site.files.sitemap.isIndex ? `índice · ${site.files.sitemap.urls} sitemaps` : `${site.files.sitemap.urls} URLs`}
            />
            <FileRow label="manifest" file={site.files.manifest} extra={site.files.manifest.data?.name || ''} />
          </ul>
          <dl className="kv">
            <dt>lang</dt><dd>{m.lang || '—'}</dd>
            <dt>viewport</dt><dd>{m.viewport || '—'}</dd>
            <dt>canonical</dt><dd className="truncate">{m.canonical || '—'}</dd>
            <dt>theme-color</dt><dd>{m.themeColor || '—'}</dd>
            <dt>JSON-LD</dt><dd>{m.jsonLd.join(', ') || '—'}</dd>
            <dt>HTML inicial</dt><dd>{site.content.isSpaShell ? 'Vacío (SPA, se renderiza con JS)' : `${site.content.visibleTextLength} caracteres de texto`}</dd>
            <dt>Respuesta servidor</dt><dd>{site.timing.ttfbMs} ms · {(site.response.htmlBytes / 1024).toFixed(1)} KB{site.response.ownJsBytes ? ` · JS ${(site.response.ownJsBytes / 1024).toFixed(0)} KB` : ''}</dd>
          </dl>
        </div>
      )}

      {mobile?.failing.length > 0 && (
        <div className="card">
          <h3 className="card-title">Oportunidades de mejora detectadas (móvil)</h3>
          <ul className="opp-list">
            {mobile.failing.map((f) => (
              <li key={f.id} className={f.score < 0.5 ? 'bad' : 'warn'}>
                <span>{f.title}</span>
                {f.display && <span className="small muted">{f.display}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
