import { useMemo, useState } from 'react'
import { Trophy } from 'lucide-react'
import { useStore } from '../lib/store'
import { Badge, EmptyState, PageHeader, useAction } from '../components/ui'
import { lastMonths, money, monthKey, monthLabel } from '../lib/utils'
import { weighted, isOpen } from '../lib/analytics'
import type { Profile } from '../types'

const pct = (a: number, t: number) => (t > 0 ? Math.round((a / t) * 100) : null)
const tone = (p: number | null) => (p === null ? 'bg-slate-300' : p >= 100 ? 'bg-emerald-500' : p >= 70 ? 'bg-amber-500' : 'bg-red-500')

function Bar({ actual, target, fmt = (n: number) => String(n) }: { actual: number; target: number; fmt?: (n: number) => string }) {
  const p = pct(actual, target)
  return (
    <div className="min-w-[130px]">
      <div className="flex justify-between text-xs mb-1"><span className="font-semibold text-navy-900">{fmt(actual)}</span><span className="text-slate-500">{target > 0 ? `of ${fmt(target)}` : 'no target'}{p !== null ? ` · ${p}%` : ''}</span></div>
      <div className="h-2 rounded bg-slate-200 overflow-hidden"><div className={`h-full ${tone(p)}`} style={{ width: `${Math.min(100, p ?? 0)}%` }} /></div>
    </div>
  )
}

export default function Scorecard() {
  const { profiles, accounts, activities, opportunities, sales, targets, isAdmin, user, saveTarget } = useStore()
  const run = useAction()
  const months = useMemo(() => [...lastMonths(6)].reverse(), [])
  const [month, setMonth] = useState(months[0])

  const reps: Profile[] = useMemo(
    () => (isAdmin ? profiles.filter(p => p.role === 'rep' && p.active) : profiles.filter(p => p.id === user?.id)),
    [profiles, isAdmin, user],
  )
  const rows = useMemo(() => {
    const owner = new Map(accounts.map(a => [a.id, a.repId]))
    return reps.map(rep => {
      const t = targets.find(x => x.repId === rep.id && x.month === month)
      const salesAct = sales.filter(s => s.month === month && owner.get(s.accountId) === rep.id).reduce((n, s) => n + s.amount, 0)
      const visits = activities.filter(a => a.repId === rep.id && a.type === 'Customer Visit' && monthKey(a.at) === month).length
      const newAcc = accounts.filter(a => a.repId === rep.id && monthKey(a.createdAt) === month).length
      const opps = opportunities.filter(o => o.repId === rep.id)
      return {
        rep, salesAct, visits, newAcc, salesT: t?.salesTarget ?? 0, visitsT: t?.visitsTarget ?? 0, newT: t?.newAccountsTarget ?? 0,
        pipeline: opps.filter(isOpen).reduce((n, o) => n + weighted(o), 0), won: opps.filter(o => o.stage === 'Won').length,
      }
    }).sort((a, b) => (pct(b.salesAct, b.salesT) ?? -1) - (pct(a.salesAct, a.salesT) ?? -1) || b.salesAct - a.salesAct)
  }, [reps, targets, sales, activities, accounts, opportunities, month])

  const setT = (r: typeof rows[number], patch: Partial<{ salesTarget: number; visitsTarget: number; newAccountsTarget: number }>) =>
    run(() => saveTarget({ repId: r.rep.id, month, salesTarget: r.salesT, visitsTarget: r.visitsT, newAccountsTarget: r.newT, ...patch }), 'Target saved')
  const hasSales = sales.some(s => s.month === month)

  return (
    <>
      <PageHeader title={isAdmin ? 'Rep Scorecard' : 'My Scorecard'} subtitle={isAdmin ? 'Targets vs actuals for each sales rep' : 'Your targets vs actuals'}
        actions={<select className="input !w-auto" value={month} onChange={e => setMonth(e.target.value)}>{months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>} />
      {!hasSales && <div className="card p-3 mb-4 text-sm bg-amber-50 border-amber-300 text-amber-900">No sales data loaded for {monthLabel(month)} yet. Use Account Directory → Sales update to load it from Sage. Visits and new accounts come from activity in the app.</div>}
      {rows.length === 0 ? <div className="card p-8"><EmptyState title="No sales reps yet" hint="Reps appear here after they sign up." /></div> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead><tr><th className="th w-10">#</th><th className="th">Rep</th><th className="th">Sales</th><th className="th">Customer visits</th><th className="th">New accounts</th><th className="th">Weighted pipeline</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.rep.id} className="align-top">
                  <td className="td">{isAdmin && i === 0 && r.salesT > 0 ? <Trophy size={16} className="text-amber-500" /> : i + 1}</td>
                  <td className="td"><div className="font-medium text-navy-900">{r.rep.name}</div><div className="text-xs text-slate-500">{r.rep.channel === 'Retail' ? 'Retail' : r.rep.channel === 'Hospitality' ? 'Hotel & Foodservice' : 'All accounts'}</div></td>
                  <td className="td"><Bar actual={r.salesAct} target={r.salesT} fmt={money} />
                    {isAdmin && <input aria-label={`Sales target for ${r.rep.name}`} type="number" min={0} step={500} className="input !py-1 mt-2 w-32" defaultValue={r.salesT || ''} key={`s${month}${r.salesT}`} placeholder="Sales target $" onBlur={e => { if (Number(e.target.value) !== r.salesT) setT(r, { salesTarget: Number(e.target.value) }) }} />}</td>
                  <td className="td"><Bar actual={r.visits} target={r.visitsT} />
                    {isAdmin && <input aria-label={`Visits target for ${r.rep.name}`} type="number" min={0} className="input !py-1 mt-2 w-24" defaultValue={r.visitsT || ''} key={`v${month}${r.visitsT}`} placeholder="Visits" onBlur={e => { if (Number(e.target.value) !== r.visitsT) setT(r, { visitsTarget: Number(e.target.value) }) }} />}</td>
                  <td className="td"><Bar actual={r.newAcc} target={r.newT} />
                    {isAdmin && <input aria-label={`New accounts target for ${r.rep.name}`} type="number" min={0} className="input !py-1 mt-2 w-24" defaultValue={r.newT || ''} key={`n${month}${r.newT}`} placeholder="New" onBlur={e => { if (Number(e.target.value) !== r.newT) setT(r, { newAccountsTarget: Number(e.target.value) }) }} />}</td>
                  <td className="td"><div className="font-semibold text-navy-900">{money(Math.round(r.pipeline))}</div><div className="text-xs text-slate-500">{r.won} won</div></td>
                </tr>))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500 mt-3">Sales = Sage sales for the month on each rep's accounts. Visits = logged Customer Visit activities. New accounts = accounts created that month. <Badge tone="Active">Green</Badge> 100%+ · <Badge tone="On Hold">Amber</Badge> 70–99% · <Badge tone="Lost">Red</Badge> under 70%.{isAdmin && ' Edit a target box and click away to save it for the selected month.'}</p>
    </>
  )
}
