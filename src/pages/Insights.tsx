import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, Printer } from 'lucide-react'
import { useStore } from '../lib/store'
import { Badge, EmptyState, PageHeader } from '../components/ui'
import { exportCSV, fmtDate, money, monthLabel } from '../lib/utils'
import { promoResults, reorders, supplierReport, whitespace } from '../lib/insights'
import { BRANDS } from '../types'

const TABS = ['Whitespace', 'Reorders', 'Supplier report', 'Promo results'] as const
type Tab = typeof TABS[number]
const pctTxt = (n: number | null) => (n === null ? '-' : `${n > 0 ? '+' : ''}${n}%`)
const pctTone = (n: number | null) => (n === null ? 'text-slate-400' : n > 0 ? 'text-emerald-700' : n < 0 ? 'text-red-600' : 'text-slate-600')

export default function Insights() {
  const { accounts, sales, promotions, isAdmin, repName } = useStore()
  const [tab, setTab] = useState<Tab>('Whitespace')
  const [brandF, setBrandF] = useState('')
  const [brand, setBrand] = useState<string>(BRANDS[0])
  const hasSales = sales.length > 0

  const ws = useMemo(() => whitespace(accounts, sales), [accounts, sales])
  const ro = useMemo(() => reorders(accounts, sales), [accounts, sales])
  const rep = useMemo(() => supplierReport(brand, accounts, sales), [brand, accounts, sales])
  const pr = useMemo(() => promoResults(promotions, accounts, sales), [promotions, accounts, sales])
  const wsRows = ws.filter(r => !brandF || r.brand === brandF), roRows = ro.filter(r => !brandF || r.brand === brandF)

  return (
    <div className="space-y-4">
      <PageHeader title="Sales Insights" subtitle="Where the next sale is, who is due to reorder, and what is working. Built from your Sage sales." />
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => <button key={t} onClick={() => setTab(t)} className={tab === t ? 'btn-primary' : 'btn-secondary'}>{t}</button>)}
      </div>
      {!hasSales ? <EmptyState title="No sales data yet" hint="Load the Sage sales file first (Accounts > Sales update) and these reports fill in." /> : <>

      {(tab === 'Whitespace' || tab === 'Reorders') && (
        <div className="flex items-center gap-2">
          <select className="input max-w-[200px]" value={brandF} onChange={e => setBrandF(e.target.value)}><option value="">All brands</option>{BRANDS.map(b => <option key={b}>{b}</option>)}</select>
        </div>
      )}

      {tab === 'Whitespace' && (<div className="card p-0 overflow-x-auto">
        <div className="p-4 text-sm text-slate-600">Brands a customer does not buy, but at least 30% of similar customers (same type and segment) do. The estimate is what those similar customers spend per month.</div>
        {wsRows.length === 0 ? <EmptyState title="No gaps found" hint="Needs at least 4 similar buying customers." /> : <table className="w-full text-sm">
          <thead><tr><th className="th">Customer</th><th className="th">Missing brand</th><th className="th">Similar stores buying</th><th className="th text-right">Est. per month</th>{isAdmin && <th className="th">Rep</th>}</tr></thead>
          <tbody>{wsRows.slice(0, 200).map((r, i) => <tr key={i} className="tr">
            <td className="td"><Link className="text-navy-700 underline" to={`/account/${r.account.id}`}>{r.account.name}</Link><div className="text-xs text-slate-500">{r.account.segment} · {r.account.village}</div></td>
            <td className="td font-medium">{r.brand}</td><td className="td">{r.peerPct}% ({r.peers})</td><td className="td text-right font-semibold">{money(r.estMonthly)}</td>
            {isAdmin && <td className="td">{repName(r.account.repId)}</td>}</tr>)}</tbody></table>}
        <div className="p-3 border-t flex justify-between text-sm"><span className="text-slate-500">{wsRows.length} opportunities · {money(wsRows.reduce((n, r) => n + r.estMonthly, 0))} per month if all won</span>
          <button className="btn-secondary" onClick={() => exportCSV('whitespace', wsRows.map(r => ({ Customer: r.account.name, Brand: r.brand, 'Similar stores %': r.peerPct, 'Est per month': r.estMonthly })))}><Download size={14} /> CSV</button></div>
      </div>)}

      {tab === 'Reorders' && (<div className="card p-0 overflow-x-auto">
        <div className="p-4 text-sm text-slate-600">Regular buyers (bought the brand in at least 4 of the last 6 full months) who have not bought it for 30+ days. Late = 45+ days. Sage data is monthly, so treat the days as a guide.</div>
        {roRows.length === 0 ? <EmptyState title="Nobody is due" /> : <table className="w-full text-sm">
          <thead><tr><th className="th">Customer</th><th className="th">Brand</th><th className="th">Days since last</th><th className="th">Months bought (of 6)</th><th className="th text-right">Usual per month</th></tr></thead>
          <tbody>{roRows.slice(0, 200).map((r, i) => <tr key={i} className="tr">
            <td className="td"><Link className="text-navy-700 underline" to={`/account/${r.account.id}`}>{r.account.name}</Link>{isAdmin && <div className="text-xs text-slate-500">{repName(r.account.repId)}</div>}</td>
            <td className="td font-medium">{r.brand}</td><td className="td">{r.daysSince} {r.late ? <Badge tone="Overdue">Late</Badge> : <Badge tone="Due">Due</Badge>}</td>
            <td className="td">{r.monthsBought}</td><td className="td text-right font-semibold">{money(r.avgMonthly)}</td></tr>)}</tbody></table>}
      </div>)}

      {tab === 'Supplier report' && (<div className="space-y-4 print:space-y-2">
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <select className="input max-w-[200px]" value={brand} onChange={e => setBrand(e.target.value)}>{BRANDS.map(b => <option key={b}>{b}</option>)}</select>
          <button className="btn-secondary" onClick={() => window.print()}><Printer size={14} /> Print / save PDF</button>
          <button className="btn-secondary" onClick={() => exportCSV(`${brand}-supplier-report`, rep.top.map(t => ({ Customer: t.account.name, Segment: t.account.segment, 'Sales (6 months)': t.amount })))}><Download size={14} /> Top customers CSV</button>
        </div>
        <div className="card p-4"><div className="text-lg font-bold text-navy-900">{brand} in Guam: last 6 full months</div>
          <div className="text-xs text-slate-500">Pacific Grocers · Source: Sage invoices · Prepared {fmtDate(new Date().toISOString())}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            {[['Sales', money(rep.total)], ['Stores buying', String(rep.buyers)], ['Penetration', `${rep.penetration}% of ${rep.eligible} accounts`], ['Trend (2nd half vs 1st)', pctTxt(rep.trendPct)]].map(([l, v]) =>
              <div key={l} className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">{l}</div><div className="text-lg font-bold text-navy-900">{v}</div></div>)}</div></div>
        <div className="card p-4"><div className="font-semibold mb-2">Monthly sales</div>
          <div className="h-56"><ResponsiveContainer><BarChart data={rep.months.map(m => ({ ...m, label: monthLabel(m.month) }))}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis tickFormatter={v => `$${Math.round(v / 1000)}k`} /><Tooltip formatter={(v) => money(Number(v))} /><Bar dataKey="amount" name="Sales" fill="#1e3a5f" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-0 overflow-x-auto"><div className="p-3 font-semibold">Top 10 customers</div><table className="w-full text-sm"><tbody>{rep.top.map(t => <tr key={t.account.id} className="tr"><td className="td">{t.account.name}</td><td className="td text-right">{money(t.amount)}</td></tr>)}</tbody></table></div>
          <div className="card p-0 overflow-x-auto"><div className="p-3 font-semibold">By segment</div><table className="w-full text-sm"><tbody>{rep.bySegment.map(t => <tr key={t.segment} className="tr"><td className="td">{t.segment}</td><td className="td">{t.buyers} stores</td><td className="td text-right">{money(t.amount)}</td></tr>)}</tbody></table></div>
        </div></div>)}

      {tab === 'Promo results' && (<div className="card p-0 overflow-x-auto">
        <div className="p-4 text-sm text-slate-600">Monthly brand sales in the promotion's stores: up to 2 months before vs during. Net = their change minus the change in other accounts of the same type, so a general trend is not credited to the promotion.</div>
        {pr.length === 0 ? <EmptyState title="No promotions with stores yet" hint="Add stores to a promotion in the Promotion Calendar." /> : <table className="w-full text-sm">
          <thead><tr><th className="th">Promotion</th><th className="th">Brand</th><th className="th">Stores</th><th className="th text-right">Before / month</th><th className="th text-right">During / month</th><th className="th text-right">Change</th><th className="th text-right">Other accounts</th><th className="th text-right">Net result</th></tr></thead>
          <tbody>{pr.map(r => <tr key={r.promo.id} className="tr"><td className="td"><div className="font-medium">{r.promo.name}</div><div className="text-xs text-slate-500">{fmtDate(r.promo.start)} to {fmtDate(r.promo.end)}{r.note ? ` · ${r.note}` : ''}</div></td>
            <td className="td">{r.promo.brand}</td><td className="td">{r.stores}</td><td className="td text-right">{money(r.before)}</td><td className="td text-right">{money(r.during)}</td>
            <td className={`td text-right ${pctTone(r.liftPct)}`}>{pctTxt(r.liftPct)}</td><td className="td text-right text-slate-500">{pctTxt(r.controlPct)}</td><td className={`td text-right font-bold ${pctTone(r.netPct)}`}>{pctTxt(r.netPct)}</td></tr>)}</tbody></table>}
      </div>)}
      </>}
    </div>
  )
}
