import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth'
import { Icon } from '../icons'
import { NAV } from '../nav'
import { Toaster } from '../ui'

// Opened inside the custody app (it shows its own menu, logo and account): no second sidebar,
// just the sections as a slim bar on top so it feels like one system.
const EMBEDDED = (() => { try { return window.self !== window.top } catch { return true } })()
if (EMBEDDED) document.documentElement.classList.add('embedded')

export default function Layout() {
  const { user, logout, status } = useAuth()
  const [open, setOpen] = useState(false)

  if (EMBEDDED) return (
    <div className="shell embedded">
      <nav className="topnav">
        {NAV.map((n) => (
          <NavLink key={n.path} to={n.path} end={n.path === '/'} className={({ isActive }) => `top-item ${isActive ? 'active' : ''}`}>
            <Icon name={n.icon} size={18} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="content">
        <Outlet />
      </main>
      <Toaster />
    </div>
  )

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <img src="/logo.png" alt="" />
          <div>
            <strong>المشاريع</strong>
            <span>{status?.companyName ?? 'الخطوط المعدنية'}</span>
          </div>
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.path} to={n.path} end={n.path === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="me">
          <div className="avatar"><Icon name="user" /></div>
          <div className="me-text">
            <strong>{user!.name}</strong>
            <span>{user!.roleLabel}</span>
          </div>
          <button className="icon-btn" onClick={logout} title="تسجيل الخروج"><Icon name="logout" /></button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <main className="content">
        <button className="menu-btn" onClick={() => setOpen(true)} aria-label="القائمة"><Icon name="menu" size={26} /></button>
        <Outlet />
      </main>
      <Toaster />
    </div>
  )
}
