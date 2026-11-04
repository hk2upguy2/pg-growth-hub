import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Mail, MapPin, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { AccountForm, ActivityForm, OpportunityForm } from '../components/forms'
import { Badge, ConfirmButton, DemoBadge, EmptyState, PageHeader, useAction } from '../components/ui'
import { daysSince, fmtDate, fmtDateTime, money } from '../lib/utils'
import { territoryOf } from '../types'
import { pipelineTotals, weighted } from '../lib/analytics'

export default function AccountDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { accounts, activities, opportunities, competitors, routeVisits, routePlans, repName, isAdmin, deleteAccount, completeFollowUp, deleteActivity } = useStore()
  const run = useAction()
  const [edit, setEdit] = useState(false)
  const [logging, setLogging] = useState(false)
  const [oppOpen, setOppOpen] = useState(false)
  const a = accounts.find(x => x.id === id)
  if (!a) return <div className="card p-8"><EmptyState title="Account not found or not assigned to you" /><div className="text-center"><Link className="btn-secondary" to="/accounts">Back to directory</Link></div></div>

  const acts = activities.filter(x => x.accountId === a.id).sort((x, y) => (x.at < y.at ? 1 : -1))
  const opps = opportunities.filter(x => x.accountId === a.id)
  const visits = acts.filter(x => ['Customer Visit', 'New Account Opening', 'Product Presentation', 'Product Sampling'].includes(x.type))
  const routed = routeVisits.filter(v => v.accountId === a.id && v.status === 'Visited')
  const followUps = acts.filter(x => x.followUpDate && !x.followUpDone).sort((x, y) => (x.followUpDate! < y.followUpDate! ? -1 : 1))
  const comp = competitors.filter(c => c.accountId === a.id)
  const pt = pipelineTotals(opps)
  const attain = a.monthlyPotential > 0 ? Math.round((a.monthlySales / a.monthlyPotential) * 100) : 0

  return (
    <>
      <button onClick={() => nav(-1)} className="text-sm text-navy-600 hover:underline inline-flex items-center gap-1 mb-2"><ArrowLeft size={14} /> Back</button>
      <PageHeader
        title={a.name}
        subtitle={`${a.accountNo} · ${a.type} · ${a.segment}`}
        actions={<>
          <button className="btn-secondary" onClick={() => setLogging(true)}><Plus size={16} /> Log activity</button>
          <button className="btn-secondary" onClick={() => setOppOpen(true)}><Plus size={16} /> Opportunity</button>
          <button className="btn-primary" onClick={() => setEdit(true)}><Pencil size={16} /> Edit</button>
          {isAdmin && <ConfirmButton message={`Delete ${a.name} and all its activities, opportunities and competitor records?`} onConfirm={() => { if (run(() => deleteAccount(a.id), 'Account deleted') !== undefined || true) nav('/accounts') }}><Trash2 size={16} /> Delete</ConfirmButton>}
        </>}
      />
      {a.isDemo && <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900"><DemoBadge /> Illustrative demo record — not a confirmed Pacific Grocers customer. Dollar figures are illustrative estimates.</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="card p-4 lg:col-span-2">
          <h3 className="font-semibold text-navy-900 mb-3">Account profile</h3>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
            <Info k="Priority"><Badge>{a.priority}</Badge></Info>
            <Info k="Status"><Badge>{a.status}</Badge></Info>
            <Info k="Assigned rep">{repName(a.repId)}</Info>
            <Info k="Village / territory">{a.village} · {territoryOf(a.village)}</Info>
            <Info k="Est. monthly potential">{money(a.monthlyPotential)}</Info>
            <Info k="Actual monthly sales">{money(a.monthlySales)}</Info>
            <Info k="Products purchased">{a.currentProducts || '—'}</Info>
            <Info k="Potential products">{a.potentialProducts || '—'}</Info>
            <Info k="Competitor / supplier">{a.competitor || '—'}</Info>
            <Info k="Last visit">{fmtDate(a.lastVisit)}{daysSince(a.lastVisit) !== null && <span className="text-xs text-slate-500"> ({daysSince(a.lastVisit)}d ago)</span>}</Info>
            <Info k="Next follow-up">{fmtDate(a.nextFollowUp)}</Info>
            <Info k="Date created">{fmtDate(a.createdAt)}</Info>
          </dl>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-navy-900 mb-3">Contact information</h3>
          <div className="text-sm space-y-2">
            <div className="font-medium">{a.contactName || '—'}</div>
            <div className="text-slate-500 text-xs">{a.contactPosition}</div>
            <div className="flex items-center gap-2"><Phone size={14} className="text-slate-400" />{a.phone ? <a className="text-navy-700 hover:underline" href={`tel:${a.phone}`}>{a.phone}</a> : '—'}</div>
            <div className="flex items-center gap-2"><Mail size={14} className="text-slate-400" />{a.email ? <a className="text-navy-700 hover:underline" href={`mailto:${a.email}`}>{a.email}</a> : '—'}</div>
            <div className="flex items-start gap-2"><MapPin size={14} className="text-slate-400 mt-0.5" />{a.address || '—'}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="card p-4">
          <h3 className="font-semibold text-navy-900 mb-3">Account performance</h3>
          <div className="space-y-2 text-sm">
            <Row k="Monthly sales vs potential" v={`${attain}%`} />
            <div className="h-2 rounded bg-slate-100 overflow-hidden"><div className="h-full bg-navy-700" style={{ width: `${Math.min(attain, 100)}%` }} /></div>
            <Row k="Open opportunities" v={String(pt.openCount)} />
            <Row k="Open pipeline / mo" v={money(pt.gross)} />
            <Row k="Weighted pipeline / mo" v={money(pt.weighted)} />
            <Row k="Won / Lost" v={`${pt.wonCount} / ${pt.lostCount}`} />
            <Row k="Activities logged" v={String(acts.length)} />
          </div>
        </div>
        <div className="card p-4 lg:col-span-2">
          <h3 className="font-semibold text-navy-900 mb-3">Follow-up schedule</h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {followUps.map(f => (
              <li key={f.id} className="py-2 flex items-center justify-between gap-3">
                <div><span className={f.followUpDate! < new Date().toISOString().slice(0, 10) ? 'text-red-600 font-semibold' : 'font-semibold'}>{fmtDate(f.followUpDate)}</span> — {f.nextAction || f.summary}</div>
                <button className="btn-secondary !py-1" onClick={() => run(() => completeFollowUp(f.id), 'Follow-up completed')}><Check size={14} /> Done</button>
              </li>
            ))}
            {followUps.length === 0 && <EmptyState title="No open follow-ups" />}
          </ul>
        </div>
      </div>

      <div className="card mb-4">
        <h3 className="font-semibold text-navy-900 px-4 pt-4">Product opportunities</h3>
        <div className="overflow-x-auto"><table className="w-full min-w-[600px] mt-2"><thead><tr><th className="th">Brand</th><th className="th">Product</th><th className="th">Stage</th><th className="th">Est. monthly</th><th className="th">Prob.</th><th className="th">Weighted</th><th className="th">Next action</th></tr></thead>
          <tbody>{opps.map(o => <tr key={o.id}><td className="td">{o.brand}</td><td className="td">{o.product}</td><td className="td"><Badge>{o.stage}</Badge></td><td className="td">{money(o.monthlyValue)}</td><td className="td">{o.probability}%</td><td className="td">{money(weighted(o))}</td><td className="td">{o.nextAction}</td></tr>)}</tbody></table>
          {opps.length === 0 && <EmptyState title="No opportunities yet" />}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card">
          <h3 className="font-semibold text-navy-900 px-4 pt-4">Sales activity history</h3>
          <ul className="divide-y divide-slate-100 mt-2 max-h-96 overflow-y-auto">
            {acts.map(x => (
              <li key={x.id} className="px-4 py-2.5 text-sm">
                <div className="flex justify-between gap-2"><span className="font-medium">{x.type}</span><span className="text-xs text-slate-500">{fmtDateTime(x.at)}</span></div>
                <div className="text-slate-600">{x.summary}</div>
                <div className="text-xs text-slate-500">{repName(x.repId)}{x.outcome && ` · Outcome: ${x.outcome}`}</div>
                <button className="text-xs text-red-500 hover:underline mt-1" onClick={() => window.confirm('Delete this activity?') && run(() => deleteActivity(x.id), 'Activity deleted')}>Delete</button>
              </li>
            ))}
            {acts.length === 0 && <EmptyState title="No activity yet" />}
          </ul>
        </div>
        <div className="card">
          <h3 className="font-semibold text-navy-900 px-4 pt-4">Visit history</h3>
          <ul className="divide-y divide-slate-100 mt-2 max-h-96 overflow-y-auto">
            {visits.map(x => <li key={x.id} className="px-4 py-2.5 text-sm"><div className="flex justify-between"><span>{x.type}</span><span className="text-xs text-slate-500">{fmtDate(x.at)}</span></div><div className="text-xs text-slate-500">{repName(x.repId)}</div></li>)}
            {visits.length === 0 && <EmptyState title="No visits recorded" />}
          </ul>
          {routed.length > 0 && <div className="px-4 pb-3 text-xs text-slate-500">{routed.length} visit(s) completed via route plans</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4"><h3 className="font-semibold text-navy-900 mb-2">Notes</h3><p className="text-sm text-slate-700 whitespace-pre-wrap">{a.notes || 'No notes.'}</p></div>
        <div className="card p-4"><h3 className="font-semibold text-navy-900 mb-2">Competitor observations</h3>
          {comp.map(c => <div key={c.id} className="text-sm border-b border-slate-100 py-2 last:border-0"><div className="font-medium">{c.competitor} <span className="text-xs text-slate-500">· {fmtDate(c.recordedAt)}</span></div><div className="text-slate-600">{c.products} {c.price && `· ${c.price}`}</div><div className="text-xs text-slate-500">{c.observations}</div></div>)}
          {comp.length === 0 && <div className="text-sm text-slate-500">None recorded.</div>}</div>
      </div>
      {routePlans.length < 0 && null}
      {edit && <AccountForm open onClose={() => setEdit(false)} account={a} />}
      {logging && <ActivityForm open onClose={() => setLogging(false)} defaultAccountId={a.id} />}
      {oppOpen && <OpportunityForm open onClose={() => setOppOpen(false)} defaultAccountId={a.id} />}
    </>
  )
}
const Info = ({ k, children }: { k: string; children: React.ReactNode }) => <div><dt className="label !mb-0.5">{k}</dt><dd className="text-slate-800">{children}</dd></div>
const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between"><span className="text-slate-500">{k}</span><span className="font-semibold text-navy-900">{v}</span></div>
