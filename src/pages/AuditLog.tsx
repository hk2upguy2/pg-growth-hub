import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { Badge, EmptyState, ExportMenu, PageHeader } from '../components/ui'
import { exportCSV, exportXLS, fmtDateTime } from '../lib/utils'
import { hasSupabase } from '../lib/supabase'

const ENTITY: Record<string, string> = {
  accounts: 'Account', opportunities: 'Opportunity', profiles: 'User', promotions: 'Promotion', competitor_tracking: 'Competitor record',
  rep_targets: 'Target', session: 'Sign-in', messages: 'Message', sales_activities: 'Activity',
}
const TONE: Record<string, string> = { INSERT: 'Active', UPDATE: 'On Hold', DELETE: 'Lost', LOGIN: 'A' }
const VERB: Record<string, string> = { INSERT: 'Created', UPDATE: 'Changed', DELETE: 'Deleted', LOGIN: 'Signed in' }
const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? '(empty)' : typeof v === 'object' ? JSON.stringify(v) : String(v))

export default function AuditLog() {
  const { audit, repName, accountName, profiles } = useStore()
  const [action, setAction] = useState('')
  const [entity, setEntity] = useState('')
  const [q, setQ] = useState('')
  const today = new Date().toDateString()
  const inToday = useMemo(() => profiles.filter(p => p.active).map(p => ({ p, n: audit.filter(e => e.action === 'LOGIN' && e.actorId === p.id && new Date(e.at).toDateString() === today).length, last: p.lastSeen })).sort((a, b) => Number(b.n > 0) - Number(a.n > 0) || a.p.name.localeCompare(b.p.name)), [profiles, audit, today])
  const rows = useMemo(() => audit.filter(e =>
    (!action || e.action === action) && (!entity || e.entity === entity) &&
    (!q || `${e.actorName} ${e.label} ${JSON.stringify(e.changes ?? {})}`.toLowerCase().includes(q.toLowerCase()))), [audit, action, entity, q])
  // show names instead of ids where we can
  const show = (k: string, v: unknown) => (k === 'repId' || k === 'assigned_rep_id' ? repName(String(v ?? '')) : k === 'account_id' ? accountName(String(v)) : fmt(v))
  const flat = rows.map(e => ({ When: fmtDateTime(e.at), Who: e.actorName, Action: VERB[e.action] ?? e.action, Type: ENTITY[e.entity] ?? e.entity, Record: e.label, Changes: e.changes ? Object.entries(e.changes).map(([k, [o, n]]) => `${k}: ${fmt(o)} -> ${fmt(n)}`).join('; ') : '' }))

  return (
    <>
      <PageHeader title="Audit Log" subtitle="Who created, changed or deleted records, and when. Management only."
        actions={<ExportMenu onCSV={() => exportCSV('audit-log', flat)} onXLS={() => exportXLS('audit-log', flat)} />} />
      <div className="card p-3 mb-3">
        <div className="text-sm font-semibold text-navy-900 mb-2">Who has been in today <span className="font-normal text-slate-500">({inToday.filter(x => x.n > 0).length} of {inToday.length})</span></div>
        <div className="flex flex-wrap gap-1.5">{inToday.map(({ p, n, last }) => (
          <button key={p.id} onClick={() => { setAction('LOGIN'); setQ(p.name) }} title={last ? `Last seen ${fmtDateTime(last)}` : 'Never opened the app'}
            className={`text-xs rounded-full px-2.5 py-1 border ${n > 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>{p.name}{n > 0 ? ` · ${n}` : ''}</button>))}</div>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <input className="input !w-56" placeholder="Search person, record or field…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input !w-auto" value={action} onChange={e => setAction(e.target.value)}><option value="">All actions</option><option value="INSERT">Created</option><option value="UPDATE">Changed</option><option value="DELETE">Deleted</option><option value="LOGIN">Sign-ins</option></select>
        <select className="input !w-auto" value={entity} onChange={e => setEntity(e.target.value)}><option value="">All record types</option>{Object.entries(ENTITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      {rows.length === 0 ? (
        <div className="card p-8"><EmptyState title="No entries yet" hint={hasSupabase ? 'Entries appear as people change records. If this stays empty after changes, run 007_adoption_security_forecast.sql in Supabase.' : 'In demo mode, changes made from now on are recorded here.'} /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead><tr><th className="th">When</th><th className="th">Who</th><th className="th">Action</th><th className="th">Record</th><th className="th">What changed</th></tr></thead>
            <tbody>
              {rows.slice(0, 300).map(e => (
                <tr key={e.id} className="align-top">
                  <td className="td whitespace-nowrap text-xs">{fmtDateTime(e.at)}</td>
                  <td className="td">{e.actorName}</td>
                  <td className="td"><Badge tone={TONE[e.action]}>{VERB[e.action] ?? e.action}</Badge></td>
                  <td className="td"><div className="font-medium text-navy-900">{e.label || e.recordId}</div><div className="text-xs text-slate-500">{ENTITY[e.entity] ?? e.entity}</div></td>
                  <td className="td text-xs text-slate-600">{e.changes ? Object.entries(e.changes).slice(0, 6).map(([k, [o, n]]) => <div key={k}><span className="font-medium">{k}</span>: {show(k, o)} → {show(k, n)}</div>) : '—'}</td>
                </tr>))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500 mt-3">Showing the latest {Math.min(rows.length, 300)} of {rows.length} entries.{hasSupabase ? ' Recorded by the database itself, so it cannot be skipped from the app.' : ''}</p>
    </>
  )
}
