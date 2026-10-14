import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutGrid, LogOut, Plus, ScanSearch } from 'lucide-react'
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
          <span className="brand-mark" aria-hidden="true"><ScanSearch size={20} strokeWidth={2.5} /></span>
          <span className="brand-name">VibeCheck</span>
        </NavLink>
        <nav className="topbar-nav">
          <NavLink to="/" end className="nav-link"><LayoutGrid size={18} aria-hidden="true" /> Proyectos</NavLink>
          <NavLink to="/nuevo" className="btn btn-primary btn-sm"><Plus size={18} aria-hidden="true" /> Nuevo análisis</NavLink>
          <button className="btn btn-ghost btn-sm" onClick={logout} title={session?.user?.email}><LogOut size={18} aria-hidden="true" /> Salir</button>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
