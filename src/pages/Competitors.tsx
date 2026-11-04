import { FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Paperclip, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { CompetitorRecord } from '../types'
import { EmptyState, ExportMenu, Field, Modal, PageHeader, useAction } from '../components/ui'
import { exportCSV, exportXLS, fmtDate, toDateStr } from '../lib/utils'

export default function Competitors() {
  const { competitors, accounts, repName, accountName, deleteCompetitor, opportunities } = useStore()
  const run = useAction()
  const [q, setQ] = useState('')
  const [acct, setAcct] = useState('')
  const [editing, setEditing] = useState<CompetitorRecord | undefined>()
  const [adding, setAdding] = useState(false)

  const rows = useMemo(() => competitors.filter(c => (!acct || c.accountId === acct) &&
    (!q || [c.competitor, c.products, c.observations, c.currentSupplier].join(' ').toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1)), [competitors, q, acct])

  // "Where are we losing business to competitors?"
  const lost = opportunities.filter(o => o.stage === 'Lost')
  const byCompetitor = useMemo(() => {
    const m = new Map<string, number>()
    competitors.forEach(c => m.set(c.competitor || 'Unknown', (m.get(c.competitor || 'Unknown') ?? 0) + 1))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [competitors])

  const exp = () => rows.map(c => ({ Date: c.recordedAt, Competitor: c.competitor, Account: accountName(c.accountId), Products: c.products, 'Selling Price': c.price, Promotions: c.promotions, 'Current Supplier': c.currentSupplier, Observations: c.observations, 'Recorded By': repName(c.repId), Attachment: c.attachmentName ?? '' }))

  return (
    <>
      <PageHeader title="Competitor Tracking" subtitle={`${rows.length} observations`}
        actions={<><ExportMenu onCSV={() => exportCSV('competitor-tracking', exp())} onXLS={() => exportXLS('competitor-tracking', exp())} />
          <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> Record observation</button></>} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="card p-4 lg:col-span-2">
          <h3 className="font-semibold text-navy-900 mb-2">Where are we losing business?</h3>
          {lost.length === 0 ? <p className="text-sm text-slate-500">No lost opportunities recorded.</p> : (
            <ul className="text-sm divide-y divide-slate-100">{lost.map(o => <li key={o.id} className="py-1.5 flex justify-between gap-2"><span><Link className="text-navy-700 hover:underline" to={`/account/${o.accountId}`}>{accountName(o.accountId)}</Link> · {o.brand} {o.product}</span><span className="text-slate-500 text-xs">{o.lostReason || 'Reason not recorded'}</span></li>)}</ul>
          )}
        </div>
        <div className="card p-4"><h3 className="font-semibold text-navy-900 mb-2">Most-observed competitors</h3>
          {byCompetitor.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : <ul className="text-sm space-y-1">{byCompetitor.slice(0, 6).map(([n, c]) => <li key={n} className="flex justify-between"><span>{n}</span><span className="font-semibold">{c}</span></li>)}</ul>}
        </div>
      </div>
      <div className="card p-3 mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        <input className="input col-span-2" placeholder="Search competitor, product, notes…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input" value={acct} onChange={e => setAcct(e.target.value)}><option value="">All accounts</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]"><thead><tr><th className="th">Date</th><th className="th">Competitor</th><th className="th">Account</th><th className="th">Products / price</th><th className="th">Promotions</th><th className="th">Supplier</th><th className="th">Observations</th><th className="th" /></tr></thead>
          <tbody>{rows.map(c => (
            <tr key={c.id} className="align-top hover:bg-slate-50">
              <td className="td whitespace-nowrap">{fmtDate(c.recordedAt)}</td><td className="td font-medium">{c.competitor}</td>
              <td className="td"><Link className="text-navy-700 hover:underline" to={`/account/${c.accountId}`}>{accountName(c.accountId)}</Link><div className="text-xs text-slate-500">{repName(c.repId)}</div></td>
              <td className="td">{c.products}<div className="text-xs text-slate-500">{c.price}</div></td><td className="td">{c.promotions}</td><td className="td">{c.currentSupplier}</td>
              <td className="td max-w-xs text-xs">{c.observations}{c.attachment && <a href={c.attachment} download={c.attachmentName} className="flex items-center gap-1 text-navy-700 mt-1"><Paperclip size={12} />{c.attachmentName}</a>}</td>
              <td className="td whitespace-nowrap"><button className="p-1.5 rounded hover:bg-slate-100" onClick={() => setEditing(c)}><Pencil size={16} /></button>
                <button className="p-1.5 rounded hover:bg-red-50 text-red-600" onClick={() => window.confirm('Delete this record?') && run(() => deleteCompetitor(c.id), 'Record deleted')}><Trash2 size={16} /></button></td>
            </tr>))}</tbody></table>
        {rows.length === 0 && <EmptyState title="No competitor records" />}
      </div>
      {adding && <CompForm onClose={() => setAdding(false)} />}
      {editing && <CompForm onClose={() => setEditing(undefined)} rec={editing} />}
    </>
  )
}

function CompForm({ onClose, rec }: { onClose: () => void; rec?: CompetitorRecord }) {
  const { saveCompetitor, accounts } = useStore()
  const run = useAction()
  const [f, setF] = useState({
    competitor: rec?.competitor ?? '', accountId: rec?.accountId ?? accounts[0]?.id ?? '', products: rec?.products ?? '', price: rec?.price ?? '',
    promotions: rec?.promotions ?? '', currentSupplier: rec?.currentSupplier ?? '', observations: rec?.observations ?? '', recordedAt: rec?.recordedAt ?? toDateStr(new Date()),
    attachment: rec?.attachment, attachmentName: rec?.attachmentName,
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(s => ({ ...s, [k]: v }))
  const onFile = (file?: File) => {
    if (!file) return
    if (file.size > 1_500_000) { run(() => { throw new Error('Attachment must be under 1.5 MB in demo mode') }); return }
    const r = new FileReader()
    r.onload = () => setF(s => ({ ...s, attachment: String(r.result), attachmentName: file.name }))
    r.readAsDataURL(file)
  }
  const submit = (e: FormEvent) => { e.preventDefault(); const ok = run(() => saveCompetitor({ ...f, id: rec?.id }), rec ? 'Record updated' : 'Observation recorded'); if (ok) onClose() }
  return (
    <Modal open onClose={onClose} title={rec ? 'Edit competitor record' : 'Record competitor observation'} wide>
      {accounts.length === 0 ? <p className="text-sm text-slate-500">No assigned accounts.</p> : (
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Competitor name *"><input required className="input" value={f.competitor} onChange={e => set('competitor', e.target.value)} /></Field>
          <Field label="Account *"><select required className="input" value={f.accountId} onChange={e => set('accountId', e.target.value)}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
          <Field label="Products"><input className="input" value={f.products} onChange={e => set('products', e.target.value)} /></Field>
          <Field label="Selling price"><input className="input" value={f.price} onChange={e => set('price', e.target.value)} placeholder="e.g. $1.60/lb" /></Field>
          <Field label="Promotions"><input className="input" value={f.promotions} onChange={e => set('promotions', e.target.value)} /></Field>
          <Field label="Current supplier"><input className="input" value={f.currentSupplier} onChange={e => set('currentSupplier', e.target.value)} /></Field>
          <Field label="Date recorded"><input type="date" className="input" value={f.recordedAt} onChange={e => set('recordedAt', e.target.value)} /></Field>
          <Field label="Photo / attachment"><input type="file" accept="image/*,.pdf" className="input" onChange={e => onFile(e.target.files?.[0])} />{f.attachmentName && <span className="text-xs text-slate-500">{f.attachmentName}</span>}</Field>
          <Field label="Observations" className="sm:col-span-2"><textarea rows={3} className="input" value={f.observations} onChange={e => set('observations', e.target.value)} /></Field>
          <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary">Save</button></div>
        </form>
      )}
    </Modal>
  )
}
