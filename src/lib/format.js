export const LEAD_STATUSES = ['New', 'Contacted', 'Interested', 'Converted', 'Lost']

export const LEAD_SOURCES = ['Website', 'Referral', 'Social Media', 'Cold Call', 'Email Campaign', 'Event', 'Other']

const currencyFmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export const money = (n) => currencyFmt.format(Number(n) || 0)

export const fmtDate = (d) =>
  d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

export const today = () => new Date().toLocaleDateString('en-CA')

export const daysFromToday = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-CA')
}

// Earliest incomplete follow-up date for a lead with nested follow_ups
export const nextFollowUp = (lead) =>
  (lead.follow_ups || [])
    .filter((f) => !f.completed)
    .map((f) => f.due_date)
    .sort()[0] || null

export const matches = (query, ...fields) => {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fields.some((f) => f && String(f).toLowerCase().includes(q))
}
