import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { Badge, ConfirmButton, EmptyState, PageHeader, useAction } from '../components/ui'
import { QuoteBuilder } from '../components/QuoteBuilder'
import { printQuote } from '../lib/quotePrint'
import { fmtDate, money } from '../lib/utils'
import { QUOTE_STATUSES, Quote } from '../types'

const tone = { Draft: 'Planned', Sent: 'On Hold', Accepted: 'Active', Declined: 'Lost' } as const

export default function Quotes() {
  const { quotes, accounts, accountName, repName, isAdmin, deleteQuote } = useStore()
  const run = useAction()
  const [status, setStatus] = useState('')
  const [edit, setEdit] = useState<Quote | undefined>()
  const [creating, setCreating] = useState(false)
  const rows = useMemo(() => quotes.filter(q => !status || q.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [quotes, status])
  const open = quotes.filter(q => q.status === 'Sent')

  return (
    <>
      <PageHeader title="Quotes" subtitle={`${quotes.length} quotes · ${open.length} awaiting an answer (${money(open.reduce((n, q) => n + q.total, 0))})`}
        actions={<button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New quote</button>} />
      <div className="card p-3 mb-4 flex gap-2 flex-wrap">
        <select className="input !w-auto" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{QUOTE_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
      </div>
      {rows.length === 0 ? <div className="card p-8"><EmptyState title="No quotes yet" hint="Create a quote from the price list. Once sent, it is logged as an activity and an opportunity." /></div> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead><tr><th className="th">Quote</th><th className="th">Customer</th>{isAdmin && <th className="th">Rep</th>}<th className="th">Date</th><th className="th">Valid until</th><th className="th text-right">Total</th><th className="th">Status</th><th className="th" /></tr></thead>
            <tbody>
              {rows.map(q => (
                <tr key={q.id}>
                  <td className="td font-medium"><FileText size={14} className="inline mr-1 text-slate-400" />{q.quoteNo}</td>
                  <td className="td"><Link className="text-navy-700 hover:underline" to={`/account/${q.accountId}`}>{accountName(q.accountId)}</Link></td>
                  {isAdmin && <td className="td">{repName(q.repId)}</td>}
                  <td className="td">{fmtDate(q.createdAt)}</td><td className="td">{q.validUntil ? fmtDate(q.validUntil) : '—'}</td>
                  <td className="td text-right font-semibold">{money(q.total)}</td><td className="td"><Badge tone={tone[q.status]}>{q.status}</Badge></td>
                  <td className="td whitespace-nowrap">
                    <button className="text-slate-500 hover:text-navy-700 mr-2" aria-label="Print" onClick={() => printQuote(q, accounts.find(a => a.id === q.accountId), repName(q.repId))}><Printer size={16} /></button>
                    <button className="text-slate-500 hover:text-navy-700 mr-2" aria-label="Edit" onClick={() => setEdit(q)}><Pencil size={16} /></button>
                    {(isAdmin || q.status === 'Draft') && <ConfirmButton className="text-slate-400 hover:text-red-600" message={`Delete quote ${q.quoteNo}?`} onConfirm={() => run(() => deleteQuote(q.id), 'Quote deleted')}><Trash2 size={16} /></ConfirmButton>}
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <QuoteBuilder open onClose={() => setCreating(false)} />}
      {edit && <QuoteBuilder key={edit.id + edit.status} open quote={edit} onClose={() => setEdit(undefined)} />}
    </>
  )
}
