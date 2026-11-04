import { useStore } from '../lib/store'
import { hasSupabase } from '../lib/supabase'
import { PageHeader, useAction } from '../components/ui'
import { exportCSV } from '../lib/utils'
import { accountRows } from './Accounts'

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
