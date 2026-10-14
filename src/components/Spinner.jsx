export default function Spinner({ full, label = 'Cargando…' }) {
  return (
    <div className={full ? 'spinner-full' : 'spinner-inline'} role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
