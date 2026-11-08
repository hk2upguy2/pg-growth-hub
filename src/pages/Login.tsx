import { FormEvent, useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { useStore } from '../lib/store'
import { hasSupabase } from '../lib/supabase'
import { Badge } from '../components/ui'

export default function Login() {
  return (
    <div className="min-h-full flex items-center justify-center bg-navy-800 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        <div className="text-2xl font-bold text-navy-900">PG Growth Hub</div>
        <div className="text-sm text-slate-500 mb-5">Pacific Grocers · Guam Sales CRM</div>
        {hasSupabase ? <AccountLogin /> : <DemoLogin />}
      </div>
    </div>
  )
}

function AccountLogin() {
  const { signIn, signUp, loading, mfaPending, verifyMfa, logout } = useStore()
  const [code, setCode] = useState('')
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const err = mode === 'in' ? await signIn(email, password) : await signUp(email, password, name)
    setBusy(false)
    if (err) setMsg(err)
  }

  if (loading) return <div className="text-sm text-slate-500 py-6 text-center">Loading…</div>
  if (mfaPending) {
    const verify = async (e: FormEvent) => {
      e.preventDefault(); setBusy(true); setMsg(null)
      const err = await verifyMfa(code)
      setBusy(false); if (err) { setMsg(err); setCode('') }
    }
    return (
      <form onSubmit={verify} className="space-y-3">
        <div className="text-sm text-slate-600">Enter the 6-digit code from your authenticator app.</div>
        <input id="mfa-code" autoFocus required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className="input text-center text-xl tracking-widest" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoComplete="one-time-code" />
        {msg && <div className="text-sm rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2">{msg}</div>}
        <button className="btn-primary w-full" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Verify and sign in'}</button>
        <button type="button" className="text-xs text-navy-600 hover:underline w-full" onClick={logout}>Cancel and sign out</button>
      </form>
    )
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      {mode === 'up' && (
        <label className="block"><span className="label">Full name</span>
          <input id="signup-name" required className="input" value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
      )}
      <label className="block"><span className="label">Email</span>
        <input id="login-email" required type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
      <label className="block"><span className="label">Password</span>
        <input id="login-password" required type="password" minLength={8} className="input" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></label>
      {msg && <div className="text-sm rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2">{msg}</div>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
      <button type="button" className="text-xs text-navy-600 hover:underline w-full" onClick={() => { setMode(m => (m === 'in' ? 'up' : 'in')); setMsg(null) }}>
        {mode === 'in' ? 'First time? Create your account' : 'Already have an account? Sign in'}
      </button>
      {mode === 'up' && <p className="text-xs text-slate-500">The first account created becomes the administrator. Everyone after that starts as a sales rep, and management assigns accounts and roles.</p>}
    </form>
  )
}

function DemoLogin() {
  const { profiles, login } = useStore()
  const active = profiles.filter(p => p.active)
  return (
    <>
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex gap-2 mb-5">
        <FlaskConical size={16} className="shrink-0 mt-0.5" />
        <span>Demo mode (no Supabase credentials configured). Choose a demo user to explore. Roles are enforced in the data layer: sales reps only see their assigned accounts.</span>
      </div>
      <div className="space-y-2">
        {active.map(p => (
          <button key={p.id} onClick={() => login(p.id)} className="w-full text-left rounded-lg border border-slate-200 hover:border-navy-400 hover:bg-navy-50 px-4 py-3 transition">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-navy-900 text-sm">{p.name}</span>
              <Badge tone={p.role === 'admin' ? 'A+' : 'A'}>{p.role === 'admin' ? 'Management' : p.role === 'service' ? 'Customer Service' : 'Sales Rep'}</Badge>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{p.role === 'admin' ? 'All accounts, users and reports' : p.role === 'service' ? 'All orders, to confirm and deliver' : `Territory: ${p.territory}`}</div>
          </button>
        ))}
      </div>
    </>
  )
}
