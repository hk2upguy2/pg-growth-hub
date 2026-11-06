import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Badge, EmptyState, PageHeader } from '../components/ui'
import { daysSince, fmtDate, fmtDateTime, localDate, todayStr } from '../lib/utils'

const ago = (d: number | null) => (d === null ? 'never' : d === 0 ? 'today' : d === 1 ? '1 day ago' : `${d} days ago`)
const flag = (d: number | null) => (d === null || d >= 5 ? 'Lost' : d >= 3 ? 'On Hold' : 'Active')

export default function TeamActivity() {
  const { profiles, activities, accounts } = useStore()
  const rows = useMemo(() => {
    const today = todayStr()
    return profiles.filter(p => p.role === 'rep' && p.active).map(rep => {
      const mine = activities.filter(a => a.repId === rep.id)
      const last = mine.reduce<string | null>((m, a) => (!m || a.at > m ? a.at : m), null)
      const within = (days: number, visitOnly = false) => mine.filter(a => (daysSince(localDate(a.at)) ?? 999) < days && (!visitOnly || a.type === 'Customer Visit')).length
      const myAccts = accounts.filter(a => a.repId === rep.id)
      const overdue = mine.filter(a => a.followUpDate && !a.followUpDone && a.followUpDate < today).length
      const noVisit30 = myAccts.filter(a => a.status !== 'Inactive' && (daysSince(a.lastVisit) ?? 999) >= 30).length
      return { rep, last, since: last ? daysSince(localDate(last)) : null, v7: within(7, true), v30: within(30, true), a30: within(30), overdue, noVisit30, accounts: myAccts.length, seen: rep.lastSeen ?? null }
    }).sort((a, b) => (b.since ?? 999) - (a.since ?? 999))
  }, [profiles, activities, accounts])
  const quiet = rows.filter(r => r.since === null || r.since >= 3)

  return (
    <>
      <PageHeader title="Team Activity" subtitle="Who is logging their work, and who has gone quiet" />
      {rows.length === 0 ? <div className="card p-8"><EmptyState title="No sales reps yet" /></div> : (
        <>
          <div className={`card p-4 mb-4 text-sm ${quiet.length ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'}`}>
            {quiet.length
              ? <><strong>{quiet.length} rep{quiet.length > 1 ? 's have' : ' has'} logged nothing in 3+ days:</strong> {quiet.map(r => r.rep.name).join(', ')}. <Link to="/messages" className="underline">Send a message</Link></>
              : <strong>Every rep has logged activity in the last 3 days.</strong>}
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead><tr><th className="th">Rep</th><th className="th">Last activity logged</th><th className="th">Last opened app</th><th className="th">Visits 7d</th><th className="th">Visits 30d</th><th className="th">Activities 30d</th><th className="th">Overdue follow-ups</th><th className="th">Accounts not visited 30d+</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.rep.id}>
                    <td className="td"><div className="font-medium text-navy-900">{r.rep.name}</div><div className="text-xs text-slate-500">{r.accounts} accounts</div></td>
                    <td className="td"><Badge tone={flag(r.since)}>{ago(r.since)}</Badge>{r.last && <div className="text-xs text-slate-500 mt-0.5">{fmtDateTime(r.last)}</div>}</td>
                    <td className="td">{r.seen ? <><div>{ago(daysSince(localDate(r.seen)))}</div><div className="text-xs text-slate-500">{fmtDate(localDate(r.seen))}</div></> : <span className="text-slate-400">never</span>}</td>
                    <td className="td font-semibold">{r.v7}</td><td className="td">{r.v30}</td><td className="td">{r.a30}</td>
                    <td className="td">{r.overdue ? <Badge tone="Lost">{r.overdue}</Badge> : <span className="text-slate-400">0</span>}</td>
                    <td className="td">{r.noVisit30 ? <Badge tone="On Hold">{r.noVisit30}</Badge> : <span className="text-slate-400">0</span>}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-3">Green: logged today or yesterday. Amber: 3-4 days quiet. Red: 5+ days or never.Visits are logged Customer Visit activities.</p>
        </>
      )}
    </>
  )
}
