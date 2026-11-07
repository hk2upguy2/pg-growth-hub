import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { Field, Modal, useAction } from './ui'
import { CreditCheck, OverdueWarning } from './AccountSnapshot'
import { VoiceOrder } from './VoiceOrder'
import { MAX_REP_DISCOUNT, Order, OrderStatus, ORDER_STATUSES, Quote, QuoteLine, lineTotal, quoteTotal } from '../types'
import { daysFromNowStr, money } from '../lib/utils'

export function OrderForm({ open, onClose, order, fromQuote, defaultAccountId }: { open: boolean; onClose: () => void; order?: Order; fromQuote?: Quote; defaultAccountId?: string }) {
  const { accounts, priceItems, stock, saveOrder, isAdmin } = useStore()
  const run = useAction()
  const [accountId, setAccountId] = useState(order?.accountId ?? fromQuote?.accountId ?? defaultAccountId ?? '')
  const [lines, setLines] = useState<QuoteLine[]>(order?.lines ?? fromQuote?.lines ?? [])
  const [delivery, setDelivery] = useState(order?.deliveryDate || daysFromNowStr(3))
  const [notes, setNotes] = useState(order?.notes ?? '')
  const [status, setStatus] = useState<OrderStatus>(order?.status ?? 'Submitted')
  const [pick, setPick] = useState('')
  const locked = !!order && !isAdmin
  const acct = accounts.find(a => a.id === accountId)
  const total = quoteTotal(lines)
  const stockOf = useMemo(() => new Map(stock.map(s => [`${s.brand}|${s.sku || s.product}`.toLowerCase(), s])), [stock])
  const stockFor = (l: QuoteLine) => stockOf.get(`${l.brand}|${l.sku || l.product}`.toLowerCase())
  const add = () => {
    const it = priceItems.find(p => p.id === pick); if (!it) return
    setLines(l => [...l, { brand: it.brand, product: it.product, sku: it.sku, unit: it.unit, qty: 1, price: it.price, discountPct: 0 }]); setPick('')
  }
  const upd = (i: number, patch: Partial<QuoteLine>) => setLines(l => l.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const submit = () => {
    const r = run(() => saveOrder({ id: order?.id, accountId, status: isAdmin ? status : undefined, deliveryDate: delivery, notes, lines, quoteId: fromQuote?.id ?? order?.quoteId }),
      order ? 'Order updated' : 'Order submitted and logged as an activity')
    if (r) onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={order ? `Order ${order.orderNo}` : fromQuote ? `New order from quote ${fromQuote.quoteNo}` : 'New order'} wide>
      <div className="space-y-4">
        <Field label="Customer *">
          <select className="input" value={accountId} disabled={!!order || !!fromQuote} onChange={e => setAccountId(e.target.value)}>
            <option value="">Choose an account…</option>{accounts.filter(a => a.status !== 'Prospect' || isAdmin || a.id === accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <OverdueWarning account={acct} />
        {!locked && <CreditCheck account={acct} orderTotal={total} />}
        {!locked && <VoiceOrder items={priceItems} onAdd={added => setLines(l => { const out = [...l]; for (const a of added) { const i = out.findIndex(x => x.sku === a.sku && x.product === a.product && x.brand === a.brand); if (i >= 0) out[i] = { ...out[i], qty: out[i].qty + a.qty }; else out.push(a) } return out })} />}
        {!locked && (
          <div className="flex gap-2 flex-wrap items-end">
            <Field label="Add from price list" className="flex-1 min-w-[240px]">
              <select className="input" value={pick} onChange={e => setPick(e.target.value)}>
                <option value="">Choose…</option>{priceItems.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.brand} · {p.product} ({p.unit}) {money(p.price)}</option>)}
              </select>
            </Field>
            <button type="button" className="btn-secondary mb-0.5" disabled={!pick} onClick={add}><Plus size={16} /> Add</button>
          </div>
        )}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full min-w-[560px]">
            <thead><tr><th className="th">Product</th><th className="th w-20">Qty</th><th className="th">Price</th><th className="th w-24">Disc. %</th><th className="th text-right">Total</th><th className="th w-8" /></tr></thead>
            <tbody>
              {lines.length === 0 && <tr><td className="td text-slate-500" colSpan={6}>No products yet.</td></tr>}
              {lines.map((l, i) => { const st = stockFor(l); const short = st ? l.qty > st.onHand : false; return (
                <tr key={i}>
                  <td className="td"><div className="font-medium">{l.product}</div><div className="text-xs text-slate-500">{l.brand} · per {l.unit}
                    {st && <span className={short ? 'text-red-600 font-medium' : ''}> · {short ? `only ${st.onHand} in stock` : `${st.onHand} in stock`}{short && st.incoming > 0 ? `, ${st.incoming} arriving` : ''}</span>}</div></td>
                  <td className="td"><input type="number" min="1" className="input !py-1" disabled={locked} value={l.qty} onChange={e => upd(i, { qty: Number(e.target.value) })} /></td>
                  <td className="td">{money(l.price)}</td>
                  <td className="td"><input type="number" min="0" max={isAdmin ? 100 : MAX_REP_DISCOUNT} className="input !py-1" disabled={locked} value={l.discountPct} onChange={e => upd(i, { discountPct: Number(e.target.value) })} /></td>
                  <td className="td text-right font-semibold">{money(lineTotal(l))}</td>
                  <td className="td">{!locked && <button type="button" className="text-slate-400 hover:text-red-600" aria-label="Remove line" onClick={() => setLines(x => x.filter((_, j) => j !== i))}><Trash2 size={15} /></button>}</td>
                </tr>) })}
            </tbody>
            <tfoot><tr><td className="td font-semibold" colSpan={4}>Order total</td><td className="td text-right font-bold text-navy-900">{money(total)}</td><td /></tr></tfoot>
          </table>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Requested delivery date"><input type="date" className="input" value={delivery} disabled={locked} onChange={e => setDelivery(e.target.value)} /></Field>
          {isAdmin && order && <Field label="Status"><select className="input" value={status} onChange={e => setStatus(e.target.value as OrderStatus)}>{ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}</select></Field>}
          <Field label="Notes for the office" className="sm:col-span-2"><textarea rows={2} className="input" value={notes} disabled={locked} onChange={e => setNotes(e.target.value)} placeholder="Delivery instructions, receiving hours, PO number…" /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>{locked ? 'Close' : 'Cancel'}</button>
          {!locked && <button type="button" className="btn-primary" disabled={!accountId || !lines.length} onClick={submit}>{order ? 'Save changes' : 'Submit order'}</button>}
        </div>
      </div>
    </Modal>
  )
}
