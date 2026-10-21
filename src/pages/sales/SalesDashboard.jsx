import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Target, CheckCircle2, DollarSign } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { LEAD_STATUSES, daysFromToday, fmtDate, money, today } from '../../lib/format'
import { Empty, ErrorNote, Loading, StatCard, StatusBars } from '../../components/ui'

export default function SalesDashboard() {
  const { profile } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    // RLS limits every query below to this executive's own records.
    Promise.all([
      supabase.from('leads').select('id, status'),
      supabase
        .from('follow_ups')
        .select('id, due_date, note, lead:leads(id, name, company)')
        .eq('completed', false)
        .lte('due_date', daysFromToday(7))
        .order('due_date'),
      supabase.from('sales').select('id, amount, sale_date, product, customer:customers(name)').order('sale_date', { ascending: false }),
    ]).then(([l, f, s]) => {
      const err = l.error || f.error || s.error
      if (err) return setError(err.message)
      setData({ leads: l.data, followUps: f.data, sales: s.data })
    })
  }, [])

  if (error) return <ErrorNote error={error} />
  if (!data) return <Loading />

  const { leads, followUps, sales } = data
  const counts = Object.fromEntries(LEAD_STATUSES.map((s) => [s, leads.filter((l) => l.status === s).length]))
  const open = counts.New + counts.Contacted + counts.Interested
  const revenue = sales.reduce((sum, s) => sum + Number(s.amount), 0)
  const monthStart = today().slice(0, 8) + '01'
  const monthRevenue = sales.filter((s) => s.sale_date >= monthStart).reduce((sum, s) => sum + Number(s.amount), 0)
  const firstName = (profile.full_name || '').split(' ')[0]

  return (
    <div className="page">
      <p className="greeting">Welcome back{firstName ? `, ${firstName}` : ''}. Here’s your pipeline today.</p>
      <div className="stats-grid">
        <StatCard label="Assigned leads" value={leads.length} icon={Users} tone="indigo" />
        <StatCard label="Open leads" value={open} icon={Target} tone="sky" hint={`${counts.Interested} interested`} />
        <StatCard label="Converted" value={counts.Converted} icon={CheckCircle2} tone="amber" hint={`${counts.Lost} lost`} />
        <StatCard label="My sales" value={money(revenue)} icon={DollarSign} tone="green" hint={`${money(monthRevenue)} this month`} />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head padded-x">
            <h3>Follow-ups due (next 7 days)</h3>
            <Link to="/sales/follow-ups">View all</Link>
          </div>
          {followUps.length === 0 ? (
            <Empty>You’re all caught up.</Empty>
          ) : (
            <ul className="timeline padded-x">
              {followUps.map((f) => (
                <li key={f.id} className={f.due_date < today() ? 'overdue' : ''}>
                  <div>
                    <div className="strong">{f.lead?.name}</div>
                    <div className="sub">{f.note || f.lead?.company || 'No note'}</div>
                  </div>
                  <span className="date-tag">{f.due_date < today() ? 'Overdue · ' : ''}{fmtDate(f.due_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card padded">
          <div className="card-head">
            <h3>My leads by status</h3>
            <Link to="/sales/leads">Manage</Link>
          </div>
          <StatusBars counts={counts} total={leads.length} />
        </div>
      </div>

      <div className="card">
        <div className="card-head padded-x">
          <h3>Recent sales</h3>
          <Link to="/sales/sales">Record a sale</Link>
        </div>
        {sales.length === 0 ? (
          <Empty>No sales yet. Convert a lead and record your first sale.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <tbody>
                {sales.slice(0, 5).map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="strong">{s.product}</div>
                      <div className="sub">{s.customer?.name || '—'}</div>
                    </td>
                    <td className="sub">{fmtDate(s.sale_date)}</td>
                    <td className="num strong">{money(s.amount)}</td>
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
