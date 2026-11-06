import { useEffect, useState } from 'react'
import { mfaConfirm, mfaEnroll, mfaFactor, mfaRemove } from '../lib/mfa'
import { useStore } from '../lib/store'
import { hasSupabase } from '../lib/supabase'
import { PageHeader, useAction } from '../components/ui'
import { exportCSV } from '../lib/utils'
import { accountRows } from './Accounts'

function TwoStep() {
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined)
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const load = () => mfaFactor().then(f => setFactorId(f?.id ?? null)).catch(e => { setFactorId(null); setMsg(e instanceof Error ? e.message : 'Could not check two-step login') })
  useEffect(() => { void load() }, [])
  const fail = (e: unknown) => setMsg(e instanceof Error ? e.message : 'Something went wrong')
  return (
    <div className="card p-4 space-y-2 text-sm">
      <h3 className="font-semibold text-navy-900">Two-step login</h3>
      {factorId === undefined ? <p className="text-slate-500">Checking…</p> : factorId ? (
        <>
          <p className="text-emerald-700 font-medium">On. You will be asked for a code from your authenticator app each time you sign in.</p>
          <button className="btn-secondary" onClick={() => window.confirm('Turn off two-step login?') && mfaRemove(factorId).then(() => { setMsg(''); void load() }).catch(fail)}>Turn off</button>
        </>
      ) : setup ? (
        <>
          <p>1. Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password) and scan this code.</p>
          <img src={setup.qr} alt="Scan with your authenticator app" className="w-40 h-40 border border-slate-200 rounded-lg" />
          <p className="text-xs text-slate-500">Cannot scan? Enter this key: <code className="bg-slate-100 px-1 rounded break-all">{setup.secret}</code></p>
          <p>2. Type the 6-digit code it shows:</p>
          <div className="flex gap-2">
            <input className="input !w-32 text-center tracking-widest" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
            <button className="btn-primary" disabled={code.length !== 6} onClick={() => mfaConfirm(setup.factorId, code).then(() => { setSetup(null); setCode(''); setMsg(''); void load() }).catch(fail)}>Turn on</button>
            <button className="btn-secondary" onClick={() => { setSetup(null); setCode('') }}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <p className="text-slate-600">Adds a code from your phone to your password. Strongly recommended for managers, who can see and change everything.</p>
          <button className="btn-primary" onClick={() => mfaEnroll().then(s => { setMsg(''); setSetup(s) }).catch(fail)}>Set up two-step login</button>
        </>
      )}
      {msg && <div className="text-sm rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2">{msg}</div>}
    </div>
  )
}

export default function SettingsPage() {
  const { user, isAdmin, resetDemo, clearDemo, accounts, repName, logout } = useStore()
  const run = useAction()
  return (
    <>
      <PageHeader title="Settings" subtitle="Profile, data mode and demo data" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4 space-y-2 text-sm">
          <h3 className="font-semibold text-navy-900">Your profile</h3>
          <div><span className="text-slate-500">Name:</span> {user?.name}</div>
          <div><span className="text-slate-500">Email:</span> {user?.email}</div>
          <div><span className="text-slate-500">Role:</span> {user?.role === 'admin' ? 'Management / Administrator' : 'Sales Representative'}</div>
          <div><span className="text-slate-500">Territory:</span> {user?.territory ?? 'All'}</div>
          <button className="btn-secondary mt-2" onClick={logout}>Sign out</button>
        </div>
        <div className="card p-4 space-y-2 text-sm">
          <h3 className="font-semibold text-navy-900">Data mode</h3>
          {hasSupabase
            ? <p>Connected to Supabase. Permissions are enforced by Postgres row-level security.</p>
            : <>
              <p><strong>Demo mode (localStorage).</strong> Data lives only in this browser. To connect Supabase, add <code className="bg-slate-100 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-slate-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to your environment and run the SQL in <code className="bg-slate-100 px-1 rounded">supabase/migrations</code>. See README.</p>
              <p className="text-xs text-slate-500">Never put the Supabase service-role key in the frontend.</p>
            </>}
          <button className="btn-secondary" onClick={() => exportCSV('my-accounts-backup', accountRows(accounts, repName))}>Back up accounts (CSV)</button>
        </div>
        {hasSupabase && <TwoStep />}
        {hasSupabase && isAdmin && (
          <div className="card p-4 space-y-2 text-sm">
            <h3 className="font-semibold text-navy-900">Security checklist (management)</h3>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li>Turn on two-step login for every manager.</li>
              <li>Have <strong>at least two</strong> administrators: promote a trusted person under User Management so access never depends on one login.</li>
              <li>Backups: in Supabase, Project Settings, Database, Backups. Daily backups need a paid Supabase plan. Meanwhile use <em>Back up accounts (CSV)</em> weekly.</li>
              <li>Switch off public sign-ups once all reps have accounts (Supabase, Authentication, Sign In / Providers).</li>
              <li>Review the Audit Log for unexpected deletes or reassignments.</li>
            </ul>
          </div>
        )}
        {isAdmin && !hasSupabase && (
          <div className="card p-4 space-y-3 text-sm lg:col-span-2">
            <h3 className="font-semibold text-navy-900">Demo data (management only)</h3>
            <p className="text-slate-600">Demo records are illustrative only — they are not confirmed customers or actual sales, and all dollar values are illustrative estimates.</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={() => window.confirm('Reset ALL data back to the original demo data?') && run(resetDemo, 'Demo data restored')}>Reset to demo data</button>
              <button className="btn-danger" onClick={() => window.confirm('Remove all demo records? Records you created are kept.') && run(clearDemo, 'Demo records removed')}>Remove demo records</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
