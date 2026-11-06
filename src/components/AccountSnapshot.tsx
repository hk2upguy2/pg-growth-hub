import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CalendarClock, Megaphone, PackageCheck, Wallet } from 'lucide-react'
import { Account, Activity, Opportunity, Promotion, SalesRecord } from '../types'
import { daysSince, fmtDate, money, monthLabel, todayStr } from '../lib/utils'
import { isOpen } from '../lib/analytics'

const mk = (back: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - back); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

/** The one-page answer to "what do I need to know before I call or visit this customer?" */
export function AccountSnapshot({ a, sales, acts, opps, promotions }: { a: Account; sales: SalesRecord[]; acts: Activity[]; opps: Opportunity[]; promotions: Promotion[] }) {
  const today = todayStr()
  const mine = sales.filter(s => s.accountId === a.id)
  const recent = new Set([mk(0), mk(1), mk(2)]), prior = new Set([mk(3), mk(4), mk(5)])
  const sum = (set: Set<string>, brand?: string) => mine.filter(s => set.has(s.month) && (!brand || s.brand === brand)).reduce((n, s) => n + s.amount, 0)
  const brands = [...new Set(mine.map(s => s.brand))].map(b => ({ brand: b, now: sum(recent, b), before: sum(prior, b) })).sort((x, y) => y.now - x.now)
  const totalNow = sum(recent), totalBefore = sum(prior)
  const trend = totalBefore > 0 ? Math.round(((totalNow - totalBefore) / totalBefore) * 100) : null
  const newest = [...mine].sort((x, y) => (y.lastDate ?? y.month).localeCompare(x.lastDate ?? x.month))[0]
  const lastMonthAmt = newest ? mine.filter(s => s.month === newest.month).reduce((n, s) => n + s.amount, 0) : 0
  const sinceOrder = daysSince(a.lastOrderDate ?? null)
  const sinceVisit = daysSince(a.lastVisit)
  const overdueFu = acts.filter(x => x.followUpDate && !x.followUpDone && x.followUpDate < today)
  const openOpps = opps.filter(isOpen)
  const live = promotions.filter(p => p.accountIds.includes(a.id) && p.end >= today && p.status !== 'Cancelled')

  // next best action: first rule that applies wins
  let next: { text: string; tone: 'red' | 'amber' | 'blue' }
  const closing = openOpps.find(o => o.stage === 'Negotiation' || o.stage === 'Quotation Submitted')
  if ((a.overdueBalance ?? 0) > 0) next = { text: `Collect the overdue balance of ${money(a.overdueBalance ?? 0)} before pushing new orders.`, tone: 'red' }
  else if ((a.status === 'Active' || a.monthlySales > 0) && sinceOrder !== null && sinceOrder >= 30) next = { text: `Call today: no order for ${sinceOrder} days (usually ${money(a.monthlySales)} a month).`, tone: 'red' }
  else if (overdueFu.length) next = { text: `Do the overdue follow-up: ${overdueFu[0].nextAction || overdueFu[0].summary}.`, tone: 'amber' }
  else if (closing) next = { text: `Close the ${closing.brand} ${closing.product} opportunity (${closing.stage}). Next step: ${closing.nextAction || 'agree price and first order'}.`, tone: 'amber' }
  else if (sinceVisit === null || sinceVisit >= 30) next = { text: sinceVisit === null ? 'Make a first visit: this account has never been visited.' : `Visit: not seen for ${sinceVisit} days.`, tone: 'amber' }
  else if (a.status === 'Prospect' && openOpps.length === 0) next = { text: 'Open an opportunity for the product that fits this account.', tone: 'blue' }
  else next = { text: 'On track. Confirm the next reorder date and look for a second brand to add.', tone: 'blue' }
  const toneCls = { red: 'border-red-300 bg-red-50 text-red-900', amber: 'border-amber-300 bg-amber-50 text-amber-900', blue: 'border-navy-200 bg-navy-50 text-navy-900' }[next.tone]

  return (
    <div className="card p-4 mb-4">
      <div className={`rounded-lg border px-3 py-2.5 text-sm flex items-start gap-2 ${toneCls}`}>
        {next.tone === 'blue' ? <ArrowRight size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
        <div><span className="font-semibold">Next best action: </span>{next.text}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-sm">
        <div>
          <div className="label flex items-center gap-1"><PackageCheck size={14} /> What they buy (last 3 months)</div>
          {brands.length === 0 ? <p className="text-slate-500">No Sage sales loaded for this account.</p> : (
            <ul className="space-y-1">
              {brands.map(b => <li key={b.brand} className="flex justify-between"><span>{b.brand}</span><span className="font-semibold text-navy-900">{money(b.now)}{b.before > 0 && <span className={`ml-1 text-xs font-normal ${b.now >= b.before ? 'text-emerald-600' : 'text-red-600'}`}>{b.now >= b.before ? '▲' : '▼'}{Math.abs(Math.round(((b.now - b.before) / b.before) * 100))}%</span>}</span></li>)}
              <li className="flex justify-between border-t border-slate-200 pt-1"><span className="text-slate-500">Total</span><span className="font-semibold text-navy-900">{money(totalNow)}{trend !== null && <span className={`ml-1 text-xs font-normal ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{trend >= 0 ? '▲' : '▼'}{Math.abs(trend)}% vs prior 3 months</span>}</span></li>
            </ul>
          )}
        </div>
        <div>
          <div className="label flex items-center gap-1"><CalendarClock size={14} /> Last order</div>
          {a.lastOrderDate
            ? <><div className="font-semibold text-navy-900">{fmtDate(a.lastOrderDate)} <span className="text-xs font-normal text-slate-500">({sinceOrder === 0 ? 'today' : `${sinceOrder} days ago`})</span></div>
                {newest && <div className="text-slate-600">{monthLabel(newest.month)} total {money(lastMonthAmt)}</div>}</>
            : <p className="text-slate-500">No order recorded yet.</p>}
          <div className="text-slate-600 mt-1">Last visit: {a.lastVisit ? `${fmtDate(a.lastVisit)} (${sinceVisit} days ago)` : 'never'}</div>
          {openOpps.length > 0 && <div className="text-slate-600">{openOpps.length} open opportunit{openOpps.length > 1 ? 'ies' : 'y'}: {openOpps.map(o => o.brand).join(', ')}</div>}
        </div>
        <div>
          <div className="label flex items-center gap-1"><Wallet size={14} /> What they owe</div>
          {(a.balanceDue ?? 0) === 0 && (a.overdueBalance ?? 0) === 0 ? <p className="text-slate-500">No balance recorded.</p> : (
            <><div className="flex justify-between"><span>Balance</span><span className="font-semibold text-navy-900">{money(a.balanceDue ?? 0)}</span></div>
              <div className="flex justify-between"><span>Overdue</span><span className={`font-semibold ${(a.overdueBalance ?? 0) > 0 ? 'text-red-700' : 'text-navy-900'}`}>{money(a.overdueBalance ?? 0)}</span></div></>
          )}
          <div className="label flex items-center gap-1 mt-3"><Megaphone size={14} /> On promotion</div>
          {live.length === 0 ? <p className="text-slate-500">None running.</p> : <ul className="space-y-0.5">{live.map(p => <li key={p.id}><Link className="text-navy-700 hover:underline" to="/promotions">{p.name}</Link> <span className="text-xs text-slate-500">{p.brand} · to {fmtDate(p.end)}</span></li>)}</ul>}
        </div>
      </div>
    </div>
  )
}

/** Shown wherever a rep is about to take an order or quote for a customer who owes overdue money. */
export function OverdueWarning({ account }: { account?: Account }) {
  if (!account || (account.overdueBalance ?? 0) <= 0) return null
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm px-3 py-2 flex items-start gap-2">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <div><strong>{account.name} has {money(account.overdueBalance ?? 0)} overdue</strong> (balance {money(account.balanceDue ?? 0)}{account.balanceUpdated ? `, as of ${fmtDate(account.balanceUpdated)}` : ''}). Check with management before taking a new order.</div>
    </div>
  )
}
