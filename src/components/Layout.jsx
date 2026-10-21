import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, UserCheck, DollarSign, Trophy, CalendarClock, LogOut, Menu, X, Activity } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/leads', label: 'Leads', icon: Users },
    { to: '/admin/customers', label: 'Customers', icon: UserCheck },
    { to: '/admin/sales', label: 'Sales', icon: DollarSign },
    { to: '/admin/team', label: 'Sales Team', icon: Trophy },
  ],
  sales: [
    { to: '/sales', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/sales/leads', label: 'My Leads', icon: Users },
    { to: '/sales/follow-ups', label: 'Follow-ups', icon: CalendarClock },
    { to: '/sales/customers', label: 'Customers', icon: UserCheck },
    { to: '/sales/sales', label: 'My Sales', icon: DollarSign },
  ],
}

export default function Layout() {
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const items = NAV[profile.role]
  const current = items.find((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)))

  useEffect(() => setOpen(false), [location.pathname])

  const initials = (profile.full_name || profile.email || '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">
            <Activity size={18} />
          </span>
          <span>Pulse CRM</span>
          <button className="icon-btn sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <div className="role-pill">{profile.role === 'admin' ? 'Admin Portal' : 'Sales Portal'}</div>
        <nav>
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-link">
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user">
            <div className="avatar">{initials}</div>
            <div className="user-meta">
              <div className="user-name">{profile.full_name || 'User'}</div>
              <div className="user-email">{profile.email}</div>
            </div>
          </div>
          <button className="nav-link logout" onClick={signOut}>
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <h1>{current?.label || 'Dashboard'}</h1>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
