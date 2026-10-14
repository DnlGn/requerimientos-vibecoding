import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { session } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  if (session) return <Navigate to={location.state?.from || '/'} replace />

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const fn = mode === 'login' ? supabase.auth.signInWithPassword : supabase.auth.signUp
    const { data, error } = await fn.call(supabase.auth, { email, password })
    setBusy(false)
    if (error) return setMsg({ type: 'error', text: error.message })
    if (mode === 'signup' && !data.session) setMsg({ type: 'ok', text: 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.' })
  }

  return (
    <div className="center-page login-page">
      <div className="login-hero">
        <span className="brand-mark lg" aria-hidden="true">✓</span>
        <h1>VibeCheck</h1>
        <p>Analiza, anota y entrega informes de proyectos creados con Google AI Studio.</p>
      </div>
      <form className="card narrow" onSubmit={submit}>
        <div className="segmented full" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Iniciar sesión</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Crear cuenta</button>
        </div>
        <label className="field">
          <span>Correo</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {msg && <p className={`alert ${msg.type === 'error' ? 'alert-error' : 'alert-ok'}`}>{msg.text}</p>}
        <button className="btn btn-primary btn-lg full" disabled={busy}>{busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
      </form>
    </div>
  )
}
