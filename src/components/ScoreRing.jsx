import { scoreTone } from '../lib/scoring'

export default function ScoreRing({ value, size = 88, stroke = 8, label, tone }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value))
  const t = tone || scoreTone(value)
  return (
    <div className={`score-ring tone-${t}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="ring-track" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="ring-value"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-text">
        <strong style={{ fontSize: size * 0.28 }}>{value ?? '—'}</strong>
        {label && <span>{label}</span>}
      </div>
    </div>
  )
}
