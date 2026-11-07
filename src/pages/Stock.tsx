import { ChangeEvent, useMemo, useState } from 'react'
import { AlertTriangle, Plus, Trash2, Upload } from 'lucide-react'
import { useStore } from '../lib/store'
import { Badge, ConfirmButton, EmptyState, PageHeader, useAction } from '../components/ui'
import { daysSince, downloadFile, fmtDate } from '../lib/utils'
import { parseCSV } from '../lib/importer'
import { detectBrand } from '../lib/sales'
import { BRANDS, BrandName, StockItem } from '../types'

const daysTo = (d: string | null) => (d ? -(daysSince(d) ?? 0) : null)   // negative = already expired
const LOW = 30

export default function Stock() {
  const { stock, isAdmin, saveStock, deleteStock } = useStore()
  const run = useAction()
  const [brand, setBrand] = useState('')
  const [view, setView] = useState<'all' | 'expiry' | 'low'>('all')
  const [msg, setMsg] = useState('')
  const [draft, setDraft] = useState({ brand: 'Agrosuper' as BrandName, product: '', sku: '', unit: 'case', onHand: '', incoming: '', incomingDate: '', expiryDate: '' })
  const near = (s: StockItem) => { const d = daysTo(s.expiryDate); return d !== null && d <= 60 }
  const rows = useMemo(() => stock.filter(s => (!brand || s.brand === brand) && (view === 'all' || (view === 'expiry' ? near(s) : s.onHand < LOW)))
    .sort((a, b) => view === 'expiry' ? (a.expiryDate ?? '9').localeCompare(b.expiryDate ?? '9') : a.brand.localeCompare(b.brand) || a.product.localeCompare(b.product)), [stock, brand, view])
  const nearCount = stock.filter(near).length, lowCount = stock.filter(s => s.onHand < LOW).length

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const r = new FileReader()
    r.onload = () => {
      const all = parseCSV(String(r.result ?? '')); const h = (all[0] ?? []).map(x => x.trim().toLowerCase())
      const col = (...n: string[]) => h.findIndex(x => n.some(k => x === k || x.includes(k)))
      const ci = { brand: col('brand'), product: col('product', 'description', 'item description'), sku: col('sku', 'item code', 'itemcode'), unit: col('unit', 'uom'), onHand: col('on hand', 'onhand', 'qty on hand', 'quantity on hand'),
        incoming: col('incoming', 'on order', 'arriving'), incomingDate: col('arrival', 'eta', 'incoming date'), expiry: col('expiry', 'expiration', 'best before') }
      if (ci.product < 0 || ci.onHand < 0) { setMsg('The file needs at least Product and On hand columns.'); return }
      const items = all.slice(1).filter(x => (x[ci.product] ?? '').trim()).map(x => {
        const prod = x[ci.product].trim(); const b = (ci.brand >= 0 && BRANDS.find(k => k.toLowerCase() === (x[ci.brand] ?? '').trim().toLowerCase())) || (detectBrand(`${prod} ${ci.brand >= 0 ? x[ci.brand] : ''}`) as BrandName | null) || 'Hostess'
        const dt = (i: number) => { const v = i >= 0 ? (x[i] ?? '').trim() : ''; return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null }
        return { brand: b as BrandName, product: prod, sku: ci.sku >= 0 ? (x[ci.sku] ?? '').trim() : '', unit: ci.unit >= 0 ? (x[ci.unit] ?? '').trim() || 'case' : 'case',
          onHand: Number((x[ci.onHand] ?? '0').replace(/[^0-9.\-]/g, '')) || 0, incoming: ci.incoming >= 0 ? Number((x[ci.incoming] ?? '0').replace(/[^0-9.\-]/g, '')) || 0 : 0,
          incomingDate: dt(ci.incomingDate), expiryDate: dt(ci.expiry) }
      })
      const n = run(() => saveStock(items), 'Stock updated'); setMsg(n ? `${n} stock lines imported (existing lines matched by brand and SKU were updated).` : '')
    }
    r.readAsText(f); e.target.value = ''
  }
  const addOne = () => {
    if (!draft.product.trim()) return
    const ok = run(() => saveStock([{ brand: draft.brand, product: draft.product, sku: draft.sku, unit: draft.unit, onHand: Number(draft.onHand) || 0, incoming: Number(draft.incoming) || 0, incomingDate: draft.incomingDate || null, expiryDate: draft.expiryDate || null }]), 'Stock line saved')
    if (ok) setDraft({ ...draft, product: '', sku: '', onHand: '', incoming: '', incomingDate: '', expiryDate: '' })
  }
  const template = () => downloadFile('pg-stock-template.csv', '﻿Brand,Product,SKU,Unit,On hand,Incoming,Arrival date,Expiry date\r\nHostess,Twinkies 10ct,HOS-TW10,case,420,0,,2027-03-15\r\n', 'text/csv;charset=utf-8')

  return (
    <>
      <PageHeader title="Stock & Expiry" subtitle={`${stock.length} products · ${nearCount} expiring within 60 days · ${lowCount} low (under ${LOW})`}
        actions={isAdmin ? <><button className="btn-secondary" onClick={template}>Template</button><label className="btn-secondary cursor-pointer"><Upload size={16} /> Import CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} /></label></> : undefined} />
      {msg && <div className="card p-3 mb-3 text-sm">{msg}</div>}
      <div className="card p-3 mb-4 flex gap-2 flex-wrap items-center">
        {(['all', 'expiry', 'low'] as const).map(v => <button key={v} className={view === v ? 'btn-primary' : 'btn-secondary'} onClick={() => setView(v)}>{v === 'all' ? 'All stock' : v === 'expiry' ? `Near expiry (${nearCount})` : `Low stock (${lowCount})`}</button>)}
        <select className="input !w-auto" value={brand} onChange={e => setBrand(e.target.value)}><option value="">All brands</option>{BRANDS.map(b => <option key={b}>{b}</option>)}</select>
      </div>
      {view === 'expiry' && nearCount > 0 && <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-sm px-3 py-2 mb-3 flex gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><div><strong>Push these this week.</strong> Offer the customer a short-dated deal before the date arrives. Agree any discount with management first.</div></div>}
      {isAdmin && (
        <div className="card p-3 mb-4 flex gap-2 flex-wrap items-end">
          <select className="input !w-auto" value={draft.brand} onChange={e => setDraft({ ...draft, brand: e.target.value as BrandName })}>{BRANDS.map(b => <option key={b}>{b}</option>)}</select>
          <input className="input !w-44" placeholder="Product" value={draft.product} onChange={e => setDraft({ ...draft, product: e.target.value })} />
          <input className="input !w-24" placeholder="SKU" value={draft.sku} onChange={e => setDraft({ ...draft, sku: e.target.value })} />
          <input className="input !w-24" type="number" placeholder="On hand" value={draft.onHand} onChange={e => setDraft({ ...draft, onHand: e.target.value })} />
          <input className="input !w-24" type="number" placeholder="Incoming" value={draft.incoming} onChange={e => setDraft({ ...draft, incoming: e.target.value })} />
          <label className="text-xs text-slate-500">Arrives<input className="input !w-36" type="date" value={draft.incomingDate} onChange={e => setDraft({ ...draft, incomingDate: e.target.value })} /></label>
          <label className="text-xs text-slate-500">Expires<input className="input !w-36" type="date" value={draft.expiryDate} onChange={e => setDraft({ ...draft, expiryDate: e.target.value })} /></label>
          <button className="btn-primary" onClick={addOne}><Plus size={16} /> Add / update</button>
        </div>)}
      {rows.length === 0 ? <div className="card p-8"><EmptyState title={view === 'all' ? 'No stock loaded' : 'Nothing here'} hint={view === 'all' && isAdmin ? 'Import a stock CSV or add lines above.' : undefined} /></div> : (
        <div className="card overflow-x-auto"><table className="w-full min-w-[680px]">
          <thead><tr><th className="th">Product</th><th className="th text-right">On hand</th><th className="th text-right">Incoming</th><th className="th">Soonest expiry</th><th className="th">Updated</th>{isAdmin && <th className="th" />}</tr></thead>
          <tbody>{rows.map(s => { const d = daysTo(s.expiryDate); return (
            <tr key={s.id}>
              <td className="td"><div className="font-medium">{s.product}</div><div className="text-xs text-slate-500">{s.brand} · per {s.unit}{s.sku ? ` · ${s.sku}` : ''}</div></td>
              <td className="td text-right">{s.onHand < LOW ? <Badge tone="Overdue">{s.onHand} low</Badge> : s.onHand.toLocaleString()}</td>
              <td className="td text-right">{s.incoming > 0 ? `${s.incoming.toLocaleString()}${s.incomingDate ? ` on ${fmtDate(s.incomingDate)}` : ''}` : '—'}</td>
              <td className="td">{s.expiryDate ? <>{fmtDate(s.expiryDate)} {d !== null && d <= 60 && <Badge tone={d < 0 ? 'Overdue' : 'Due'}>{d < 0 ? 'Expired' : `${d} days`}</Badge>}</> : '—'}</td>
              <td className="td text-xs text-slate-500">{fmtDate(s.updatedAt)}</td>
              {isAdmin && <td className="td"><ConfirmButton className="text-slate-400 hover:text-red-600" message={`Remove ${s.product}?`} onConfirm={() => run(() => deleteStock(s.id), 'Removed')}><Trash2 size={16} /></ConfirmButton></td>}
            </tr>) })}</tbody></table></div>)}
    </>
  )
}
