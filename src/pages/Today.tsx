import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarClock, Check, MapPin, MessageSquare, Navigation, Phone, PhoneOff, Plus, RefreshCw, Route as RouteIcon, TrendingDown } from 'lucide-react'
import { useStore } from '../lib/store'
import { lapsedAccounts, unreadMessages } from '../lib/analytics'
import { reorders } from '../lib/insights'
import { openLogVisit } from '../components/QuickVisit'
import { useAction } from '../components/ui'
import { fmtDate, money, todayStr } from '../lib/utils'
import type { Account } from '../types'

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
const mapsUrl = (a: Account) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a.name} ${a.village} Guam`)}`

/** Three one-tap buttons for any customer row: call, directions, log a visit. */
function Actions({ a }: { a: Account }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {a.phone ? <a href={`tel:${a.phone}`} aria-label={`Call ${a.name}`} className="h-11 w-11 rounded-full border border-slate-300 flex items-center justify-center text-navy-800 hover:bg-slate-50"><Phone size={18} /></a>
        : <span className="h-11 w-11 rounded-full border border-slate-200 flex items-center justify-center text-slate-300" title="No phone number"><PhoneOff size={18} /></span>}
      <a href={mapsUrl(a)} target="_blank" rel="noreferrer" aria-label={`Directions to ${a.name}`} className="h-11 w-11 rounded-full border border-slate-300 flex items-center justify-center text-navy-800 hover:bg-slate-50"><Navigation size={18} /></a>
      <button onClick={() => openLogVisit(a.id)} aria-label={`Log visit at ${a.name}`} className="h-11 rounded-full bg-navy-800 text-white px-4 text-sm font-semibold flex items-center gap-1.5 hover:bg-navy-700"><Plus size={16} /> Visit</button>
    </div>
  )
}

function Row({ a, why, tone = 'text-slate-500' }: { a: Account; why: string; tone?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 border-t border-slate-100 first:border-t-0">
      <Link to={`/account/${a.id}`} className="min-w-0 basis-full sm:basis-0 sm:flex-1">
        <div className="font-semibold text-navy-900">{a.name}</div>
        <div className={`text-sm ${tone}`}>{why}</div>
        <div className="text-xs text-slate-400 flex items-center gap-1"><MapPin size={11} /> {a.village}</div>
      </Link>
      <Actions a={a} />
    </div>
  )
}

