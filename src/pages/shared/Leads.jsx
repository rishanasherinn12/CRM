import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, Eye, CalendarPlus, Check, UserPlus, Undo2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { LEAD_SOURCES, LEAD_STATUSES, fmtDate, matches, money, nextFollowUp, today } from '../../lib/format'
import { Empty, ErrorNote, Field, Loading, Modal, StatusBadge } from '../../components/ui'

const LEAD_SELECT = '*, assignee:profiles!leads_assigned_to_fkey(id, full_name, email), follow_ups(due_date, completed)'

export default function Leads() {
  const { user, profile } = useAuth()
  const isAdmin = profile.role === 'admin'
  const [params] = useSearchParams()

  const [leads, setLeads] = useState([])
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(params.get('status') || '')
  const [assignee, setAssignee] = useState('')

  const [editing, setEditing] = useState(null) // lead object or {} for new
  const [viewing, setViewing] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('leads').select(LEAD_SELECT).order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setLeads(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    if (isAdmin) {
      supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .order('full_name')
        .then(({ data }) => setTeam(data || []))
    }
  }, [load, isAdmin])

  const filtered = useMemo(
    () =>
      leads.filter(
        (l) =>
          matches(query, l.name, l.email, l.phone, l.company) &&
          (!status || l.status === status) &&
          (!assignee || (assignee === 'none' ? !l.assigned_to : l.assigned_to === assignee))
      ),
    [leads, query, status, assignee]
  )

  const update = async (id, patch) => {
    setError('')
    const { error } = await supabase.from('leads').update(patch).eq('id', id)
    if (error) setError(error.message)
    load()
  }

  const remove = async (lead) => {
    if (!window.confirm(`Delete lead "${lead.name}"? This also removes its follow-ups.`)) return
    const { error } = await supabase.from('leads').delete().eq('id', lead.id)
    if (error) setError(error.message)
    load()
  }

  return (
    <div className="page">
      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input placeholder="Search name, email, phone, company…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {isAdmin && (
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">All assignees</option>
            <option value="none">Unassigned</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name || t.email}
              </option>
            ))}
          </select>
        )}
        <button className="btn primary" onClick={() => setEditing({})}>
          <Plus size={16} /> Add lead
        </button>
      </div>

      <ErrorNote error={error} />

      <div className="card">
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <Empty>{leads.length ? 'No leads match your filters.' : 'No leads yet. Add your first lead to get started.'}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Contact</th>
                  <th>Status</th>
                  {isAdmin && <th>Assigned to</th>}
                  <th>Next follow-up</th>
                  <th className="num">Value</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const next = nextFollowUp(l)
                  return (
                    <tr key={l.id}>
                      <td>
                        <button className="link strong" onClick={() => setViewing(l)}>
                          {l.name}
                        </button>
                        <div className="sub">{l.company || '—'}</div>
                      </td>
                      <td>
                        <div>{l.email || '—'}</div>
                        <div className="sub">{l.phone}</div>
                      </td>
                      <td>
                        <select
                          className={`status-select status-${l.status.toLowerCase()}`}
                          value={l.status}
                          onChange={(e) => update(l.id, { status: e.target.value })}
                          aria-label="Lead status"
                        >
                          {LEAD_STATUSES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      {isAdmin && (
                        <td>
                          <select
                            className="inline-select"
                            value={l.assigned_to || ''}
                            onChange={(e) => update(l.id, { assigned_to: e.target.value || null })}
                            aria-label="Assign to"
                          >
                            <option value="">Unassigned</option>
                            {team.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.full_name || t.email}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td className={next && next < today() ? 'overdue' : ''}>{fmtDate(next)}</td>
                      <td className="num">{money(l.value)}</td>
                      <td className="actions">
                        <button className="icon-btn" title="View & follow-ups" onClick={() => setViewing(l)}>
                          <Eye size={16} />
                        </button>
                        <button className="icon-btn" title="Edit" onClick={() => setEditing(l)}>
                          <Pencil size={16} />
                        </button>
                        <button className="icon-btn danger" title="Delete" onClick={() => remove(l)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <LeadForm
          lead={editing}
          team={team}
          isAdmin={isAdmin}
          userId={user.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
      {viewing && <LeadDetail lead={viewing} userId={user.id} onClose={() => setViewing(null)} onChanged={load} />}
    </div>
  )
}

function LeadForm({ lead, team, isAdmin, userId, onClose, onSaved }) {
  const isNew = !lead.id
  const [form, setForm] = useState({
    name: lead.name || '',
    email: lead.email || '',
    phone: lead.phone || '',
    company: lead.company || '',
    source: lead.source || '',
    status: lead.status || 'New',
    value: lead.value ?? '',
    notes: lead.notes || '',
    assigned_to: isNew ? (isAdmin ? '' : userId) : lead.assigned_to || '',
    follow_up_date: '',
    follow_up_note: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { follow_up_date, follow_up_note, ...rest } = form
    const payload = {
      ...rest,
      value: Number(rest.value) || 0,
      assigned_to: isAdmin ? rest.assigned_to || null : userId,
    }
    const res = isNew
      ? await supabase.from('leads').insert(payload).select('id').single()
      : await supabase.from('leads').update(payload).eq('id', lead.id).select('id').single()
    if (res.error) {
      setError(res.error.message)
      setBusy(false)
      return
    }
    if (isNew && follow_up_date) {
      const { error } = await supabase
        .from('follow_ups')
        .insert({ lead_id: res.data.id, due_date: follow_up_date, note: follow_up_note || null })
      if (error) {
        setError(error.message)
        setBusy(false)
        return
      }
    }
    onSaved()
  }

  return (
    <Modal
      title={isNew ? 'Add lead' : 'Edit lead'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" form="lead-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save lead'}
          </button>
        </>
      }
    >
      <ErrorNote error={error} />
      <form id="lead-form" className="form-grid" onSubmit={submit}>
        <Field label="Name *">
          <input required value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Company">
          <input value={form.company} onChange={set('company')} />
        </Field>
        <Field label="Email">
          <input type="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Phone">
          <input value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label="Source">
          <select value={form.source} onChange={set('source')}>
            <option value="">Select…</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={set('status')}>
            {LEAD_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Estimated value ($)">
          <input type="number" min="0" step="0.01" value={form.value} onChange={set('value')} />
        </Field>
        {isAdmin && (
          <Field label="Assign to">
            <select value={form.assigned_to} onChange={set('assigned_to')}>
              <option value="">Unassigned</option>
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name || t.email} {t.role === 'admin' ? '(admin)' : ''}
                </option>
              ))}
            </select>
          </Field>
        )}
        {isNew && (
          <>
            <Field label="First follow-up date">
              <input type="date" value={form.follow_up_date} onChange={set('follow_up_date')} />
            </Field>
            <Field label="Follow-up note">
              <input value={form.follow_up_note} onChange={set('follow_up_note')} placeholder="e.g. Send pricing" />
            </Field>
          </>
        )}
        <Field label="Notes" full>
          <textarea rows={3} value={form.notes} onChange={set('notes')} />
        </Field>
      </form>
    </Modal>
  )
}

function LeadDetail({ lead: initial, userId, onClose, onChanged }) {
  const [lead, setLead] = useState(initial)
  const [followUps, setFollowUps] = useState([])
  const [customer, setCustomer] = useState(null)
  const [form, setForm] = useState({ due_date: today(), note: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [f, c] = await Promise.all([
      supabase.from('follow_ups').select('*').eq('lead_id', initial.id).order('due_date'),
      supabase.from('customers').select('id, name').eq('lead_id', initial.id).limit(1).maybeSingle(),
    ])
    if (f.error) setError(f.error.message)
    setFollowUps(f.data || [])
    setCustomer(c.data)
  }, [initial.id])

  useEffect(() => {
    load()
  }, [load])

  const changed = () => {
    load()
    onChanged()
  }

  const setStatus = async (status) => {
    const { error } = await supabase.from('leads').update({ status }).eq('id', lead.id)
    if (error) return setError(error.message)
    setLead({ ...lead, status })
    onChanged()
  }

  const addFollowUp = async (e) => {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.from('follow_ups').insert({ lead_id: lead.id, due_date: form.due_date, note: form.note || null })
    setBusy(false)
    if (error) return setError(error.message)
    setForm({ due_date: today(), note: '' })
    changed()
  }

  const toggle = async (f) => {
    const { error } = await supabase.from('follow_ups').update({ completed: !f.completed }).eq('id', f.id)
    if (error) setError(error.message)
    changed()
  }

  const removeFollowUp = async (f) => {
    if (!window.confirm('Delete this follow-up?')) return
    const { error } = await supabase.from('follow_ups').delete().eq('id', f.id)
    if (error) setError(error.message)
    changed()
  }

  const convert = async () => {
    setBusy(true)
    setError('')
    const { error } = await supabase.from('customers').insert({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      notes: lead.notes,
      lead_id: lead.id,
      owner_id: lead.assigned_to || userId,
    })
    if (error) {
      setBusy(false)
      return setError(error.message)
    }
    await supabase.from('leads').update({ status: 'Converted' }).eq('id', lead.id)
    setLead({ ...lead, status: 'Converted' })
    setBusy(false)
    changed()
  }

  return (
    <Modal title={lead.name} onClose={onClose} wide>
      <ErrorNote error={error} />
      <div className="detail-grid">
        <div>
          <span className="label">Company</span>
          {lead.company || '—'}
        </div>
        <div>
          <span className="label">Email</span>
          {lead.email || '—'}
        </div>
        <div>
          <span className="label">Phone</span>
          {lead.phone || '—'}
        </div>
        <div>
          <span className="label">Source</span>
          {lead.source || '—'}
        </div>
        <div>
          <span className="label">Value</span>
          {money(lead.value)}
        </div>
        <div>
          <span className="label">Assigned to</span>
          {lead.assignee?.full_name || lead.assignee?.email || 'Unassigned'}
        </div>
        <div>
          <span className="label">Created</span>
          {fmtDate(lead.created_at)}
        </div>
        <div>
          <span className="label">Status</span>
          <StatusBadge status={lead.status} />
        </div>
      </div>
      {lead.notes && <p className="notes">{lead.notes}</p>}

      <h3 className="section-title">Update status</h3>
      <div className="chip-row">
        {LEAD_STATUSES.map((s) => (
          <button key={s} className={`chip status-${s.toLowerCase()} ${lead.status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>
            {s}
          </button>
        ))}
      </div>

      <div className="convert-row">
        {customer ? (
          <span className="muted">
            <Check size={14} /> Converted to customer <strong>{customer.name}</strong>
          </span>
        ) : (
          <button className="btn" onClick={convert} disabled={busy}>
            <UserPlus size={16} /> Convert to customer
          </button>
        )}
      </div>

      <h3 className="section-title">Follow-ups</h3>
      <form className="inline-form" onSubmit={addFollowUp}>
        <input type="date" required value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        <input placeholder="Note (e.g. Call to discuss proposal)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <button className="btn primary" disabled={busy}>
          <CalendarPlus size={16} /> Add
        </button>
      </form>
      {followUps.length === 0 ? (
        <Empty>No follow-ups scheduled.</Empty>
      ) : (
        <ul className="timeline">
          {followUps.map((f) => (
            <li key={f.id} className={f.completed ? 'done' : f.due_date < today() ? 'overdue' : ''}>
              <div>
                <div className="strong">{fmtDate(f.due_date)}</div>
                <div className="sub">{f.note || 'No note'}</div>
              </div>
              <div className="actions">
                <button className="icon-btn" title={f.completed ? 'Mark as pending' : 'Mark as done'} onClick={() => toggle(f)}>
                  {f.completed ? <Undo2 size={16} /> : <Check size={16} />}
                </button>
                <button className="icon-btn danger" title="Delete" onClick={() => removeFollowUp(f)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
