import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Activity, ShieldCheck, Briefcase } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { session, profile, loading } = useAuth()
  const navigate = useNavigate()
  const [portal, setPortal] = useState('sales')
  const [mode, setMode] = useState('signin')
  const [form, setForm] = useState({ fullName: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  // While a sign-in is in progress we check the role ourselves before redirecting.
  if (!busy && !loading && session && profile) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/sales'} replace />
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const switchPortal = (p) => {
    setPortal(p)
    setMode('signin')
    setError('')
    setInfo('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { full_name: form.fullName } },
        })
        if (error) throw error
        if (!data.session) {
          setInfo('Account created. Check your email to confirm it, then sign in.')
          setMode('signin')
          return
        }
        navigate('/sales', { replace: true })
        return
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
      if (error) throw error
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
      if (!prof) {
        await supabase.auth.signOut()
        throw new Error('No CRM profile found for this account. Ask an admin for access.')
      }
      if (prof.role !== portal) {
        await supabase.auth.signOut()
        throw new Error(
          portal === 'admin'
            ? 'This account is not an admin. Please use the Sales Executive login.'
            : 'This is an admin account. Please use the Admin login.'
        )
      }
      navigate(portal === 'admin' ? '/admin' : '/sales', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const isAdmin = portal === 'admin'

  return (
    <div className="auth-page">
      <div className="auth-side">
        <div className="brand light">
          <span className="brand-mark">
            <Activity size={18} />
          </span>
          <span>Pulse CRM</span>
        </div>
        <div>
          <h2>Every lead, every follow-up, every sale. In one place.</h2>
          <p>Track your pipeline, stay on top of follow-ups and see how the team is performing.</p>
        </div>
        <small>© {new Date().getFullYear()} Pulse CRM</small>
      </div>

      <div className="auth-main">
        <div className="auth-card">
          <div className="portal-tabs" role="tablist">
            <button role="tab" className={!isAdmin ? 'active' : ''} onClick={() => switchPortal('sales')}>
              <Briefcase size={16} /> Sales Executive
            </button>
            <button role="tab" className={isAdmin ? 'active' : ''} onClick={() => switchPortal('admin')}>
              <ShieldCheck size={16} /> Admin
            </button>
          </div>

          <h1>{mode === 'signup' ? 'Create your account' : isAdmin ? 'Admin sign in' : 'Sales sign in'}</h1>
          <p className="muted">
            {mode === 'signup'
              ? 'Register as a sales executive.'
              : isAdmin
                ? 'Manage leads, customers and your sales team.'
                : 'Manage your leads, follow-ups and sales.'}
          </p>

          {error && <div className="alert error">{error}</div>}
          {info && <div className="alert success">{info}</div>}

          <form onSubmit={submit} className="stack">
            {mode === 'signup' && (
              <label className="field">
                <span>Full name</span>
                <input required value={form.fullName} onChange={set('fullName')} placeholder="Jane Doe" />
              </label>
            )}
            <label className="field">
              <span>Email</span>
              <input type="email" required value={form.email} onChange={set('email')} placeholder="you@company.com" autoComplete="email" />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={set('password')}
                placeholder="••••••••"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </label>
            <button className="btn primary block" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>

          {!isAdmin && (
            <p className="auth-switch">
              {mode === 'signup' ? 'Already have an account?' : 'New sales executive?'}{' '}
              <button className="link" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
                {mode === 'signup' ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          )}
          {isAdmin && <p className="auth-switch muted">Admin accounts are granted by an existing admin.</p>}
        </div>
      </div>
    </div>
  )
}
