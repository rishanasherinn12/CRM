import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, UserCheck, DollarSign, Percent } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { LEAD_STATUSES, fmtDate, money } from '../../lib/format'
import { Empty, ErrorNote, Loading, StatCard, StatusBadge, StatusBars } from '../../components/ui'

const lastMonths = (n) => {
  const out = []
  const d = new Date()
  d.setDate(1)
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push({ key: m.toLocaleDateString('en-CA').slice(0, 7), label: m.toLocaleDateString(undefined, { month: 'short' }) })
  }
  return out
}

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      supabase
        .from('leads')
        .select('id, name, company, status, value, created_at, assignee:profiles!leads_assigned_to_fkey(full_name, email)')
        .order('created_at', { ascending: false }),
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('sales').select('amount, sale_date, sales_exec_id, exec:profiles(full_name, email)'),
    ]).then(([l, c, s]) => {
      const err = l.error || c.error || s.error
      if (err) return setError(err.message)
      setData({ leads: l.data, customers: c.count || 0, sales: s.data })
    })
  }, [])

  if (error) return <ErrorNote error={error} />
  if (!data) return <Loading />

  const { leads, customers, sales } = data
  const revenue = sales.reduce((sum, s) => sum + Number(s.amount), 0)
  const counts = Object.fromEntries(LEAD_STATUSES.map((s) => [s, leads.filter((l) => l.status === s).length]))
  const conversion = leads.length ? Math.round((counts.Converted / leads.length) * 100) : 0
  const unassigned = leads.filter((l) => !l.assignee).length

  const months = lastMonths(6).map((m) => ({
    ...m,
    total: sales.filter((s) => s.sale_date.startsWith(m.key)).reduce((sum, s) => sum + Number(s.amount), 0),
  }))
  const maxMonth = Math.max(...months.map((m) => m.total), 1)

  const byExec = Object.values(
    sales.reduce((acc, s) => {
      const k = s.sales_exec_id || 'none'
      acc[k] ||= { name: s.exec?.full_name || s.exec?.email || 'Unknown', total: 0, count: 0 }
      acc[k].total += Number(s.amount)
      acc[k].count += 1
      return acc
    }, {})
  )
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  return (
    <div className="page">
      <div className="stats-grid">
        <StatCard label="Total leads" value={leads.length} icon={Users} tone="indigo" hint={`${unassigned} unassigned`} />
        <StatCard label="Customers" value={customers} icon={UserCheck} tone="sky" />
        <StatCard label="Total sales" value={money(revenue)} icon={DollarSign} tone="green" hint={`${sales.length} deals closed`} />
        <StatCard label="Conversion rate" value={`${conversion}%`} icon={Percent} tone="amber" hint={`${counts.Converted} converted`} />
      </div>

      <div className="grid-2">
        <div className="card padded">
          <div className="card-head">
            <h3>Revenue — last 6 months</h3>
          </div>
          <div className="columns">
            {months.map((m) => (
              <div key={m.key} className="column">
                <div className="column-value">{m.total ? money(m.total) : ''}</div>
                <div className="column-track">
                  <div className="column-fill" style={{ height: `${(m.total / maxMonth) * 100}%` }} />
                </div>
                <div className="column-label">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card padded">
          <div className="card-head">
            <h3>Leads by status</h3>
            <Link to="/admin/leads">View all</Link>
          </div>
          <StatusBars counts={counts} total={leads.length} />
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head padded-x">
            <h3>Recent leads</h3>
            <Link to="/admin/leads">Manage leads</Link>
          </div>
          {leads.length === 0 ? (
            <Empty>No leads yet.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <tbody>
                  {leads.slice(0, 6).map((l) => (
                    <tr key={l.id}>
                      <td>
                        <div className="strong">{l.name}</div>
                        <div className="sub">{l.company || fmtDate(l.created_at)}</div>
                      </td>
                      <td className="sub">{l.assignee?.full_name || l.assignee?.email || 'Unassigned'}</td>
                      <td className="right">
                        <StatusBadge status={l.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-head padded-x">
            <h3>Top performers</h3>
            <Link to="/admin/team">Sales team</Link>
          </div>
          {byExec.length === 0 ? (
            <Empty>No sales recorded yet.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <tbody>
                  {byExec.map((e, i) => (
                    <tr key={e.name + i}>
                      <td>
                        <span className="rank">{i + 1}</span> <span className="strong">{e.name}</span>
                      </td>
                      <td className="sub">{e.count} deals</td>
                      <td className="num strong">{money(e.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
