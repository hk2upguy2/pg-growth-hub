import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { Field, Modal, useAction } from './ui'
import { OverdueWarning } from './AccountSnapshot'
import { MAX_REP_DISCOUNT, Quote, QuoteLine, QuoteStatus, lineTotal, quoteTotal } from '../types'
import { money, toDateStr } from '../lib/utils'

const in14 = () => toDateStr(new Date(Date.now() + 14 * 86400000))

export function QuoteBuilder({ open, onClose, quote, defaultAccountId }: { open: boolean; onClose: () => void; quote?: Quote; defaultAccountId?: string }) {
  const { accounts, priceItems, saveQuote, isAdmin } = useStore()
  const run = useAction()
  const [accountId, setAccountId] = useState(quote?.accountId ?? defaultAccountId ?? '')
  const [lines, setLines] = useState<QuoteLine[]>(quote?.lines ?? [])
  const [validUntil, setValidUntil] = useState(quote?.validUntil || in14())
  const [notes, setNotes] = useState(quote?.notes ?? '')
  const [status, setStatus] = useState<QuoteStatus>(quote?.status ?? 'Draft')
  const [declineReason, setDeclineReason] = useState('Price')
  const [pick, setPick] = useState('')
  const [q, setQ] = useState('')
  const locked = quote && quote.status !== 'Draft' && !isAdmin   // reps cannot rewrite a quote that has gone to the customer
  const items = useMemo(() => priceItems.filter(p => p.active && (!q || `${p.brand} ${p.product} ${p.sku}`.toLowerCase().includes(q.toLowerCase()))), [priceItems, q])
  const acct = accounts.find(a => a.id === accountId)
  const total = quoteTotal(lines)

  const add = () => {
    const it = priceItems.find(p => p.id === pick); if (!it) return
    setLines(l => [...l, { brand: it.brand, product: it.product, sku: it.sku, unit: it.unit, qty: 1, price: it.price, discountPct: 0 }]); setPick('')
  }
  const upd = (i: number, patch: Partial<QuoteLine>) => setLines(l => l.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const save = (st: QuoteStatus) => {
    if (!accountId) return
    const r = run(() => saveQuote({ id: quote?.id, accountId, status: st, validUntil, notes, lines, declineReason }), st === 'Draft' ? 'Draft saved' : st === 'Sent' ? 'Quote saved and logged as an activity and opportunity' : 'Quote updated')
    if (r) onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={quote ? `Quote ${quote.quoteNo}` : 'New quote'} wide>
      <div className="space-y-4">
        <Field label="Customer *">
          <select className="input" value={accountId} disabled={!!quote} onChange={e => setAccountId(e.target.value)}>
            <option value="">Choose an account…</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <OverdueWarning account={acct} />
        {priceItems.length === 0 && <div className="text-sm rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2">The price list is empty. Management can add products under Price List.</div>}

        {!locked && (
          <div className="flex gap-2 flex-wrap items-end">
            <Field label="Find a product" className="flex-1 min-w-[160px]"><input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search brand, product or SKU" /></Field>
            <Field label="Add from price list" className="flex-1 min-w-[220px]">
              <select className="input" value={pick} onChange={e => setPick(e.target.value)}>
                <option value="">Choose…</option>{items.map(p => <option key={p.id} value={p.id}>{p.brand} · {p.product} ({p.unit}) {money(p.price)}</option>)}
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
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="td"><div className="font-medium">{l.product}</div><div className="text-xs text-slate-500">{l.brand} · per {l.unit}{l.sku ? ` · ${l.sku}` : ''}</div></td>
                  <td className="td"><input type="number" min="1" className="input !py-1" disabled={!!locked} value={l.qty} onChange={e => upd(i, { qty: Number(e.target.value) })} /></td>
                  <td className="td">{isAdmin ? <input type="number" min="0" step="0.01" className="input !py-1 w-24" value={l.price} onChange={e => upd(i, { price: Number(e.target.value) })} /> : money(l.price)}</td>
                  <td className="td"><input type="number" min="0" max={isAdmin ? 100 : MAX_REP_DISCOUNT} className="input !py-1" disabled={!!locked} value={l.discountPct} onChange={e => upd(i, { discountPct: Number(e.target.value) })} /></td>
                  <td className="td text-right font-semibold">{money(lineTotal(l))}</td>
                  <td className="td">{!locked && <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => setLines(x => x.filter((_, j) => j !== i))} aria-label="Remove line"><Trash2 size={15} /></button>}</td>
                </tr>))}
            </tbody>
            <tfoot><tr><td className="td font-semibold" colSpan={4}>Quote total</td><td className="td text-right font-bold text-navy-900">{money(total)}</td><td /></tr></tfoot>
          </table>
        </div>
        {!isAdmin && <p className="text-xs text-slate-500">Prices come from the price list. Discounts above {MAX_REP_DISCOUNT}% need management.</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Valid until"><input type="date" className="input" value={validUntil} disabled={!!locked} onChange={e => setValidUntil(e.target.value)} /></Field>
          {quote && (isAdmin || quote.status !== 'Draft') && quote.status !== 'Draft' && (
            <Field label="Status">
              <select className="input" value={status} onChange={e => setStatus(e.target.value as QuoteStatus)}>{(['Sent', 'Accepted', 'Declined'] as QuoteStatus[]).map(s => <option key={s}>{s}</option>)}</select>
            </Field>
          )}
          {status === 'Declined' && <Field label="Why declined"><select className="input" value={declineReason} onChange={e => setDeclineReason(e.target.value)}>{['Price', 'Existing supplier contract', 'Quality concerns', 'No demand', 'Stock availability', 'Other'].map(r => <option key={r}>{r}</option>)}</select></Field>}
          <Field label="Notes for the customer" className="sm:col-span-2"><textarea rows={2} className="input" value={notes} disabled={!!locked} onChange={e => setNotes(e.target.value)} placeholder="Delivery timing, payment terms…" /></Field>
        </div>

        <div className="flex justify-end gap-2 flex-wrap">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          {(!quote || quote.status === 'Draft') && <button type="button" className="btn-secondary" disabled={!accountId || !lines.length} onClick={() => save('Draft')}>Save draft</button>}
          {(!quote || quote.status === 'Draft')
            ? <button type="button" className="btn-primary" disabled={!accountId || !lines.length} onClick={() => save('Sent')}>Save and mark as sent</button>
            : <button type="button" className="btn-primary" disabled={!lines.length} onClick={() => save(status)}>Save changes</button>}
        </div>
        {(!quote || quote.status === 'Draft') && <p className="text-xs text-slate-500 text-right">Marking as sent logs a Quotation activity and a Quotation Submitted opportunity for this account.</p>}
      </div>
    </Modal>
  )
}
