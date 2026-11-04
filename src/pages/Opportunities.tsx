import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid, List, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { BRANDS, Opportunity, STAGES, Stage, STAGE_DEFAULT_PROB } from '../types'
import { OpportunityForm } from '../components/forms'
import { Badge, EmptyState, ExportMenu, KPI, PageHeader, useAction } from '../components/ui'
import { exportCSV, exportXLS, fmtDate, money } from '../lib/utils'
import { pipelineTotals, weighted } from '../lib/analytics'

export function oppRows(list: Opportunity[], repName: (i: string) => string, accountName: (i: string) => string) {
  return list.map(o => ({
    Account: accountName(o.accountId), Brand: o.brand, Product: o.product, 'Est. Monthly Sales': o.monthlyValue, Stage: o.stage,
    'Probability %': o.probability, 'Weighted Value': Math.round(weighted(o)), 'Expected Close': o.expectedClose,
    Representative: repName(o.repId), 'Next Action': o.nextAction, 'Lost Reason': o.lostReason ?? '', Notes: o.notes,
  }))
}

export default function Opportunities() {
  const { opportunities, profiles, repName, accountName, isAdmin, saveOpportunity, deleteOpportunity } = useStore()
  const run = useAction()
  const [brand, setBrand] = useState('')
  const [stage, setStage] = useState('')
  const [rep, setRep] = useState('')
  const [view, setView] = useState<'table' | 'board'>('table')
  const [editing, setEditing] = useState<Opportunity | undefined>()
  const [adding, setAdding] = useState(false)

  const rows = useMemo(() => opportunities
    .filter(o => (!brand || o.brand === brand) && (!stage || o.stage === stage) && (!rep || o.repId === rep))
    .sort((a, b) => weighted(b) - weighted(a) || b.monthlyValue - a.monthlyValue), [opportunities, brand, stage, rep])
  const pt = pipelineTotals(rows)
  const exp = () => oppRows(rows, repName, accountName)

  const moveStage = (o: Opportunity, s: Stage) =>
    run(() => saveOpportunity({ id: o.id, accountId: o.accountId, stage: s, probability: STAGE_DEFAULT_PROB[s] }), `Moved to ${s}`)

  return (
    <>
      <PageHeader title="Opportunities" subtitle={`${rows.length} opportunities · weighted pipeline calculated automatically`}
        actions={<>
          <button className="btn-secondary" onClick={() => setView(v => (v === 'table' ? 'board' : 'table'))}>{view === 'table' ? <><LayoutGrid size={16} /> Board</> : <><List size={16} /> Table</>}</button>
          <ExportMenu onCSV={() => exportCSV('opportunities', exp())} onXLS={() => exportXLS('opportunities', exp())} />
          <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> New opportunity</button></>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KPI label="Open pipeline / mo" value={money(pt.gross)} hint={`${pt.openCount} open`} />
        <KPI label="Weighted pipeline / mo" value={money(pt.weighted)} hint="Σ value × probability" tone="navy" />
        <KPI label="Won (monthly value)" value={money(pt.won)} hint={`${pt.wonCount} won`} tone="green" />
        <KPI label="Lost (monthly value)" value={money(pt.lost)} hint={`${pt.lostCount} lost`} tone="red" />
      </div>
      <div className="card p-3 mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        <select className="input" value={brand} onChange={e => setBrand(e.target.value)}><option value="">All brands</option>{BRANDS.map(b => <option key={b}>{b}</option>)}</select>
        <select className="input" value={stage} onChange={e => setStage(e.target.value)}><option value="">All stages</option>{STAGES.map(b => <option key={b}>{b}</option>)}</select>
        {isAdmin && <select className="input" value={rep} onChange={e => setRep(e.target.value)}><option value="">All reps</option>{profiles.filter(p => p.role === 'rep').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
      </div>

      {view === 'table' ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead><tr><th className="th">Account</th><th className="th">Brand / product</th><th className="th">Stage</th><th className="th">Est./mo</th><th className="th">Prob.</th><th className="th">Weighted</th><th className="th">Close</th><th className="th">Rep</th><th className="th">Next action</th><th className="th" /></tr></thead>
            <tbody>
              {rows.map(o => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="td"><Link className="font-medium text-navy-700 hover:underline" to={`/account/${o.accountId}`}>{accountName(o.accountId)}</Link></td>
                  <td className="td">{o.brand}<div className="text-xs text-slate-500">{o.product}</div></td>
                  <td className="td">
                    <select className="input !py-1 !text-xs" value={o.stage} onChange={e => moveStage(o, e.target.value as Stage)}>{STAGES.map(s => <option key={s}>{s}</option>)}</select>
                  </td>
                  <td className="td">{money(o.monthlyValue)}{o.isDemo && <div className="text-[10px] text-amber-700">illustrative</div>}</td>
                  <td className="td">{o.probability}%</td>
                  <td className="td font-medium">{money(weighted(o))}</td>
                  <td className="td whitespace-nowrap">{fmtDate(o.expectedClose)}</td>
                  <td className="td">{repName(o.repId)}</td>
                  <td className="td max-w-[220px]">{o.nextAction}{o.stage === 'Lost' && o.lostReason && <div className="text-xs text-red-600">Lost: {o.lostReason}</div>}</td>
                  <td className="td whitespace-nowrap text-right">
                    <button className="p-1.5 rounded hover:bg-slate-100" onClick={() => setEditing(o)} title="Edit"><Pencil size={16} /></button>
                    <button className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Delete" onClick={() => window.confirm('Delete this opportunity?') && run(() => deleteOpportunity(o.id), 'Opportunity deleted')}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <EmptyState title="No opportunities match" />}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {STAGES.map(s => {
            const col = rows.filter(o => o.stage === s)
            return (
              <div key={s} className="w-64 shrink-0 bg-slate-200/60 rounded-xl p-2">
                <div className="flex justify-between items-center px-1 py-1 mb-2"><span className="text-xs font-bold text-navy-800 uppercase">{s}</span><Badge tone={s === 'Won' ? 'Won' : s === 'Lost' ? 'Lost' : 'B'}>{col.length}</Badge></div>
                <div className="space-y-2">
                  {col.map(o => (
                    <div key={o.id} className="bg-white rounded-lg p-3 shadow-sm border border-slate-200 text-sm">
                      <button className="font-semibold text-navy-800 text-left hover:underline" onClick={() => setEditing(o)}>{accountName(o.accountId)}</button>
                      <div className="text-xs text-slate-500">{o.brand} · {o.product}</div>
                      <div className="flex justify-between mt-1"><span>{money(o.monthlyValue)}</span><span className="text-xs text-slate-500">{o.probability}%</span></div>
                      <select className="input !py-1 !text-xs mt-2" value={o.stage} onChange={e => moveStage(o, e.target.value as Stage)}>{STAGES.map(x => <option key={x}>{x}</option>)}</select>
                    </div>
                  ))}
                  {col.length === 0 && <div className="text-xs text-slate-400 text-center py-4">Empty</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {adding && <OpportunityForm open onClose={() => setAdding(false)} />}
      {editing && <OpportunityForm open onClose={() => setEditing(undefined)} opportunity={editing} />}
    </>
  )
}
