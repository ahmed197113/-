import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Setup from './pages/Setup'
import DashboardPage from './pages/Dashboard'
import ComingSoon from './pages/ComingSoon'

function Routed() {
  const { user, ready, status } = useAuth()
  if (!ready) return <div className="splash"><img src="/logo.png" alt="" /></div>
  if (!user) return status?.needsSetup ? <Setup /> : <Login />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path=":section" element={<ComingSoon />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routed />
      </BrowserRouter>
    </AuthProvider>
  )
}
