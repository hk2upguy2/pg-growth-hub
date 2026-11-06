import { FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, MapPin, Plus, SkipForward, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { Account, Territory, VILLAGES, marketOf, territoryOf } from '../types'
import { Badge, EmptyState, Field, KPI, Modal, PageHeader, useAction } from '../components/ui'
import { daysSince, fmtDate, todayStr } from '../lib/utils'
import { visitFirst } from '../lib/analytics'

export default function RoutePlanner() {
  const { accounts, routePlans, routeVisits, profiles, repName, accountName, isAdmin, saveRoutePlan, deleteRoutePlan, addVisitToPlan, updateRouteVisit, removeRouteVisit, user } = useStore()
  const run = useAction()
  const [territory, setTerritory] = useState<'All' | Territory>('All')
  const [village, setVillage] = useState('')
  const [creating, setCreating] = useState(false)
  const [date, setDate] = useState(todayStr())
  const [outcomeFor, setOutcomeFor] = useState<string | null>(null)
  const [outcome, setOutcome] = useState('')

  const ranked = useMemo(() => visitFirst(accounts.filter(a => marketOf(a) === 'Guam' &&
    (territory === 'All' || territoryOf(a.village) === territory) && (!village || a.village === village))), [accounts, territory, village])

  const plans = routePlans.filter(p => p.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const allVisits = routeVisits.filter(v => plans.some(p => p.id === v.planId))
  const done = allVisits.filter(v => v.status === 'Visited').length
  const planned = allVisits.length

  return (
    <>
      <PageHeader title="Route Planner" subtitle="Organize visits by Guam village and territory. Visit plans are lists — no GPS route optimization is included."
        actions={<button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New visit plan</button>} />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-2 space-y-3">
          <div className="card p-3 grid grid-cols-2 gap-2">
            <select className="input" value={territory} onChange={e => { setTerritory(e.target.value as 'All' | Territory); setVillage('') }}>
              <option value="All">All territories</option>{(Object.keys(VILLAGES) as Territory[]).map(t => <option key={t}>{t}</option>)}
            </select>
            <select className="input" value={village} onChange={e => setVillage(e.target.value)}>
              <option value="">All villages</option>
              {(territory === 'All' ? Object.values(VILLAGES).flat() : VILLAGES[territory]).map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div className="card">
            <h3 className="font-semibold text-navy-900 px-4 pt-4">Accounts to visit first</h3>
            <p className="text-xs text-slate-500 px-4">Scored by priority, potential, days since last visit and due follow-ups</p>
            <ul className="divide-y divide-slate-100 mt-2 max-h-[560px] overflow-y-auto">
              {ranked.map(({ account: a, daysSinceVisit, overdue }) => (
                <li key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link className="font-medium text-sm text-navy-700 hover:underline" to={`/account/${a.id}`}>{a.name}</Link>
                    <div className="text-xs text-slate-500 flex flex-wrap gap-x-2 items-center"><Badge>{a.priority}</Badge><span>{a.village} · {territoryOf(a.village)}</span><span>{daysSinceVisit === null ? 'never visited' : `${daysSinceVisit}d since visit`}</span>{overdue && <span className="text-red-600 font-semibold">follow-up due</span>}</div>
                  </div>
                  <AddToPlan account={a} plans={plans} onAdd={pid => run(() => addVisitToPlan(pid, a.id), 'Added to plan')} />
                </li>
              ))}
              {ranked.length === 0 && <EmptyState title="No accounts in this area" />}
            </ul>
          </div>
        </div>

        <div className="xl:col-span-3 space-y-3">
          <div className="card p-3 flex items-center gap-3 flex-wrap">
            <Field label="Plan date"><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></Field>
            <div className="ml-auto"><KPI label="Planned vs completed" value={`${done} / ${planned}`} hint={planned ? `${Math.round((done / planned) * 100)}% complete` : 'No visits planned'} tone={planned && done === planned ? 'green' : 'navy'} /></div>
          </div>
          {plans.length === 0 && <div className="card p-6"><EmptyState title={`No visit plans for ${fmtDate(date)}`} hint="Create a plan, then add accounts from the list on the left." /></div>}
          {plans.map(p => {
            const vs = routeVisits.filter(v => v.planId === p.id)
            return (
              <div key={p.id} className="card">
                <div className="px-4 pt-4 flex items-center justify-between gap-2">
                  <div><h3 className="font-semibold text-navy-900 flex items-center gap-2"><MapPin size={16} /> {repName(p.repId)} · {p.territory}</h3>{p.notes && <p className="text-xs text-slate-500">{p.notes}</p>}</div>
                  <button className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Delete plan" onClick={() => window.confirm('Delete this visit plan?') && run(() => deleteRoutePlan(p.id), 'Plan deleted')}><Trash2 size={16} /></button>
                </div>
                <ul className="divide-y divide-slate-100 mt-2">
                  {vs.map(v => (
                    <li key={v.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0"><Link className="font-medium text-sm text-navy-700 hover:underline" to={`/account/${v.accountId}`}>{accountName(v.accountId)}</Link>
                          <div className="text-xs text-slate-500">{accounts.find(a => a.id === v.accountId)?.village}</div></div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge>{v.status}</Badge>
                          {v.status === 'Planned' && <>
                            <button className="btn-secondary !py-1" onClick={() => { setOutcomeFor(v.id); setOutcome('') }}><Check size={14} /> Visited</button>
                            <button className="p-1.5 rounded hover:bg-slate-100" title="Skip" onClick={() => run(() => updateRouteVisit(v.id, { status: 'Skipped' }))}><SkipForward size={16} /></button>
                          </>}
                          <button className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Remove" onClick={() => run(() => removeRouteVisit(v.id))}><Trash2 size={14} /></button>
                        </div>
                      </div>
                      {v.outcome && <div className="text-xs text-slate-600 mt-1">Outcome: {v.outcome}</div>}
                      {outcomeFor === v.id && (
                        <form className="mt-2 flex gap-2" onSubmit={(e: FormEvent) => { e.preventDefault(); run(() => updateRouteVisit(v.id, { status: 'Visited', outcome }), 'Visit recorded'); setOutcomeFor(null) }}>
                          <input autoFocus required className="input" placeholder="Visit outcome" value={outcome} onChange={e => setOutcome(e.target.value)} />
                          <button className="btn-primary">Save</button><button type="button" className="btn-secondary" onClick={() => setOutcomeFor(null)}>Cancel</button>
                        </form>
                      )}
                    </li>
                  ))}
                  {vs.length === 0 && <EmptyState title="No accounts in this plan yet" />}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
      {creating && <NewPlanModal date={date} onClose={() => setCreating(false)} profiles={profiles.filter(p => p.role === 'rep' && p.active)} isAdmin={isAdmin} userId={user?.id ?? ''} accounts={accounts}
        onCreate={(d, repId, terr, notes, ids) => { run(() => saveRoutePlan({ date: d, repId, territory: terr, notes }, ids), 'Visit plan created'); setDate(d); setCreating(false) }} />}
    </>
  )
}

function AddToPlan({ account, plans, onAdd }: { account: Account; plans: { id: string; repId: string }[]; onAdd: (planId: string) => void }) {
  const { repName } = useStore()
  if (plans.length === 0) return <span className="text-xs text-slate-400">no plan</span>
  if (plans.length === 1) return <button className="btn-secondary !py-1" onClick={() => onAdd(plans[0].id)}><Plus size={14} /> Add</button>
  return <select className="input !py-1 !w-28 !text-xs" value="" onChange={e => e.target.value && onAdd(e.target.value)} aria-label={`Add ${account.name} to plan`}><option value="">+ Add to…</option>{plans.map(p => <option key={p.id} value={p.id}>{repName(p.repId)}</option>)}</select>
}

function NewPlanModal({ date, onClose, onCreate, profiles, isAdmin, userId, accounts }: {
  date: string; onClose: () => void; profiles: { id: string; name: string }[]; isAdmin: boolean; userId: string; accounts: Account[]
  onCreate: (date: string, repId: string, territory: Territory | 'All', notes: string, ids: string[]) => void
}) {
  const [d, setD] = useState(date)
  const [repId, setRepId] = useState(isAdmin ? profiles[0]?.id ?? '' : userId)
  const [terr, setTerr] = useState<Territory | 'All'>('All')
  const [notes, setNotes] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const pool = accounts.filter(a => marketOf(a) === 'Guam' && (terr === 'All' || territoryOf(a.village) === terr) && (!isAdmin || a.repId === repId))
  return (
    <Modal open onClose={onClose} title="New daily visit plan" wide>
      <form className="grid grid-cols-1 sm:grid-cols-2 gap-4" onSubmit={e => { e.preventDefault(); onCreate(d, repId, terr, notes, picked) }}>
        <Field label="Date"><input type="date" required className="input" value={d} onChange={e => setD(e.target.value)} /></Field>
        <Field label="Territory"><select className="input" value={terr} onChange={e => { setTerr(e.target.value as Territory | 'All'); setPicked([]) }}><option value="All">All</option>{(Object.keys(VILLAGES) as Territory[]).map(t => <option key={t}>{t}</option>)}</select></Field>
        {isAdmin && <Field label="Sales rep"><select className="input" value={repId} onChange={e => { setRepId(e.target.value); setPicked([]) }}>{profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
        <Field label="Notes" className={isAdmin ? '' : 'sm:col-span-1'}><input className="input" value={notes} onChange={e => setNotes(e.target.value)} /></Field>
        <div className="sm:col-span-2">
          <span className="label">Accounts to visit ({picked.length} selected)</span>
          <div className="border border-slate-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
            {pool.map(a => (
              <label key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={picked.includes(a.id)} onChange={e => setPicked(p => (e.target.checked ? [...p, a.id] : p.filter(x => x !== a.id)))} />
                <span className="flex-1">{a.name}</span><span className="text-xs text-slate-500">{a.village} · {daysSince(a.lastVisit) === null ? 'never' : `${daysSince(a.lastVisit)}d`}</span>
              </label>
            ))}
            {pool.length === 0 && <div className="p-3 text-sm text-slate-500">No accounts in this selection.</div>}
          </div>
        </div>
        <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary">Create plan</button></div>
      </form>
    </Modal>
  )
}
