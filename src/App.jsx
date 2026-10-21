import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import AdminDashboard from './pages/admin/AdminDashboard'
import Team from './pages/admin/Team'
import SalesDashboard from './pages/sales/SalesDashboard'
import FollowUps from './pages/sales/FollowUps'
import Leads from './pages/shared/Leads'
import Customers from './pages/shared/Customers'
import Sales from './pages/shared/Sales'

function Loader() {
  return (
    <div className="fullscreen-center">
      <div className="spinner" />
    </div>
  )
}

function RequireRole({ role, children }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <Loader />
  if (!session || !profile) return <Navigate to="/login" replace />
  if (profile.role !== role) return <Navigate to={profile.role === 'admin' ? '/admin' : '/sales'} replace />
  return children
}

function Home() {
  const { session, profile, loading } = useAuth()
  if (loading) return <Loader />
  if (!session || !profile) return <Navigate to="/login" replace />
  return <Navigate to={profile.role === 'admin' ? '/admin' : '/sales'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/admin"
        element={
          <RequireRole role="admin">
            <Layout />
          </RequireRole>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="customers" element={<Customers />} />
        <Route path="sales" element={<Sales />} />
        <Route path="team" element={<Team />} />
      </Route>
      <Route
        path="/sales"
        element={
          <RequireRole role="sales">
            <Layout />
          </RequireRole>
        }
      >
        <Route index element={<SalesDashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="follow-ups" element={<FollowUps />} />
        <Route path="customers" element={<Customers />} />
        <Route path="sales" element={<Sales />} />
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
