import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Users, DollarSign, Trophy } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { fmtDate, matches, money } from '../../lib/format'
import { Empty, ErrorNote, Loading, StatCard } from '../../components/ui'

const OPEN = ['New', 'Contacted', 'Interested']

export default function Team() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    const [p, l, c, s] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('leads').select('assigned_to, status'),
      supabase.from('customers').select('owner_id'),
      supabase.from('sales').select('sales_exec_id, amount'),
    ])
    const err = p.error || l.error || c.error || s.error
    if (err) return setError(err.message)
    setData({ profiles: p.data, leads: l.data, customers: c.data, sales: s.data })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => {
    if (!data) return []
    return data.profiles
      .map((p) => {
        const leads = data.leads.filter((l) => l.assigned_to === p.id)
        const converted = leads.filter((l) => l.status === 'Converted').length
        const sales = data.sales.filter((s) => s.sales_exec_id === p.id)
        return {
          ...p,
          assigned: leads.length,
          open: leads.filter((l) => OPEN.includes(l.status)).length,
          converted,
          lost: leads.filter((l) => l.status === 'Lost').length,
          rate: leads.length ? Math.round((converted / leads.length) * 100) : 0,
          customers: data.customers.filter((c) => c.owner_id === p.id).length,
          deals: sales.length,
          revenue: sales.reduce((sum, s) => sum + Number(s.amount), 0),
        }
      })
      .sort((a, b) => b.revenue - a.revenue)
  }, [data])

  const changeRole = async (p, role) => {
    if (!window.confirm(`Change ${p.full_name || p.email} to ${role === 'admin' ? 'Admin' : 'Sales Executive'}?`)) return
    const { error } = await supabase.from('profiles').update({ role }).eq('id', p.id)
    if (error) setError(error.message)
    load()
  }

  if (!data) return error ? <ErrorNote error={error} /> : <Loading />

  const sellers = rows.filter((r) => r.role === 'sales')
  const filtered = rows.filter((r) => matches(query, r.full_name, r.email))
  const top = sellers[0]

  return (
    <div className="page">
      <div className="stats-grid three">
        <StatCard label="Sales executives" value={sellers.length} icon={Users} tone="indigo" />
        <StatCard label="Team revenue" value={money(rows.reduce((s, r) => s + r.revenue, 0))} icon={DollarSign} tone="green" />
        <StatCard
          label="Top performer"
          value={top && top.revenue > 0 ? top.full_name || top.email : '—'}
          icon={Trophy}
          tone="amber"
          hint={top && top.revenue > 0 ? money(top.revenue) : 'No sales yet'}
        />
      </div>

      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input placeholder="Search team…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <ErrorNote error={error} />

      <div className="card">
        {filtered.length === 0 ? (
          <Empty>No team members found. Sales executives appear here once they sign up.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th className="num">Assigned</th>
                  <th className="num">Open</th>
                  <th className="num">Converted</th>
                  <th>Conversion</th>
                  <th className="num">Customers</th>
                  <th className="num">Deals</th>
                  <th className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="strong">{r.full_name || '—'}</div>
                      <div className="sub">
                        {r.email} · joined {fmtDate(r.created_at)}
                      </div>
                    </td>
                    <td>
                      {r.id === user.id ? (
                        <span className="badge">Admin (you)</span>
                      ) : (
                        <select className="inline-select" value={r.role} onChange={(e) => changeRole(r, e.target.value)}>
                          <option value="sales">Sales Executive</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                    </td>
                    <td className="num">{r.assigned}</td>
                    <td className="num">{r.open}</td>
                    <td className="num">{r.converted}</td>
                    <td>
                      <div className="mini-bar">
                        <div style={{ width: `${r.rate}%` }} />
                      </div>
                      <span className="sub">{r.rate}%</span>
                    </td>
                    <td className="num">{r.customers}</td>
                    <td className="num">{r.deals}</td>
                    <td className="num strong">{money(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
