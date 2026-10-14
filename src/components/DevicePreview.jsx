import { useEffect, useRef, useState } from 'react'

const DEVICES = [
  { id: 'mobile', label: 'Celular', w: 390, h: 844 },
  { id: 'tablet', label: 'Tablet', w: 820, h: 1180 },
  { id: 'desktop', label: 'Escritorio', w: 1440, h: 900 },
]

// Muestra la web dentro de un iframe al ancho real del dispositivo, escalado para caber.
// Algunos sitios bloquean iframes (X-Frame-Options); en ese caso se ofrece abrir en pestaña nueva.
export default function DevicePreview({ url }) {
  const [device, setDevice] = useState(DEVICES[0])
  const [open, setOpen] = useState(false)
  const [scale, setScale] = useState(1)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!open || !boxRef.current) return
    const el = boxRef.current
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / device.w)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, device])

  if (!url) return null

  return (
    <div className="card device-preview">
      <div className="device-preview-head">
        <h3 className="card-title">Vista previa por dispositivo</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>{open ? 'Ocultar' : 'Mostrar'}</button>
      </div>
      {open && (
        <>
          <div className="segmented">
            {DEVICES.map((d) => (
              <button key={d.id} className={d.id === device.id ? 'active' : ''} onClick={() => setDevice(d)}>
                {d.label} <span className="muted small">{d.w}px</span>
              </button>
            ))}
          </div>
          <div ref={boxRef} className="frame-box" style={{ height: Math.min(device.h, 900) * scale }}>
            <iframe
              key={device.id}
              title={`Vista ${device.label}`}
              src={url}
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              style={{ width: device.w, height: Math.min(device.h, 900), transform: `scale(${scale})` }}
            />
          </div>
          <p className="small muted">
            ¿No carga? Algunos hosts bloquean la vista embebida. <a href={url} target="_blank" rel="noreferrer">Abrir en pestaña nueva ↗</a>
          </p>
        </>
      )}
    </div>
  )
}
