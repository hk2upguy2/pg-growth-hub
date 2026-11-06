import { ChangeEvent, useMemo, useState } from 'react'
import { Plus, Trash2, Upload } from 'lucide-react'
import { useStore } from '../lib/store'
import { hasSupabase } from '../lib/supabase'
import { Badge, ConfirmButton, EmptyState, PageHeader, useAction } from '../components/ui'
import { downloadFile, money } from '../lib/utils'
import { parseCSV } from '../lib/importer'
import { parseAmount, detectBrand } from '../lib/sales'
import { BRANDS, BrandName } from '../types'

export default function PriceList() {
  const { priceItems, isAdmin, savePriceItems, deletePriceItem } = useStore()
  const run = useAction()
  const [q, setQ] = useState('')
  const [brand, setBrand] = useState('')
  const [draft, setDraft] = useState({ brand: 'Agrosuper' as BrandName, product: '', sku: '', unit: 'case', price: '' })
  const [msg, setMsg] = useState('')
  const rows = useMemo(() => priceItems.filter(p => (!brand || p.brand === brand) && (!q || `${p.brand} ${p.product} ${p.sku}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => a.brand.localeCompare(b.brand) || a.product.localeCompare(b.product)), [priceItems, q, brand])

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const all = parseCSV(String(reader.result ?? '')); const h = all[0]?.map(x => x.trim().toLowerCase()) ?? []
      const col = (...n: string[]) => h.findIndex(x => n.includes(x))
      const [cb, cp, cs, cu, cr] = [col('brand'), col('product', 'item', 'description', 'product name'), col('sku', 'item code', 'code'), col('unit', 'uom'), col('price', 'unit price', 'list price')]
      if (cp < 0 || cr < 0) { setMsg('The file needs at least Product and Price columns (Brand, SKU and Unit are optional).'); return }
      const items = all.slice(1).map(r => {
        const price = parseAmount(r[cr] ?? ''); const prod = (r[cp] ?? '').trim()
        const b = (BRANDS.find(x => x.toLowerCase() === (r[cb] ?? '').trim().toLowerCase()) ?? detectBrand(`${r[cb] ?? ''} ${prod}`) ?? 'Agrosuper') as BrandName
        return price === null || !prod ? null : { brand: b, product: prod, sku: cs >= 0 ? r[cs] ?? '' : '', unit: cu >= 0 && r[cu] ? r[cu] : 'case', price, active: true }
      }).filter(Boolean) as { brand: BrandName; product: string; sku: string; unit: string; price: number; active: boolean }[]
      if (!items.length) { setMsg('No usable rows found.'); return }
      const n = run(() => savePriceItems(items)); if (n !== undefined) setMsg(`${n} prices loaded. Existing products with the same brand, name and unit were updated.`)
    }
    reader.readAsText(f, 'utf-8'); e.target.value = ''
  }
  const add = () => {
    if (!draft.product.trim() || !(Number(draft.price) >= 0) || draft.price === '') return
    const n = run(() => savePriceItems([{ brand: draft.brand, product: draft.product, sku: draft.sku, unit: draft.unit, price: Number(draft.price), active: true }]), 'Price added')
    if (n !== undefined) setDraft(d => ({ ...d, product: '', sku: '', price: '' }))
  }

  return (
    <>
      <PageHeader title="Price List" subtitle={isAdmin ? 'Management sets prices; reps quote from this list' : 'Current prices you can quote'}
        actions={isAdmin ? <>
          <button className="btn-secondary" onClick={() => downloadFile('pg-price-list-template.csv', '﻿Brand,Product,SKU,Unit,Price\r\n', 'text/csv;charset=utf-8')}>Download template</button>
          <label className="btn-secondary cursor-pointer"><Upload size={16} /> Import CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} /></label></> : undefined} />
      {!hasSupabase && <div className="card p-3 mb-4 text-sm bg-amber-50 border-amber-300 text-amber-900">Demo mode: these prices are illustrative placeholders, not Pacific Grocers' real prices.</div>}
      {msg && <div className="card p-3 mb-4 text-sm">{msg}</div>}
      <div className="card p-3 mb-4 flex gap-2 flex-wrap">
        <input className="input flex-1 min-w-[180px]" placeholder="Search product, brand or SKU" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input !w-auto" value={brand} onChange={e => setBrand(e.target.value)}><option value="">All brands</option>{BRANDS.map(b => <option key={b}>{b}</option>)}</select>
      </div>
      {isAdmin && (
        <div className="card p-3 mb-4 grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
          <select className="input" value={draft.brand} onChange={e => setDraft({ ...draft, brand: e.target.value as BrandName })}>{BRANDS.map(b => <option key={b}>{b}</option>)}</select>
          <input className="input md:col-span-2" placeholder="Product" value={draft.product} onChange={e => setDraft({ ...draft, product: e.target.value })} />
          <input className="input" placeholder="SKU" value={draft.sku} onChange={e => setDraft({ ...draft, sku: e.target.value })} />
          <input className="input" type="number" min="0" step="0.01" placeholder="Price $" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} />
          <button className="btn-primary" onClick={add}><Plus size={16} /> Add</button>
        </div>
      )}
      {rows.length === 0 ? <div className="card p-8"><EmptyState title="No prices yet" hint={isAdmin ? 'Add products above or import your price list as CSV.' : 'Management has not loaded the price list yet.'} /></div> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead><tr><th className="th">Brand</th><th className="th">Product</th><th className="th">SKU</th><th className="th">Unit</th><th className="th text-right">Price</th>{isAdmin && <><th className="th">Active</th><th className="th" /></>}</tr></thead>
            <tbody>{rows.map(p => (
              <tr key={p.id}>
                <td className="td"><Badge>{p.brand}</Badge></td><td className="td font-medium">{p.product}</td><td className="td text-slate-500">{p.sku || '—'}</td><td className="td">{p.unit}</td>
                <td className="td text-right">{isAdmin ? <input type="number" min="0" step="0.01" className="input !py-1 w-24 text-right" defaultValue={p.price} key={p.id + p.price} onBlur={e => { if (Number(e.target.value) !== p.price) run(() => savePriceItems([{ ...p, price: Number(e.target.value) }]), 'Price updated') }} /> : <span className="font-semibold">{money(p.price)}</span>}</td>
                {isAdmin && <><td className="td"><input type="checkbox" checked={p.active} onChange={e => run(() => savePriceItems([{ ...p, active: e.target.checked }]))} /></td>
                  <td className="td"><ConfirmButton className="text-slate-400 hover:text-red-600" message={`Remove ${p.product}?`} onConfirm={() => run(() => deletePriceItem(p.id), 'Removed')}><Trash2 size={15} /></ConfirmButton></td></>}
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </>
  )
}
