import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Setup from './pages/Setup'
import DashboardPage from './pages/Dashboard'
import ProjectsPage, { ProjectDetailPage } from './pages/Projects'
import WorkersPage from './pages/Workers'
import AttendancePage from './pages/Attendance'
import DailyReportsPage from './pages/DailyReports'
import IssuesPage from './pages/Issues'
import InvoicesPage from './pages/Invoices'
import DirectOrdersPage from './pages/DirectOrders'
import ReportsPage from './pages/Reports'
import SettingsPage from './pages/Settings'
import ProjectReportPage from './pages/ProjectReport'

function Routed() {
  const { user, ready, status } = useAuth()
  if (!ready) return <div className="splash"><img src="/logo.png" alt="" /></div>
  if (!user) return status?.needsSetup ? <Setup /> : <Login />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="projects/:id/report" element={<ProjectReportPage />} />
        <Route path="workers" element={<WorkersPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="daily-reports" element={<DailyReportsPage />} />
        <Route path="issues" element={<IssuesPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="direct-orders" element={<DirectOrdersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routed />
      </HashRouter>
    </AuthProvider>
  )
}

// The host serves unknown paths itself (404), so routes live after "#". Old /path links are moved to /#/path.
if (window.location.pathname !== '/' && !window.location.pathname.startsWith('/api')) {
  window.history.replaceState(null, '', '/#' + window.location.pathname + window.location.search)
}
