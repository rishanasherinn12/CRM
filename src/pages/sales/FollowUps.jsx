import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Search, Trash2, Undo2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fmtDate, matches, today } from '../../lib/format'
import { Empty, ErrorNote, Loading, StatusBadge } from '../../components/ui'

const TABS = {
  overdue: { label: 'Overdue', test: (f, t) => !f.completed && f.due_date < t },
  today: { label: 'Today', test: (f, t) => !f.completed && f.due_date === t },
  upcoming: { label: 'Upcoming', test: (f, t) => !f.completed && f.due_date > t },
  completed: { label: 'Completed', test: (f) => f.completed },
  all: { label: 'All', test: () => true },
}

export default function FollowUps() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('today')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('follow_ups')
      .select('*, lead:leads(id, name, company, status, phone, email)')
      .order('due_date')
    if (error) setError(error.message)
    setItems(data || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const t = today()
  const counts = useMemo(
    () => Object.fromEntries(Object.entries(TABS).map(([k, v]) => [k, (items || []).filter((f) => v.test(f, t)).length])),
    [items, t]
  )
  const filtered = (items || []).filter((f) => TABS[tab].test(f, t) && matches(query, f.note, f.lead?.name, f.lead?.company))

  const toggle = async (f) => {
    const { error } = await supabase.from('follow_ups').update({ completed: !f.completed }).eq('id', f.id)
    if (error) setError(error.message)
    load()
  }

  const remove = async (f) => {
    if (!window.confirm('Delete this follow-up?')) return
    const { error } = await supabase.from('follow_ups').delete().eq('id', f.id)
    if (error) setError(error.message)
    load()
  }

  if (!items) return <Loading />

  return (
    <div className="page">
      <div className="tabs">
        {Object.entries(TABS).map(([k, v]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {v.label} <span className="count">{counts[k]}</span>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input placeholder="Search follow-ups…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      <p className="muted small">Schedule new follow-ups from a lead’s detail view on the My Leads page.</p>

      <ErrorNote error={error} />

      <div className="card">
        {filtered.length === 0 ? (
          <Empty>Nothing here.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Due</th>
                  <th>Lead</th>
                  <th>Note</th>
                  <th>Lead status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.id} className={f.completed ? 'row-done' : ''}>
                    <td className={!f.completed && f.due_date < t ? 'overdue' : ''}>{fmtDate(f.due_date)}</td>
                    <td>
                      <div className="strong">{f.lead?.name}</div>
                      <div className="sub">{f.lead?.phone || f.lead?.email || f.lead?.company}</div>
                    </td>
                    <td>{f.note || '—'}</td>
                    <td>{f.lead && <StatusBadge status={f.lead.status} />}</td>
                    <td className="actions">
                      <button className="icon-btn" title={f.completed ? 'Mark as pending' : 'Mark as done'} onClick={() => toggle(f)}>
                        {f.completed ? <Undo2 size={16} /> : <Check size={16} />}
                      </button>
                      <button className="icon-btn danger" title="Delete" onClick={() => remove(f)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
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
