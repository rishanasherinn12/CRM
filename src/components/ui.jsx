import { useEffect } from 'react'
import { X } from 'lucide-react'

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function StatCard({ label, value, icon: Icon, tone = 'indigo', hint }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon tone-${tone}`}>{Icon && <Icon size={20} />}</div>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  )
}

export function StatusBadge({ status }) {
  return <span className={`badge status-${status.toLowerCase()}`}>{status}</span>
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>
}

export function Field({ label, children, full }) {
  return (
    <label className={`field ${full ? 'full' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}

export function ErrorNote({ error }) {
  if (!error) return null
  return <div className="alert error">{error}</div>
}

export function Loading() {
  return (
    <div className="loading-block">
      <div className="spinner" />
    </div>
  )
}

export function StatusBars({ counts, total }) {
  return (
    <div className="bars">
      {Object.entries(counts).map(([status, n]) => (
        <div key={status} className="bar-row">
          <span className="bar-label">{status}</span>
          <div className="bar-track">
            <div className={`bar-fill status-${status.toLowerCase()}`} style={{ width: total ? `${(n / total) * 100}%` : 0 }} />
          </div>
          <span className="bar-value">{n}</span>
        </div>
      ))}
    </div>
  )
}
