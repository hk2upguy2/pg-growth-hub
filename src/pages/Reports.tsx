import { channelAllows } from '../types'
import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { EmptyState, PageHeader } from '../components/ui'
import { exportCSV, exportXLS, lastMonths, monthKey, monthLabel } from '../lib/utils'
import { isOpen, weighted, followUpsDue, staleAccounts } from '../lib/analytics'
import { daysSince, localDate } from '../lib/utils'

type Row = Record<string, string | number>

export default function Reports() {
  const { accounts, activities, opportunities, profiles, repName, accountName, isAdmin, user } = useStore()
  const [id, setId] = useState('new-accounts')
  const [months, setMonths] = useState(6)

  const reports = useMemo(() => {
    const ms = lastMonths(months)
    const reps = profiles.filter(p => p.role === 'rep' && p.active)
    const types = (['Retail', 'Foodservice', 'Hotel', 'Institutional'] as const).filter(t => isAdmin || channelAllows(user?.channel, t))
    const R: { id: string; title: string; note?: string; rows: () => Row[] }[] = [
      { id: 'new-accounts', title: 'New accounts acquired', note: 'Accounts created per month, by type', rows: () => ms.map(m => {
        const l = accounts.filter(a => monthKey(a.createdAt) === m)
        return { Month: monthLabel(m), Total: l.length, ...Object.fromEntries(types.map(t => [t, l.filter(a => a.type === t).length])) }
      }) },
      { id: 'account-activity', title: 'Account activity', note: 'Activity count and last touch per account', rows: () => accounts.map(a => {
        const l = activities.filter(x => x.accountId === a.id)
        return { Account: a.name, Type: a.type, Rep: repName(a.repId), Activities: l.length, 'Last activity': l.map(x => localDate(x.at)).sort().slice(-1)[0] ?? '', 'Last visit': a.lastVisit ?? '', 'Days since visit': daysSince(a.lastVisit) ?? 'never' }
      }).sort((x, y) => Number(y.Activities) - Number(x.Activities)) },
      { id: 'rep-performance', title: 'Sales representative performance', rows: () => reps.map(p => {
        const acts = activities.filter(a => a.repId === p.id)
        const os = opportunities.filter(o => o.repId === p.id)
        return {
          Rep: p.name, Accounts: accounts.filter(a => a.repId === p.id).length, Activities: acts.length, Visits: acts.filter(a => a.type === 'Customer Visit').length,
          Opportunities: os.length, 'Open pipeline': os.filter(isOpen).reduce((s, o) => s + o.monthlyValue, 0), 'Weighted pipeline': Math.round(os.reduce((s, o) => s + weighted(o), 0)),
          Won: os.filter(o => o.stage === 'Won').length, Lost: os.filter(o => o.stage === 'Lost').length,
        }
      }) },
      { id: 'product-opps', title: 'Product opportunities', rows: () => opportunities.map(o => ({ Account: accountName(o.accountId), Brand: o.brand, Product: o.product, Stage: o.stage, 'Est. monthly': o.monthlyValue, 'Prob %': o.probability, Weighted: Math.round(weighted(o)), Rep: repName(o.repId), 'Expected close': o.expectedClose })) },
      { id: 'monthly-pipeline', title: 'Monthly pipeline', note: 'Open opportunities by expected closing month', rows: () => {
        const keys = [...new Set(opportunities.filter(isOpen).map(o => monthKey(o.expectedClose)))].sort()
        return keys.map(k => { const l = opportunities.filter(o => isOpen(o) && monthKey(o.expectedClose) === k); return { 'Expected close month': monthLabel(k), Opportunities: l.length, 'Gross value': l.reduce((s, o) => s + o.monthlyValue, 0), 'Weighted value': Math.round(l.reduce((s, o) => s + weighted(o), 0)) } })
      } },
      { id: 'retail-vs-fs', title: 'Retail vs foodservice opportunities', rows: () => types.map(t => {
        const l = opportunities.filter(o => accounts.find(a => a.id === o.accountId)?.type === t)
        return { 'Account type': t, Opportunities: l.length, 'Open value': l.filter(isOpen).reduce((s, o) => s + o.monthlyValue, 0), Weighted: Math.round(l.reduce((s, o) => s + weighted(o), 0)), Won: l.filter(o => o.stage === 'Won').length }
      }) },
      { id: 'agrosuper', title: 'Agrosuper opportunities', rows: () => opportunities.filter(o => o.brand === 'Agrosuper').map(o => ({ Account: accountName(o.accountId), Segment: accounts.find(a => a.id === o.accountId)?.segment ?? '', Product: o.product, Stage: o.stage, 'Est. monthly': o.monthlyValue, Weighted: Math.round(weighted(o)), Rep: repName(o.repId) })).sort((a, b) => Number(b['Est. monthly']) - Number(a['Est. monthly'])) },
      { id: 'hostess', title: 'Hostess placements', rows: () => opportunities.filter(o => o.brand === 'Hostess').map(o => ({ Account: accountName(o.accountId), Placement: o.product, Stage: o.stage, 'Est. monthly': o.monthlyValue, Rep: repName(o.repId), 'Expected close': o.expectedClose, 'Next action': o.nextAction })) },
      { id: 'kikkoman', title: 'Kikkoman opportunities', rows: () => opportunities.filter(o => o.brand === 'Kikkoman').map(o => ({ Account: accountName(o.accountId), Segment: accounts.find(a => a.id === o.accountId)?.segment ?? '', Product: o.product, Stage: o.stage, 'Est. monthly': o.monthlyValue, Rep: repName(o.repId), 'Lost reason': o.lostReason ?? '' })) },
      { id: 'follow-up', title: 'Follow-up completion', rows: () => reps.map(p => {
        const l = activities.filter(a => a.repId === p.id && a.followUpDate)
        const done = l.filter(a => a.followUpDone).length
        return { Rep: p.name, 'Follow-ups set': l.length, Completed: done, Open: l.length - done, Overdue: followUpsDue(l).filter(a => a.followUpDate! < new Date().toISOString().slice(0, 10)).length, 'Completion %': l.length ? Math.round((done / l.length) * 100) : 0 }
      }) },
      { id: 'coverage', title: 'Account coverage', note: 'Visit recency by account (30-day window)', rows: () => {
        const stale = new Set(staleAccounts(accounts, 30).map(a => a.id))
        return accounts.map(a => ({ Account: a.name, Priority: a.priority, Rep: repName(a.repId), 'Last visit': a.lastVisit ?? 'never', 'Days since': daysSince(a.lastVisit) ?? 'never', 'Covered (30d)': stale.has(a.id) ? 'No' : 'Yes' }))
          .sort((a, b) => (a['Covered (30d)'] === b['Covered (30d)'] ? 0 : a['Covered (30d)'] === 'No' ? -1 : 1))
      } },
    ]
    return R
  }, [accounts, activities, opportunities, profiles, months, repName, accountName])

  const cur = reports.find(r => r.id === id)!
  const rows = cur.rows()
  const headers = rows[0] ? Object.keys(rows[0]) : []

  return (
    <>
      <PageHeader title="Reports" subtitle={isAdmin ? 'Management reports across all representatives' : 'Reports for your assigned accounts'}
        actions={<><button className="btn-secondary" disabled={!rows.length} onClick={() => exportCSV(cur.id, rows)}>Export CSV</button>
          <button className="btn-secondary" disabled={!rows.length} onClick={() => exportXLS(cur.id, rows)}>Export Excel</button></>} />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="card p-2 lg:col-span-1 h-fit">
          {reports.map(r => <button key={r.id} onClick={() => setId(r.id)} className={`block w-full text-left rounded-lg px-3 py-2 text-sm ${r.id === id ? 'bg-navy-800 text-white' : 'hover:bg-slate-100 text-slate-700'}`}>{r.title}</button>)}
        </div>
        <div className="lg:col-span-3 card">
          <div className="p-4 flex items-start justify-between gap-3 flex-wrap">
            <div><h3 className="font-semibold text-navy-900">{cur.title}</h3>{cur.note && <p className="text-xs text-slate-500">{cur.note}</p>}</div>
            {cur.id === 'new-accounts' && <select className="input !w-auto" value={months} onChange={e => setMonths(Number(e.target.value))}>{[3, 6, 12].map(m => <option key={m} value={m}>Last {m} months</option>)}</select>}
          </div>
          <div className="overflow-x-auto"><table className="w-full"><thead><tr>{headers.map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i} className="hover:bg-slate-50">{headers.map(h => <td key={h} className="td whitespace-nowrap">{typeof r[h] === 'number' && /value|pipeline|monthly|Weighted|Open value/i.test(h) ? `$${Number(r[h]).toLocaleString()}` : r[h]}</td>)}</tr>)}</tbody></table>
            {rows.length === 0 && <EmptyState title="No data for this report" />}</div>
        </div>
      </div>
    </>
  )
}
