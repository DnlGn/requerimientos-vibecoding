import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { session } = useAuth()
  const navigate = useNavigate()

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="Inicio">
          <span className="brand-mark" aria-hidden="true">✓</span>
          <span className="brand-name">VibeCheck</span>
        </NavLink>
        <nav className="topbar-nav">
          <NavLink to="/" end className="nav-link">Proyectos</NavLink>
          <NavLink to="/nuevo" className="btn btn-primary btn-sm">+ Nuevo análisis</NavLink>
          <button className="btn btn-ghost btn-sm" onClick={logout} title={session?.user?.email}>Salir</button>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
