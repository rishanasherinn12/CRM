import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, DollarSign, Receipt, TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { daysFromToday, fmtDate, matches, money, today } from '../../lib/format'
import { Empty, ErrorNote, Field, Loading, Modal, StatCard } from '../../components/ui'

const PERIODS = {
  all: { label: 'All time', from: null },
  '30': { label: 'Last 30 days', from: () => daysFromToday(-30) },
  month: { label: 'This month', from: () => today().slice(0, 8) + '01' },
  year: { label: 'This year', from: () => today().slice(0, 4) + '-01-01' },
}

export default function Sales() {
  const { user, profile } = useAuth()
  const isAdmin = profile.role === 'admin'
  const [sales, setSales] = useState([])
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState('all')
  const [exec, setExec] = useState('')
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('sales')
      .select('*, customer:customers(id, name, company), exec:profiles(id, full_name, email)')
      .order('sale_date', { ascending: false })
    if (error) setError(error.message)
    else setSales(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    if (isAdmin) supabase.from('profiles').select('id, full_name, email').order('full_name').then(({ data }) => setTeam(data || []))
  }, [load, isAdmin])

  const filtered = useMemo(() => {
    const from = PERIODS[period].from?.()
    return sales.filter(
      (s) =>
        matches(query, s.product, s.customer?.name, s.customer?.company, s.notes) &&
        (!from || s.sale_date >= from) &&
        (!exec || s.sales_exec_id === exec)
    )
  }, [sales, query, period, exec])

  const total = filtered.reduce((sum, s) => sum + Number(s.amount), 0)

  const remove = async (s) => {
    if (!window.confirm(`Delete sale "${s.product}" (${money(s.amount)})?`)) return
    const { error } = await supabase.from('sales').delete().eq('id', s.id)
    if (error) setError(error.message)
    load()
  }

  return (
    <div className="page">
      <div className="stats-grid three">
        <StatCard label="Revenue" value={money(total)} icon={DollarSign} tone="green" hint={PERIODS[period].label} />
        <StatCard label="Deals closed" value={filtered.length} icon={Receipt} tone="indigo" />
        <StatCard label="Average deal" value={money(filtered.length ? total / filtered.length : 0)} icon={TrendingUp} tone="amber" />
      </div>

      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input placeholder="Search product, customer…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          {Object.entries(PERIODS).map(([k, p]) => (
            <option key={k} value={k}>
              {p.label}
            </option>
          ))}
        </select>
        {isAdmin && (
          <select value={exec} onChange={(e) => setExec(e.target.value)}>
            <option value="">All executives</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name || t.email}
              </option>
            ))}
          </select>
        )}
        <button className="btn primary" onClick={() => setEditing({})}>
          <Plus size={16} /> Record sale
        </button>
      </div>

      <ErrorNote error={error} />

      <div className="card">
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <Empty>{sales.length ? 'No sales match your filters.' : 'No sales recorded yet.'}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product / service</th>
                  <th>Customer</th>
                  {isAdmin && <th>Sales executive</th>}
                  <th className="num">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>{fmtDate(s.sale_date)}</td>
                    <td>
                      <div className="strong">{s.product}</div>
                      {s.notes && <div className="sub">{s.notes}</div>}
                    </td>
                    <td>
                      <div>{s.customer?.name || '—'}</div>
                      <div className="sub">{s.customer?.company}</div>
                    </td>
                    {isAdmin && <td>{s.exec?.full_name || s.exec?.email || '—'}</td>}
                    <td className="num strong">{money(s.amount)}</td>
                    <td className="actions">
                      <button className="icon-btn" title="Edit" onClick={() => setEditing(s)}>
                        <Pencil size={16} />
                      </button>
                      <button className="icon-btn danger" title="Delete" onClick={() => remove(s)}>
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
        <SaleForm
          sale={editing}
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
    </div>
  )
}

export function SaleForm({ sale, team = [], isAdmin, userId, onClose, onSaved }) {
  const isNew = !sale.id
  const [customers, setCustomers] = useState([])
  const [form, setForm] = useState({
    customer_id: sale.customer_id || '',
    product: sale.product || '',
    amount: sale.amount ?? '',
    sale_date: sale.sale_date || today(),
    notes: sale.notes || '',
    sales_exec_id: sale.sales_exec_id || userId,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  useEffect(() => {
    supabase
      .from('customers')
      .select('id, name, company, owner_id')
      .order('name')
      .then(({ data }) => setCustomers(data || []))
  }, [])

  // Admins recording a sale for a customer default the executive to the customer's owner.
  const pickCustomer = (e) => {
    const c = customers.find((x) => x.id === e.target.value)
    setForm({ ...form, customer_id: e.target.value, ...(isAdmin && isNew && c?.owner_id ? { sales_exec_id: c.owner_id } : {}) })
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const payload = {
      ...form,
      amount: Number(form.amount),
      sales_exec_id: isAdmin ? form.sales_exec_id : userId,
    }
    const { error } = isNew ? await supabase.from('sales').insert(payload) : await supabase.from('sales').update(payload).eq('id', sale.id)
    setBusy(false)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <Modal
      title={isNew ? 'Record sale' : 'Edit sale'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" form="sale-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save sale'}
          </button>
        </>
      }
    >
      <ErrorNote error={error} />
      {customers.length === 0 && <div className="alert">Add a customer first (or convert a lead) before recording a sale.</div>}
      <form id="sale-form" className="form-grid" onSubmit={submit}>
        <Field label="Customer *" full>
          <select required value={form.customer_id} onChange={pickCustomer}>
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.company ? ` — ${c.company}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Product / service *">
          <input required value={form.product} onChange={set('product')} />
        </Field>
        <Field label="Amount ($) *">
          <input required type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} />
        </Field>
        <Field label="Sale date *">
          <input required type="date" value={form.sale_date} onChange={set('sale_date')} />
        </Field>
        {isAdmin && (
          <Field label="Sales executive">
            <select value={form.sales_exec_id} onChange={set('sales_exec_id')}>
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
