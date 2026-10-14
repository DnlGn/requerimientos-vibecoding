import { useEffect, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { publicReportUrl } from '../lib/supabase'

export default function QrModal({ analysis, onClose, onTogglePublish, busy }) {
  const ref = useRef(null)
  const [copied, setCopied] = useState(false)
  const url = publicReportUrl(analysis.share_slug)
  const published = analysis.status === 'published'

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function download() {
    const canvas = ref.current?.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `qr-${analysis.project_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
    a.click()
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard no disponible */ }
  }

  async function share() {
    try {
      await navigator.share({ title: `Informe · ${analysis.project_name}`, url })
    } catch { /* cancelado */ }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="qr-title" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        <h2 id="qr-title">Informe de {analysis.project_name}</h2>

        {!published ? (
          <>
            <p className="muted">El informe aún es un borrador. Al publicarlo se genera un link y un QR que cualquiera puede abrir (sin tus notas privadas).</p>
            <button className="btn btn-primary btn-lg full" onClick={onTogglePublish} disabled={busy}>{busy ? 'Publicando…' : 'Publicar y generar QR'}</button>
          </>
        ) : (
          <>
            <div ref={ref} className="qr-box">
              <QRCodeCanvas value={url} size={240} marginSize={2} level="M" />
            </div>
            <p className="qr-url"><a href={url} target="_blank" rel="noreferrer">{url.replace(/^https?:\/\//, '')}</a></p>
            <div className="qr-actions">
              <button className="btn btn-primary" onClick={download}>Descargar QR</button>
              <button className="btn btn-secondary" onClick={copy}>{copied ? '¡Copiado!' : 'Copiar link'}</button>
              {typeof navigator.share === 'function' && <button className="btn btn-secondary" onClick={share}>Compartir</button>}
              <a className="btn btn-secondary" href={url} target="_blank" rel="noreferrer">Abrir informe</a>
            </div>
            <button className="btn btn-ghost btn-sm full" onClick={onTogglePublish} disabled={busy}>Despublicar (el link dejará de funcionar)</button>
          </>
        )}
      </div>
    </div>
  )
}
