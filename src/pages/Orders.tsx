import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { Badge, ConfirmButton, EmptyState, PageHeader, useAction } from '../components/ui'
import { OrderForm } from '../components/OrderForm'
import { fmtDate, money } from '../lib/utils'
import { ORDER_STATUSES, Order } from '../types'

const tone = { Submitted: 'On Hold', Confirmed: 'Planned', Delivered: 'Active', Cancelled: 'Lost' } as const

export default function Orders() {
  const { orders, quotes, accountName, repName, isAdmin, deleteOrder } = useStore()
  const run = useAction()
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState('')
  const [edit, setEdit] = useState<Order | undefined>()
  const [creating, setCreating] = useState(false)
  const fromQuote = quotes.find(q => q.id === params.get('quote'))
  const rows = useMemo(() => orders.filter(o => !status || o.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [orders, status])
  const waiting = orders.filter(o => o.status === 'Submitted')
  const close = () => { setCreating(false); if (params.get('quote')) setParams({}) }

  return (
    <>
      <PageHeader title="Orders" subtitle={`${orders.length} orders · ${waiting.length} waiting for the office (${money(waiting.reduce((n, o) => n + o.total, 0))})`}
        actions={<button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New order</button>} />
      <div className="card p-3 mb-4 flex gap-2 flex-wrap">
        <select className="input !w-auto" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
      </div>
      {rows.length === 0 ? <div className="card p-8"><EmptyState title="No orders yet" hint="Create an order, or open an accepted quote and choose Make order." /></div> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead><tr><th className="th">Order</th><th className="th">Customer</th>{isAdmin && <th className="th">Rep</th>}<th className="th">Placed</th><th className="th">Delivery</th><th className="th text-right">Total</th><th className="th">Status</th><th className="th" /></tr></thead>
            <tbody>{rows.map(o => (
              <tr key={o.id}>
                <td className="td font-medium">{o.orderNo}</td>
                <td className="td"><Link className="text-navy-700 hover:underline" to={`/account/${o.accountId}`}>{accountName(o.accountId)}</Link></td>
                {isAdmin && <td className="td">{repName(o.repId)}</td>}
                <td className="td">{fmtDate(o.createdAt)}</td><td className="td">{o.deliveryDate ? fmtDate(o.deliveryDate) : '—'}</td>
                <td className="td text-right font-semibold">{money(o.total)}</td><td className="td"><Badge tone={tone[o.status]}>{o.status}</Badge></td>
                <td className="td whitespace-nowrap">
                  <button className="text-slate-500 hover:text-navy-700 mr-2" aria-label={isAdmin ? 'Edit' : 'View'} onClick={() => setEdit(o)}><Pencil size={16} /></button>
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
