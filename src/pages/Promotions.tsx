import { FormEvent, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { BRANDS, BrandName, PROMO_KINDS, PROMO_STATUSES, PromoStatus, Promotion, SUPPLIERS } from '../types'
import { Badge, EmptyState, ExportMenu, Field, Modal, PageHeader, useAction } from '../components/ui'
import { cx, exportCSV, exportXLS, fmtDate, money, toDateStr } from '../lib/utils'

export default function Promotions() {
  const { promotions, accounts, profiles, repName, accountName, deletePromotion } = useStore()
  const run = useAction()
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [editing, setEditing] = useState<Promotion | undefined>()
  const [adding, setAdding] = useState(false)
  const [status, setStatus] = useState('')
  const [brand, setBrand] = useState('')

  const list = useMemo(() => promotions.filter(p => (!status || p.status === status) && (!brand || p.brand === brand)).sort((a, b) => (a.start < b.start ? -1 : 1)), [promotions, status, brand])

  const year = cursor.getFullYear(), month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = [...Array(startPad).fill(null), ...Array.from({ length: days }, (_, i) => toDateStr(new Date(year, month, i + 1)))]
  while (cells.length % 7) cells.push(null)
  const todayS = toDateStr(new Date())
  const on = (d: string) => list.filter(p => p.start <= d && p.end >= d && p.status !== 'Cancelled')

  const rows = () => list.map(p => ({
    Promotion: p.name, Type: p.kind, Brand: p.brand, Supplier: p.supplier, 'Participating Accounts': p.accountIds.map(accountName).join('; '),
    Start: p.start, End: p.end, Budget: p.budget, 'Expected Results': p.expected, 'Actual Results': p.actual, Status: p.status, Responsible: repName(p.responsibleId),
  }))

  return (
    <>
      <PageHeader title="Promotion Calendar" subtitle={`${list.length} promotions`}
        actions={<><ExportMenu onCSV={() => exportCSV('promotions', rows())} onXLS={() => exportXLS('promotions', rows())} />
          <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> New promotion</button></>} />
      <div className="card p-3 mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        <select className="input" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{PROMO_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
        <select className="input" value={brand} onChange={e => setBrand(e.target.value)}><option value="">All brands</option>{BRANDS.map(s => <option key={s}>{s}</option>)}</select>
      </div>

      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button className="btn-secondary !p-2" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
          <h3 className="font-semibold text-navy-900">{cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
          <button className="btn-secondary !p-2" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month"><ChevronRight size={16} /></button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-500 mb-1">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden">
          {cells.map((d, i) => (
            <div key={i} className={cx('bg-white min-h-[64px] sm:min-h-[88px] p-1', d === todayS && 'ring-2 ring-inset ring-navy-400')}>
              {d && <><div className="text-xs text-slate-500">{Number(d.slice(8))}</div>
                {on(d).slice(0, 3).map(p => <button key={p.id} onClick={() => setEditing(p)} title={p.name} className={cx('block w-full text-left truncate rounded px-1 text-[10px] sm:text-[11px] mb-0.5', p.brand === 'Agrosuper' ? 'bg-navy-800 text-white' : p.brand === 'Hostess' ? 'bg-navy-300 text-navy-900' : 'bg-slate-300 text-slate-800')}>{p.name}</button>)}
                {on(d).length > 3 && <div className="text-[10px] text-slate-500">+{on(d).length - 3} more</div>}</>}
            </div>
          ))}
        </div>
        <div className="flex gap-3 text-xs mt-2 text-slate-500"><span><span className="inline-block w-3 h-3 rounded bg-navy-800 align-middle mr-1" />Agrosuper</span><span><span className="inline-block w-3 h-3 rounded bg-navy-300 align-middle mr-1" />Hostess</span><span><span className="inline-block w-3 h-3 rounded bg-slate-300 align-middle mr-1" />Kikkoman</span></div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]"><thead><tr><th className="th">Promotion</th><th className="th">Brand / supplier</th><th className="th">Dates</th><th className="th">Accounts</th><th className="th">Budget</th><th className="th">Expected / actual</th><th className="th">Status</th><th className="th">Owner</th><th className="th" /></tr></thead>
          <tbody>{list.map(p => (
            <tr key={p.id} className="align-top hover:bg-slate-50">
              <td className="td font-medium">{p.name}<div className="text-xs text-slate-500">{p.kind}</div></td>
              <td className="td">{p.brand}<div className="text-xs text-slate-500">{p.supplier}</div></td>
              <td className="td whitespace-nowrap">{fmtDate(p.start)} – {fmtDate(p.end)}</td>
              <td className="td text-xs max-w-[200px]">{p.accountIds.map(accountName).join(', ') || '—'}</td>
              <td className="td">{money(p.budget)}</td>
              <td className="td text-xs max-w-[220px]">{p.expected}<div className="text-slate-500">Actual: {p.actual || '—'}</div></td>
              <td className="td"><Badge>{p.status}</Badge></td>
              <td className="td">{repName(p.responsibleId)}</td>
              <td className="td whitespace-nowrap"><button className="p-1.5 rounded hover:bg-slate-100" onClick={() => setEditing(p)}><Pencil size={16} /></button>
                <button className="p-1.5 rounded hover:bg-red-50 text-red-600" onClick={() => window.confirm('Delete this promotion?') && run(() => deletePromotion(p.id), 'Promotion deleted')}><Trash2 size={16} /></button></td>
            </tr>))}</tbody></table>
        {list.length === 0 && <EmptyState title="No promotions" />}
      </div>
      {adding && <PromoForm onClose={() => setAdding(false)} accounts={accounts} profiles={profiles} />}
      {editing && <PromoForm onClose={() => setEditing(undefined)} promo={editing} accounts={accounts} profiles={profiles} />}
    </>
  )
}

function PromoForm({ onClose, promo, accounts, profiles }: { onClose: () => void; promo?: Promotion; accounts: { id: string; name: string }[]; profiles: { id: string; name: string; role: string; active: boolean }[] }) {
  const { savePromotion, isAdmin, user } = useStore()
  const run = useAction()
  const [f, setF] = useState({
    name: promo?.name ?? '', kind: promo?.kind ?? PROMO_KINDS[0], brand: (promo?.brand ?? 'Agrosuper') as BrandName,
    supplier: promo?.supplier ?? SUPPLIERS.Agrosuper, accountIds: promo?.accountIds ?? [] as string[],
    start: promo?.start ?? toDateStr(new Date()), end: promo?.end ?? toDateStr(new Date()), budget: String(promo?.budget ?? 0),
    expected: promo?.expected ?? '', actual: promo?.actual ?? '', status: (promo?.status ?? 'Planned') as PromoStatus, responsibleId: promo?.responsibleId ?? user?.id ?? '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(s => ({ ...s, [k]: v }))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (f.end < f.start) { run(() => { throw new Error('End date must be on or after start date') }); return }
    const ok = run(() => savePromotion({ ...f, id: promo?.id, budget: Number(f.budget) || 0, responsibleId: isAdmin ? f.responsibleId : undefined }), promo ? 'Promotion updated' : 'Promotion created')
    if (ok) onClose()
  }
  return (
    <Modal open onClose={onClose} title={promo ? 'Edit promotion' : 'New promotion'} wide>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Promotion name *" className="sm:col-span-2"><input required className="input" value={f.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="Type"><select className="input" value={f.kind} onChange={e => set('kind', e.target.value)}>{PROMO_KINDS.map(k => <option key={k}>{k}</option>)}</select></Field>
        <Field label="Brand"><select className="input" value={f.brand} onChange={e => setF(s => ({ ...s, brand: e.target.value as BrandName, supplier: SUPPLIERS[e.target.value as BrandName] }))}>{BRANDS.map(b => <option key={b}>{b}</option>)}</select></Field>
        <Field label="Supplier"><input className="input" value={f.supplier} onChange={e => set('supplier', e.target.value)} /></Field>
        <Field label="Status"><select className="input" value={f.status} onChange={e => set('status', e.target.value as PromoStatus)}>{PROMO_STATUSES.map(s => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Start date"><input type="date" required className="input" value={f.start} onChange={e => set('start', e.target.value)} /></Field>
        <Field label="End date"><input type="date" required className="input" value={f.end} onChange={e => set('end', e.target.value)} /></Field>
        <Field label="Budget ($)"><input type="number" min="0" className="input" value={f.budget} onChange={e => set('budget', e.target.value)} /></Field>
        <Field label="Responsible person"><select className="input" disabled={!isAdmin} value={f.responsibleId} onChange={e => set('responsibleId', e.target.value)}>{profiles.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Expected results" className="sm:col-span-2"><input className="input" value={f.expected} onChange={e => set('expected', e.target.value)} /></Field>
        <Field label="Actual results" className="sm:col-span-2"><input className="input" value={f.actual} onChange={e => set('actual', e.target.value)} /></Field>
        <div className="sm:col-span-2"><span className="label">Participating accounts</span>
          <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-slate-100">
            {accounts.map(a => <label key={a.id} className="flex items-center gap-2 px-3 py-1.5 text-sm"><input type="checkbox" checked={f.accountIds.includes(a.id)} onChange={e => set('accountIds', e.target.checked ? [...f.accountIds, a.id] : f.accountIds.filter(x => x !== a.id))} />{a.name}</label>)}
          </div></div>
        <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary">{promo ? 'Save changes' : 'Create promotion'}</button></div>
      </form>
    </Modal>
  )
}