function Section({ icon, title, count, children, tone = 'text-navy-800' }: { icon: React.ReactNode; title: string; count?: number; children: React.ReactNode; tone?: string }) {
  return (
    <section className="card p-4">
      <h2 className={`font-bold flex items-center gap-2 mb-1 ${tone}`}>{icon}{title}{count !== undefined && <span className="text-xs font-semibold bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{count}</span>}</h2>
      {children}
    </section>
  )
}

export default function Today() {
  const { user, accounts, activities, sales, routePlans, routeVisits, messages, messageReads, orders, completeFollowUp } = useStore()
  const run = useAction()
  const today = todayStr()
  const byId = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts])

  const planIds = new Set(routePlans.filter(p => p.date === today).map(p => p.id))
  const stops = routeVisits.filter(v => planIds.has(v.planId) && byId.has(v.accountId))
  const todo = stops.filter(v => v.status === 'Planned'), done = stops.filter(v => v.status !== 'Planned')

  const followUps = activities.filter(a => a.followUpDate && !a.followUpDone && a.followUpDate <= today && byId.has(a.accountId)).sort((a, b) => a.followUpDate!.localeCompare(b.followUpDate!))
  const due = useMemo(() => reorders(accounts, sales).slice(0, 5), [accounts, sales])
  const lapsed = useMemo(() => lapsedAccounts(accounts, 30).slice(0, 5), [accounts])
  const owing = useMemo(() => accounts.filter(a => (a.overdueBalance ?? 0) > 0).sort((a, b) => (b.overdueBalance ?? 0) - (a.overdueBalance ?? 0)).slice(0, 3), [accounts])
  const unread = unreadMessages(user?.id, messages, messageReads)
  const waiting = orders.filter(o => o.status === 'Submitted')
  const nothing = !todo.length && !followUps.length && !due.length && !lapsed.length && !owing.length && !unread.length

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">{greeting()}, {user?.name.split(' ')[0]}</h1>
        <p className="text-slate-500 text-sm">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      <button onClick={() => openLogVisit()} className="w-full rounded-2xl bg-navy-800 text-white py-4 text-lg font-bold flex items-center justify-center gap-2 shadow hover:bg-navy-700"><Plus size={22} /> Log a visit</button>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[[todo.length, 'stops today', '/routes'], [followUps.length, 'follow-ups', '/activities'], [unread.length, 'messages', '/messages']].map(([n, l, to]) => (
          <Link key={String(l)} to={String(to)} className="card py-3"><div className="text-2xl font-bold text-navy-900">{n}</div><div className="text-xs text-slate-500">{l}</div></Link>))}
      </div>

      {unread.length > 0 && <Link to="/messages" className="rounded-xl border border-blue-300 bg-blue-50 text-blue-900 px-4 py-3 flex items-center gap-3 font-medium"><MessageSquare size={18} /> {unread.length} unread message{unread.length > 1 ? 's' : ''} from management{unread.some(m => m.urgent) ? ' (urgent)' : ''}</Link>}

      {nothing && <div className="card p-8 text-center"><Check className="mx-auto text-emerald-600 mb-2" size={32} /><div className="font-bold text-navy-900">You are all caught up</div><div className="text-sm text-slate-500">Nothing is waiting. Plan a route or visit a prospect.</div><Link to="/routes" className="btn-primary mt-4 inline-flex">Plan my route</Link></div>}

      {(todo.length > 0 || done.length > 0) && (
        <Section icon={<RouteIcon size={18} />} title="Today's route" count={todo.length}>
          {todo.map(v => <Row key={v.id} a={byId.get(v.accountId)!} why="Planned stop" />)}
          {done.length > 0 && <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">{done.length} done today</div>}
        </Section>)}

      {followUps.length > 0 && (
        <Section icon={<CalendarClock size={18} />} title="Follow-ups due" count={followUps.length} tone="text-amber-800">
          {followUps.slice(0, 6).map(f => { const a = byId.get(f.accountId)!; const late = f.followUpDate! < today
            return (<div key={f.id}><Row a={a} why={`${late ? 'Overdue since ' : 'Due today · '}${fmtDate(f.followUpDate!)}${f.nextAction ? ` · ${f.nextAction}` : ''}`} tone={late ? 'text-red-600 font-medium' : 'text-amber-700'} />
              <button className="text-xs font-semibold text-emerald-700 hover:underline -mt-1 mb-2 flex items-center gap-1" onClick={() => run(() => completeFollowUp(f.id), 'Marked done')}><Check size={13} /> Mark done</button></div>) })}
          {followUps.length > 6 && <Link to="/activities" className="text-sm text-navy-700 hover:underline">See all {followUps.length}</Link>}
        </Section>)}

      {due.length > 0 && (
        <Section icon={<RefreshCw size={18} />} title="Due to reorder" count={due.length}>
          {due.map(r => <Row key={r.account.id + r.brand} a={r.account} why={`${r.brand}: ${r.daysSince} days since last order · usually ${money(r.avgMonthly)}/month`} tone={r.late ? 'text-red-600' : 'text-slate-500'} />)}
          <Link to="/insights" className="text-sm text-navy-700 hover:underline">More in Sales Insights</Link>
        </Section>)}

      {lapsed.length > 0 && (
        <Section icon={<TrendingDown size={18} />} title="Stopped ordering" count={lapsed.length} tone="text-red-700">
          {lapsed.map(l => <Row key={l.account.id} a={l.account} why={`${l.since} days since last order`} tone="text-red-600" />)}
          <Link to="/accounts?lapsed=1" className="text-sm text-navy-700 hover:underline">See all</Link>
        </Section>)}

      {owing.length > 0 && (
        <Section icon={<AlertTriangle size={18} />} title="Owes money" count={owing.length} tone="text-red-700">
          {owing.map(a => <Row key={a.id} a={a} why={`${money(a.overdueBalance ?? 0)} overdue. Remind them politely.`} tone="text-red-600" />)}
        </Section>)}

      {waiting.length > 0 && <Link to="/orders" className="block text-center text-sm text-slate-500 hover:underline">{waiting.length} of your orders are waiting for the office</Link>}
      <div className="text-center pt-2"><Link to="/dashboard" className="text-sm text-navy-700 hover:underline">See my numbers</Link></div>
    </div>
  )
}
