import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { ACTIVITY_TYPES, Activity } from '../types'
import { ActivityForm } from '../components/forms'
import { Badge, EmptyState, ExportMenu, PageHeader, useAction } from '../components/ui'
import { exportCSV, exportXLS, fmtDate, fmtDateTime, localDate } from '../lib/utils'
import { isOverdue } from '../lib/analytics'

export function activityRows(list: Activity[], repName: (i: string) => string, accountName: (i: string) => string) {
  return list.map(a => ({
    'Date/Time': a.at.replace('T', ' ').slice(0, 16), Account: accountName(a.accountId), Representative: repName(a.repId), Type: a.type,
    Summary: a.summary, 'Products Discussed': a.products, Outcome: a.outcome, 'Next Action': a.nextAction,
    'Follow-up Date': a.followUpDate ?? '', 'Follow-up Done': a.followUpDone ? 'Yes' : 'No',
  }))
}

export default function Activities() {
  const { activities, accounts, profiles, repName, accountName, isAdmin, deleteActivity, completeFollowUp } = useStore()
  const run = useAction()
  const [rep, setRep] = useState('')
  const [acct, setAcct] = useState('')
  const [type, setType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [dueOnly, setDueOnly] = useState(false)
  const [editing, setEditing] = useState<Activity | undefined>()
  const [adding, setAdding] = useState(false)

  const rows = useMemo(() => activities
    .filter(a => (!rep || a.repId === rep) && (!acct || a.accountId === acct) && (!type || a.type === type)
      && (!from || localDate(a.at) >= from) && (!to || localDate(a.at) <= to) && (!dueOnly || (a.followUpDate && !a.followUpDone)))
    .sort((a, b) => (a.at < b.at ? 1 : -1)), [activities, rep, acct, type, from, to, dueOnly])

  const exp = () => activityRows(rows, repName, accountName)
  return (
    <>
      <PageHeader title="Sales Activities" subtitle={`${rows.length} activities`}
        actions={<><ExportMenu onCSV={() => exportCSV('sales-activities', exp())} onXLS={() => exportXLS('sales-activities', exp())} />
          <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> Log activity</button></>} />
      <div className="card p-3 mb-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {isAdmin && <select className="input" value={rep} onChange={e => setRep(e.target.value)}><option value="">All reps</option>{profiles.filter(p => p.role === 'rep').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
        <select className="input" value={acct} onChange={e => setAcct(e.target.value)}><option value="">All accounts</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <select className="input" value={type} onChange={e => setType(e.target.value)}><option value="">All types</option>{ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}</select>
        <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} aria-label="From date" />
        <input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} aria-label="To date" />
        <label className="flex items-center gap-2 text-sm px-2"><input type="checkbox" checked={dueOnly} onChange={e => setDueOnly(e.target.checked)} /> Open follow-ups</label>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead><tr><th className="th">Date</th><th className="th">Account</th><th className="th">Rep</th><th className="th">Type</th><th className="th">Summary</th><th className="th">Outcome / next action</th><th className="th">Follow-up</th><th className="th" /></tr></thead>
          <tbody>
            {rows.map(a => (
              <tr key={a.id} className="hover:bg-slate-50 align-top">
                <td className="td whitespace-nowrap">{fmtDateTime(a.at)}</td>
                <td className="td"><Link to={`/account/${a.accountId}`} className="text-navy-700 hover:underline font-medium">{accountName(a.accountId)}</Link></td>
                <td className="td">{repName(a.repId)}</td>
                <td className="td"><Badge tone="A">{a.type}</Badge></td>
                <td className="td max-w-xs">{a.summary}{a.products && <div className="text-xs text-slate-500">Products: {a.products}</div>}</td>
                <td className="td max-w-xs">{a.outcome}<div className="text-xs text-slate-500">{a.nextAction}</div></td>
                <td className="td whitespace-nowrap">{a.followUpDate ? (a.followUpDone ? <span className="text-emerald-700 text-xs font-semibold">Done · {fmtDate(a.followUpDate)}</span> : <span className={isOverdue(a) ? 'text-red-600 font-semibold' : ''}>{fmtDate(a.followUpDate)}{isOverdue(a) && ' (overdue)'}</span>) : '—'}</td>
                <td className="td whitespace-nowrap text-right">
                  {a.followUpDate && !a.followUpDone && <button className="p-1.5 rounded hover:bg-emerald-50 text-emerald-700" title="Mark follow-up done" onClick={() => run(() => completeFollowUp(a.id), 'Follow-up completed')}><Check size={16} /></button>}
                  <button className="p-1.5 rounded hover:bg-slate-100" title="Edit" onClick={() => setEditing(a)}><Pencil size={16} /></button>
                  <button className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Delete" onClick={() => window.confirm('Delete this activity?') && run(() => deleteActivity(a.id), 'Activity deleted')}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState title="No activities match" />}
      </div>
      {adding && <ActivityForm open onClose={() => setAdding(false)} />}
      {editing && <ActivityForm open onClose={() => setEditing(undefined)} activity={editing} />}
    </>
  )
}
