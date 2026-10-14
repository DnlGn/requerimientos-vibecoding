import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { isConfigured } from './lib/supabase'
import Layout from './components/Layout'
import Spinner from './components/Spinner'
import SetupNotice from './pages/SetupNotice'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const NewAnalysis = lazy(() => import('./pages/NewAnalysis'))
const AnalysisEditor = lazy(() => import('./pages/AnalysisEditor'))
const PublicReport = lazy(() => import('./pages/PublicReport'))

function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner full />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

export default function App() {
  if (!isConfigured) return <SetupNotice />
  return (
    <Suspense fallback={<Spinner full />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/r/:slug" element={<PublicReport />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="nuevo" element={<NewAnalysis />} />
          <Route path="analisis/:id" element={<AnalysisEditor />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
