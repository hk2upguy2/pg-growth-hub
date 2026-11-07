import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { EmptyState, PageHeader } from '../components/ui'
import { daysSince, money } from '../lib/utils'

/** Every village at a glance: where the customers are, who has gone quiet, and where visits are overdue. */
export default function VillageBoard() {
  const { accounts, repName, isAdmin } = useStore()
  const [open, setOpen] = useState('')
  const groups = useMemo(() => {
    const m = new Map<string, typeof accounts>()
    accounts.forEach(a => { const k = a.market === 'Guam' || !a.market ? a.village : a.market === 'Military' ? 'Military / Commissary' : `Other island: ${a.island || 'unspecified'}`; m.set(k, [...(m.get(k) ?? []), a]) })
    return [...m].map(([name, list]) => {
      const buying = list.filter(a => a.status === 'Active'), lapsed = buying.filter(a => (daysSince(a.lastOrderDate ?? null) ?? 0) >= 30 && a.lastOrderDate)
      const stale = list.filter(a => a.status !== 'Inactive' && ((daysSince(a.lastVisit) ?? 999) >= 30))
      return { name, list, buying: buying.length, prospects: list.filter(a => a.status === 'Prospect').length, lapsed: lapsed.length, stale: stale.length, sales: list.reduce((n, a) => n + a.monthlySales, 0) }
    }).sort((a, b) => b.sales - a.sales)
  }, [accounts])
  const max = Math.max(1, ...groups.map(g => g.sales))
  const shown = groups.find(g => g.name === open)

  return (
    <>
      <PageHeader title="Village Board" subtitle="Where your customers are, who has gone quiet, and which areas need a visit" />
      {groups.length === 0 ? <div className="card p-8"><EmptyState title="No accounts yet" /></div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map(g => (
            <button key={g.name} onClick={() => setOpen(open === g.name ? '' : g.name)} className={`card p-4 text-left hover:border-navy-300 ${open === g.name ? 'ring-2 ring-navy-500' : ''}`}>
              <div className="flex justify-between items-start"><div className="font-semibold text-navy-900">{g.name}</div><div className="text-xs text-slate-500">{g.list.length} accounts</div></div>
              <div className="h-2 rounded bg-slate-200 mt-2 overflow-hidden"><div className="h-full bg-navy-600" style={{ width: `${Math.round((g.sales / max) * 100)}%` }} /></div>
              <div className="text-sm font-semibold text-navy-900 mt-1">{money(g.sales)} <span className="text-xs font-normal text-slate-500">per month</span></div>
              <div className="flex gap-3 mt-2 text-xs flex-wrap">
                <span className="text-emerald-700">{g.buying} buying</span><span className="text-slate-600">{g.prospects} prospects</span>
                {g.lapsed > 0 && <span className="text-red-600 font-medium">{g.lapsed} stopped ordering</span>}
                {g.stale > 0 && <span className="text-amber-700 font-medium">{g.stale} not visited in 30+ days</span>}
              </div>
            </button>))}
        </div>)}
      {shown && (
        <div className="card mt-4 overflow-x-auto">
          <div className="p-3 font-semibold">{shown.name}</div>
          <table className="w-full min-w-[620px]"><thead><tr><th className="th">Account</th><th className="th">Status</th><th className="th">Last order</th><th className="th">Last visit</th><th className="th text-right">Per month</th>{isAdmin && <th className="th">Rep</th>}</tr></thead>
            <tbody>{[...shown.list].sort((a, b) => b.monthlySales - a.monthlySales).map(a => (
              <tr key={a.id}><td className="td"><Link className="text-navy-700 hover:underline" to={`/account/${a.id}`}>{a.name}</Link><div className="text-xs text-slate-500">{a.segment}</div></td>
                <td className="td">{a.status}</td><td className="td">{a.lastOrderDate ? `${daysSince(a.lastOrderDate)} days ago` : '—'}</td><td className="td">{a.lastVisit ? `${daysSince(a.lastVisit)} days ago` : 'never'}</td>
                <td className="td text-right">{money(a.monthlySales)}</td>{isAdmin && <td className="td">{repName(a.repId)}</td>}</tr>))}</tbody></table>
        </div>)}
    </>
  )
}
