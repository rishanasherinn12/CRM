import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Receipt } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { fmtDate, matches, money } from '../../lib/format'
import { Empty, ErrorNote, Field, Loading, Modal } from '../../components/ui'
import { SaleForm } from './Sales'

export default function Customers() {
  const { user, profile } = useAuth()
  const isAdmin = profile.role === 'admin'
  const [customers, setCustomers] = useState([])
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [owner, setOwner] = useState('')
  const [editing, setEditing] = useState(null)
  const [selling, setSelling] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*, owner:profiles(id, full_name, email), sales(amount)')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setCustomers(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    if (isAdmin) supabase.from('profiles').select('id, full_name, email').order('full_name').then(({ data }) => setTeam(data || []))
  }, [load, isAdmin])

  const filtered = useMemo(
    () => customers.filter((c) => matches(query, c.name, c.email, c.phone, c.company) && (!owner || c.owner_id === owner)),
    [customers, query, owner]
  )

  const remove = async (c) => {
    if (!window.confirm(`Delete customer "${c.name}"? Their sales stay on record without a customer.`)) return
    const { error } = await supabase.from('customers').delete().eq('id', c.id)
    if (error) setError(error.message)
    load()
  }

  return (
    <div className="page">
      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input placeholder="Search customers…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {isAdmin && (
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">All owners</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name || t.email}
              </option>
            ))}
          </select>
        )}
        <button className="btn primary" onClick={() => setEditing({})}>
          <Plus size={16} /> Add customer
        </button>
      </div>

      <ErrorNote error={error} />

      <div className="card">
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <Empty>{customers.length ? 'No customers match your search.' : 'No customers yet. Add one, or convert a lead.'}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  {isAdmin && <th>Owner</th>}
                  <th>Since</th>
                  <th className="num">Total sales</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="strong">{c.name}</div>
                      <div className="sub">{c.company || '—'}</div>
                    </td>
                    <td>
                      <div>{c.email || '—'}</div>
                      <div className="sub">{c.phone}</div>
                    </td>
                    {isAdmin && <td>{c.owner?.full_name || c.owner?.email || '—'}</td>}
                    <td>{fmtDate(c.created_at)}</td>
                    <td className="num strong">{money(c.sales.reduce((s, x) => s + Number(x.amount), 0))}</td>
                    <td className="actions">
                      <button className="icon-btn" title="Record sale" onClick={() => setSelling(c)}>
                        <Receipt size={16} />
                      </button>
                      <button className="icon-btn" title="Edit" onClick={() => setEditing(c)}>
                        <Pencil size={16} />
                      </button>
                      <button className="icon-btn danger" title="Delete" onClick={() => remove(c)}>
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

      {editing && (
        <CustomerForm
          customer={editing}
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
      {selling && (
        <SaleForm
          sale={{ customer_id: selling.id, sales_exec_id: selling.owner_id || user.id }}
          team={team}
          isAdmin={isAdmin}
          userId={user.id}
          onClose={() => setSelling(null)}
          onSaved={() => {
            setSelling(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function CustomerForm({ customer, team, isAdmin, userId, onClose, onSaved }) {
  const isNew = !customer.id
  const [form, setForm] = useState({
    name: customer.name || '',
    email: customer.email || '',
    phone: customer.phone || '',
    company: customer.company || '',
    address: customer.address || '',
    notes: customer.notes || '',
    owner_id: customer.owner_id || userId,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const payload = { ...form, owner_id: isAdmin ? form.owner_id : userId }
    const { error } = isNew
      ? await supabase.from('customers').insert(payload)
      : await supabase.from('customers').update(payload).eq('id', customer.id)
    setBusy(false)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <Modal
      title={isNew ? 'Add customer' : 'Edit customer'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" form="customer-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save customer'}
          </button>
        </>
      }
    >
      <ErrorNote error={error} />
      <form id="customer-form" className="form-grid" onSubmit={submit}>
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
        <Field label="Address" full>
          <input value={form.address} onChange={set('address')} />
        </Field>
        {isAdmin && (
          <Field label="Owner" full>
            <select value={form.owner_id} onChange={set('owner_id')}>
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name || t.email}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Notes" full>
          <textarea rows={3} value={form.notes} onChange={set('notes')} />
        </Field>
      </form>
    </Modal>
  )
}
