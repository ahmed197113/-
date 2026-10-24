import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth'
import { Icon } from '../icons'
import { NAV } from '../nav'
import { Toaster } from '../ui'

export default function Layout() {
  const { user, logout, status } = useAuth()
  const [open, setOpen] = useState(false)

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
