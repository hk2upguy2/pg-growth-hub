import { useState } from 'react'
import { ClipboardList, FileText, Printer } from 'lucide-react'
import { printInvoices } from '../lib/invoicePrint'
import { printPickingSheets } from '../lib/pickingSheet'
import { useStore } from '../lib/store'
import { Badge, Modal, useAction } from './ui'
import { Order, OrderStatus, ORDER_STATUSES, lineTotal } from '../types'
import { fmtDate, money } from '../lib/utils'

const tone = { Submitted: 'On Hold', Confirmed: 'Planned', Delivered: 'Active', Cancelled: 'Lost' } as const

/** Read-only, easy-to-scan view of one order. Customer service can also change the status and add office notes. */
export function OrderDetail({ order, onClose }: { order: Order; onClose: () => void }) {
  const { accounts, repName, saveOrder, isService, isAdmin, stock } = useStore()
  const run = useAction()
  const a = accounts.find(x => x.id === order.accountId)
  const [status, setStatus] = useState<OrderStatus>(order.status)
  const [notes, setNotes] = useState(order.notes ?? '')
  const units = order.lines.reduce((n, l) => n + l.qty, 0)
  const save = () => { if (run(() => saveOrder({ id: order.id, accountId: order.accountId, status, notes, lines: order.lines, deliveryDate: order.deliveryDate }), 'Order updated')) onClose() }
  const Row = ({ k, v }: { k: string; v?: string | null }) => (v ? <div className="flex gap-2 text-sm"><span className="w-28 shrink-0 text-slate-500">{k}</span><span className="font-medium text-slate-800 break-words">{v}</span></div> : null)
  return (
    <Modal open onClose={onClose} title={`Order ${order.orderNo}`} wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-slate-50 p-3">
          <Row k="Customer" v={a?.name ?? 'Customer not visible to you'} />
          <Row k="Status" v={order.status} />
          <Row k="Sage invoice" v={order.invoiceNo ? `${order.invoiceNo}${order.invoicedAt ? ' · ' + fmtDate(order.invoicedAt) : ''}${order.invoiceTotal != null ? ' · ' + money(order.invoiceTotal) : ''}` : null} />
          <Row k="Contact" v={[a?.contactName, a?.contactPosition].filter(Boolean).join(' · ')} />
          <Row k="Placed" v={fmtDate(order.createdAt)} />
          <Row k="Phone" v={a?.phone} />
          <Row k="Deliver on" v={order.deliveryDate ? fmtDate(order.deliveryDate) : 'ASAP'} />
          <Row k="Address" v={[a?.address, a?.village].filter(Boolean).join(', ')} />
          <Row k="Taken by" v={repName(order.repId)} />
        </div>
        {order.editedAt && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm p-2">The rep changed this order on {fmtDate(order.editedAt)}. Check the lines again before confirming.</div>}
        {a && (a.overdueBalance ?? 0) > 0 && <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm p-2">Overdue balance {money(a.overdueBalance ?? 0)}. Check before confirming.</div>}
        {a?.status === 'On Hold' && <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm p-2 font-semibold">This account is On Hold.</div>}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full min-w-[520px]">
            <thead><tr><th className="th">Product</th><th className="th text-right">Qty</th><th className="th text-right">Price</th><th className="th text-right">Disc.</th><th className="th text-right">Total</th></tr></thead>
            <tbody>{order.lines.map((l, i) => { const st = stock.find(s => `${s.brand}|${s.sku || s.product}`.toLowerCase() === `${l.brand}|${l.sku || l.product}`.toLowerCase()); const short = st ? l.qty > st.onHand : false; return (
              <tr key={i}>
                <td className="td"><div className="font-medium">{l.product}</div><div className="text-xs text-slate-500">{l.brand}{l.sku ? ` · ${l.sku}` : ''} · per {l.unit}{st && <span className={short ? 'text-red-600 font-medium' : ''}> · {short ? `only ${st.onHand} in stock` : `${st.onHand} in stock`}</span>}</div></td>
                <td className="td text-right font-semibold">{l.qty}</td><td className="td text-right">{money(l.price)}</td>
                <td className="td text-right">{l.discountPct ? `${l.discountPct}%` : '—'}</td><td className="td text-right font-semibold">{money(lineTotal(l))}</td>
              </tr>) })}</tbody>
            <tfoot><tr><td className="td font-semibold">{order.lines.length} line{order.lines.length === 1 ? '' : 's'} · {units} units</td><td colSpan={3} className="td text-right font-semibold">Order total</td><td className="td text-right font-bold text-navy-900">{money(order.total)}</td></tr></tfoot>
          </table>
        </div>
        {isService ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm font-medium">Status
              <select className="input mt-1" value={status} onChange={e => setStatus(e.target.value as OrderStatus)}>{ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
            <label className="block text-sm font-medium sm:col-span-2">Notes
              <textarea rows={2} className="input mt-1" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Rep's delivery notes, or your own office notes…" /></label>
          </div>
        ) : (order.notes ? <div className="text-sm"><span className="text-slate-500">Notes: </span><em>{order.notes}</em></div> : <Badge tone={tone[order.status]}>{order.status}</Badge>)}
        <div className="flex justify-end gap-2 print:hidden">
          {(isService || isAdmin) && <button type="button" className="btn-secondary" onClick={() => printPickingSheets([order], { accounts, stock, repName })}><ClipboardList size={16} /> Picking sheet</button>}
          {(isService || isAdmin) && <button type="button" className="btn-secondary" onClick={() => printInvoices([order], { accounts, repName })}><FileText size={16} /> Invoice</button>}
          <button type="button" className="btn-secondary" onClick={() => window.print()}><Printer size={16} /> Print</button>
          <button type="button" className="btn-secondary" onClick={onClose}>{isService ? 'Cancel' : 'Close'}</button>
          {isService && <button type="button" className="btn-primary" onClick={save}>Save</button>}
        </div>
      </div>
    </Modal>
  )
}
