import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle } from 'lucide-react'
import { useStore } from '../lib/store'
import { Badge, EmptyState, PageHeader } from '../components/ui'
import { isOpen, weighted } from '../lib/analytics'
import { fmtDate, money, monthKey, monthLabel, todayStr } from '../lib/utils'
import { BRANDS, STAGES, STAGE_DEFAULT_PROB, STAGE_DEFINITIONS } from '../types'

export default function Forecast() {
  const { opportunities, accountName, repName, isAdmin } = useStore()
  const today = todayStr()
  const open = useMemo(() => opportunities.filter(isOpen), [opportunities])

  // forecast by expected close month
  const byMonth = useMemo(() => {
    const m = new Map<string, { month: string; weighted: number; gross: number; count: number }>()
    open.forEach(o => {
      const k = monthKey(o.expectedClose)
      const r = m.get(k) ?? { month: k, weighted: 0, gross: 0, count: 0 }
      r.weighted += weighted(o); r.gross += o.monthlyValue; r.count++
      m.set(k, r)
    })
    return [...m.values()].sort((a, b) => a.month.localeCompare(b.month)).map(r => ({ ...r, label: monthLabel(r.month), weighted: Math.round(r.weighted), gross: Math.round(r.gross) }))
  }, [open])

  // win rate and loss reasons from closed opportunities
  const won = opportunities.filter(o => o.stage === 'Won'), lost = opportunities.filter(o => o.stage === 'Lost')
  const winRate = won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null
  const byBrand = BRANDS.map(b => {
    const w = won.filter(o => o.brand === b).length, l = lost.filter(o => o.brand === b).length
    const o = open.filter(x => x.brand === b)
    return { brand: b, open: o.length, weighted: o.reduce((n, x) => n + weighted(x), 0), won: w, lost: l, rate: w + l ? Math.round((w / (w + l)) * 100) : null }
  }).filter(r => r.open + r.won + r.lost > 0)
  const reasons = useMemo(() => {
    const m = new Map<string, { n: number; value: number }>()
    lost.forEach(o => { const k = o.lostReason?.trim() || 'No reason recorded'; const r = m.get(k) ?? { n: 0, value: 0 }; r.n++; r.value += o.monthlyValue; m.set(k, r) })
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n)
  }, [lost])

  // pipeline hygiene: what a manager should chase
  const overdue = open.filter(o => o.expectedClose < today)
  const noNext = open.filter(o => !o.nextAction?.trim())
  const total = open.reduce((n, o) => n + weighted(o), 0)
  const gross = open.reduce((n, o) => n + o.monthlyValue, 0)

  return (
    <>
      <PageHeader title="Forecast" subtitle={isAdmin ? 'Weighted pipeline by closing month, win rates and pipeline health' : 'Your weighted pipeline, win rate and what needs attention'} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Weighted pipeline" value={money(Math.round(total))} note={`${open.length} open · ${money(Math.round(gross))} gross`} />
        <Stat label="Win rate" value={winRate === null ? '—' : `${winRate}%`} note={`${won.length} won · ${lost.length} lost`} />
        <Stat label="Past expected close" value={String(overdue.length)} note="still open after the date" warn={overdue.length > 0} />
        <Stat label="No next action" value={String(noNext.length)} note="open with nothing planned" warn={noNext.length > 0} />
      </div>

      <div className="card p-4 mb-4">
        <h3 className="font-semibold text-navy-900 mb-1">Forecast by expected closing month</h3>
        <p className="text-xs text-slate-500 mb-3">Monthly value of open opportunities, grossed and weighted by stage probability. Accurate only if closing dates are kept current.</p>
        {byMonth.length === 0 ? <EmptyState title="No open opportunities" /> : (
          <div className="h-64"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={byMonth}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis tickFormatter={v => money(Number(v))} width={70} />
              <Tooltip formatter={v => money(Number(v))} /><Legend />
              <Bar dataKey="gross" name="Gross" fill="#bcc8dc" radius={[4, 4, 0, 0]} /><Bar dataKey="weighted" name="Weighted" fill="#1e3a6b" radius={[4, 4, 0, 0]} />
            </BarChart></ResponsiveContainer></div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card overflow-x-auto">
          <h3 className="font-semibold text-navy-900 px-4 pt-4">By brand</h3>
          <table className="w-full min-w-[420px] mt-2"><thead><tr><th className="th">Brand</th><th className="th">Open</th><th className="th">Weighted</th><th className="th">Won</th><th className="th">Lost</th><th className="th">Win rate</th></tr></thead>
            <tbody>{byBrand.map(r => <tr key={r.brand}><td className="td font-medium">{r.brand}</td><td className="td">{r.open}</td><td className="td">{money(Math.round(r.weighted))}</td><td className="td">{r.won}</td><td className="td">{r.lost}</td><td className="td">{r.rate === null ? '—' : `${r.rate}%`}</td></tr>)}</tbody></table>
        </div>
        <div className="card overflow-x-auto">
          <h3 className="font-semibold text-navy-900 px-4 pt-4">Why we lose</h3>
          {reasons.length === 0 ? <p className="text-sm text-slate-500 px-4 py-4">No lost opportunities yet. Every lost opportunity must record a reason.</p> : (
            <table className="w-full min-w-[320px] mt-2"><thead><tr><th className="th">Reason</th><th className="th">Count</th><th className="th">Monthly value lost</th></tr></thead>
              <tbody>{reasons.map(([k, r]) => <tr key={k}><td className="td">{k}</td><td className="td">{r.n}</td><td className="td">{money(Math.round(r.value))}</td></tr>)}</tbody></table>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto mb-4">
        <h3 className="font-semibold text-navy-900 px-4 pt-4 flex items-center gap-2"><AlertTriangle size={16} className="text-amber-600" /> Needs attention</h3>
        {overdue.length + noNext.length === 0 ? <p className="text-sm text-slate-500 px-4 py-4">Every open opportunity has a next action and a future closing date.</p> : (
          <table className="w-full min-w-[640px] mt-2"><thead><tr><th className="th">Account</th><th className="th">Brand / product</th><th className="th">Stage</th><th className="th">Expected close</th><th className="th">Issue</th>{isAdmin && <th className="th">Rep</th>}</tr></thead>
            <tbody>{[...new Set([...overdue, ...noNext])].sort((a, b) => a.expectedClose.localeCompare(b.expectedClose)).slice(0, 25).map(o => (
              <tr key={o.id}><td className="td"><Link className="text-navy-700 font-medium hover:underline" to={`/account/${o.accountId}`}>{accountName(o.accountId)}</Link></td>
                <td className="td">{o.brand} · {o.product}</td><td className="td"><Badge>{o.stage}</Badge></td><td className="td">{fmtDate(o.expectedClose)}</td>
                <td className="td text-xs">{o.expectedClose < today ? <span className="text-red-700">Close date passed</span> : null}{o.expectedClose < today && !o.nextAction?.trim() ? ' · ' : ''}{!o.nextAction?.trim() ? <span className="text-amber-700">No next action</span> : null}</td>
                {isAdmin && <td className="td">{repName(o.repId)}</td>}</tr>))}</tbody></table>
        )}
      </div>

      <div className="card p-4">
        <h3 className="font-semibold text-navy-900 mb-2">Stage definitions</h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {STAGES.map(s => <div key={s}><dt className="font-medium text-navy-900">{s} <span className="text-xs text-slate-500 font-normal">· {STAGE_DEFAULT_PROB[s]}%</span></dt><dd className="text-slate-600">{STAGE_DEFINITIONS[s]}</dd></div>)}
        </dl>
        <p className="text-xs text-slate-500 mt-3">Rules: every open opportunity needs a next action and an expected closing date; a lost opportunity needs a reason.</p>
      </div>
    </>
  )
}

function Stat({ label, value, note, warn }: { label: string; value: string; note: string; warn?: boolean }) {
  return (
    <div className={`card p-4 ${warn ? 'border-amber-300 bg-amber-50' : ''}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-navy-900 mt-1">{value}</div>
      <div className="text-xs text-slate-500">{note}</div>
    </div>
  )
}
