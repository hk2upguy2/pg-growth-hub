import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { Badge, ConfirmButton, EmptyState, PageHeader, useAction } from '../components/ui'
import { OrderForm } from '../components/OrderForm'
import { exportCSV, fmtDate, money } from '../lib/utils'
import { ORDER_STATUSES, Order } from '../types'

const tone = { Submitted: 'On Hold', Confirmed: 'Planned', Delivered: 'Active', Cancelled: 'Lost' } as const

export default function Orders() {
  const { orders, quotes, accountName, repName, isAdmin, isService, deleteOrder } = useStore()
  const run = useAction()
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState('')
  const [edit, setEdit] = useState<Order | undefined>()
  const [creating, setCreating] = useState(false)
  const fromQuote = quotes.find(q => q.id === params.get('quote'))
  const rows = useMemo(() => orders.filter(o => !status || o.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [orders, status])
  const waiting = orders.filter(o => o.status === 'Submitted')
  const office = isAdmin || isService
  const [day, setDay] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Guam' }))
  const dayOrders = orders.filter(o => new Date(o.createdAt).toLocaleDateString('en-CA', { timeZone: 'Pacific/Guam' }) === day).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const dayRows = () => dayOrders.flatMap(o => o.lines.map(l => ({ Order: o.orderNo, Customer: accountName(o.accountId), Rep: repName(o.repId), Status: o.status, Delivery: o.deliveryDate, Brand: l.brand, SKU: l.sku, Product: l.product, Unit: l.unit, Qty: l.qty, Price: l.price, 'Disc %': l.discountPct, 'Line total': +(l.qty * l.price * (1 - l.discountPct / 100)).toFixed(2), Notes: o.notes })))
  const close = () => { setCreating(false); if (params.get('quote')) setParams({}) }

  return (
    <>
      <PageHeader title="Orders" subtitle={`${orders.length} orders · ${waiting.length} waiting for the office (${money(waiting.reduce((n, o) => n + o.total, 0))})`}
        actions={isService ? undefined : <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New order</button>} />
      {office && (
        <div className="card p-3 mb-4 flex gap-2 flex-wrap items-center print:hidden">
          <span className="text-sm font-semibold text-navy-900">Daily order list</span>
          <input type="date" className="input !w-auto" value={day} onChange={e => setDay(e.target.value)} />
          <span className="text-sm text-slate-600">{dayOrders.length} order{dayOrders.length === 1 ? '' : 's'} · {money(dayOrders.reduce((n, o) => n + o.total, 0))}</span>
          <button className="btn-secondary ml-auto" disabled={!dayOrders.length} onClick={() => exportCSV(`pg-orders-${day}`, dayRows())}><Download size={16} /> Download</button>
          <button className="btn-secondary" disabled={!dayOrders.length} onClick={() => window.print()}><Printer size={16} /> Print</button>
        </div>)}
      {office && dayOrders.length > 0 && (
        <div className="hidden print:block mb-4 text-sm">
          <h2 className="text-lg font-bold mb-2">Pacific Grocers · Orders for {day}</h2>
          {dayOrders.map(o => (
            <div key={o.id} className="mb-3 break-inside-avoid">
              <div className="font-semibold">{o.orderNo} · {accountName(o.accountId)} · rep {repName(o.repId)} · deliver {o.deliveryDate || '—'} · {money(o.total)}</div>
              <ul className="pl-4 list-disc">{o.lines.map((l, i) => <li key={i}>{l.qty} × {l.product} ({l.unit}){l.discountPct ? ` · ${l.discountPct}% off` : ''}</li>)}</ul>
              {o.notes && <div className="italic">Note: {o.notes}</div>}
            </div>))}
        </div>)}
      <div className="card p-3 mb-4 flex gap-2 flex-wrap print:hidden">
        <select className="input !w-auto" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
      </div>
      {rows.length === 0 ? <div className="card p-8"><EmptyState title="No orders yet" hint="Create an order, or open an accepted quote and choose Make order." /></div> : (
        <div className="card overflow-x-auto print:hidden">
          <table className="w-full min-w-[720px]">
            <thead><tr><th className="th">Order</th><th className="th">Customer</th>{office && <th className="th">Rep</th>}<th className="th">Placed</th><th className="th">Delivery</th><th className="th text-right">Total</th><th className="th">Status</th><th className="th" /></tr></thead>
            <tbody>{rows.map(o => (
              <tr key={o.id}>
                <td className="td font-medium">{o.orderNo}</td>
                <td className="td"><Link className="text-navy-700 hover:underline" to={`/account/${o.accountId}`}>{accountName(o.accountId)}</Link></td>
                {office && <td className="td">{repName(o.repId)}</td>}
                <td className="td">{fmtDate(o.createdAt)}</td><td className="td">{o.deliveryDate ? fmtDate(o.deliveryDate) : '—'}</td>
                <td className="td text-right font-semibold">{money(o.total)}</td><td className="td"><Badge tone={tone[o.status]}>{o.status}</Badge></td>
                <td className="td whitespace-nowrap">
                  <button className="text-slate-500 hover:text-navy-700 mr-2" aria-label={office ? 'Edit' : 'View'} onClick={() => setEdit(o)}><Pencil size={16} /></button>
                  {isAdmin && <ConfirmButton className="text-slate-400 hover:text-red-600" message={`Delete order ${o.orderNo}?`} onConfirm={() => run(() => deleteOrder(o.id), 'Order deleted')}><Trash2 size={16} /></ConfirmButton>}
                </td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      {(creating || fromQuote) && <OrderForm open onClose={close} fromQuote={fromQuote} />}
      {edit && <OrderForm key={edit.id + edit.status} open order={edit} onClose={() => setEdit(undefined)} />}
    </>
  )
}
