import { ChangeEvent, useMemo, useState } from 'react'
import { Upload } from 'lucide-react'
import { useStore } from '../lib/store'
import { Modal, useAction } from './ui'
import { parseCSV } from '../lib/importer'
import { readXlsx } from '../lib/xlsx'
import { matchInvoices, parseInvoiceListing, parseOpenOrders, SageInvoice, SageOpenOrder } from '../lib/invoices'
import { money } from '../lib/utils'

async function readRows(f: File): Promise<string[][]> {
  if (/\.xlsx$/i.test(f.name)) return readXlsx(await f.arrayBuffer())
  if (/\.xls$/i.test(f.name)) throw new Error('This is an old .xls file. In Excel choose Save As, then Excel Workbook (.xlsx), and upload that.')
  return parseCSV(await f.text())
}

/** Loads Sage's Invoice Listing and/or Open Sales Order Listing and attaches the Sage invoice numbers to CRM orders. */
export function InvoiceImport({ onClose }: { onClose: () => void }) {
  const { orders, accounts, applyInvoices } = useStore()
  const run = useAction()
  const [invoices, setInvoices] = useState<SageInvoice[]>([])
  const [open, setOpen] = useState<SageOpenOrder[]>([])
  const [files, setFiles] = useState<string[]>([])
  const [problem, setProblem] = useState('')

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    setProblem('')
    for (const f of Array.from(e.target.files ?? [])) {
      try {
        const rows = await readRows(f)
        const inv = parseInvoiceListing(rows), op = parseOpenOrders(rows)
        if (inv) setInvoices(inv); else if (op) setOpen(op)
        else { setProblem(`${f.name}: this is not Sage's Invoice Listing or Open Sales Order Listing (the heading row was not found).`); continue }
        setFiles(x => [...x, `${f.name} (${inv ? `${inv.length} invoices` : `${op!.length} open orders`})`])
      } catch (err) { setProblem(`${f.name}: ${err instanceof Error ? err.message : 'could not be read'}`) }
    }
    e.target.value = ''
  }
  const m = useMemo(() => matchInvoices(invoices, open, orders, accounts), [invoices, open, orders, accounts])
  const apply = () => { if (run(() => applyInvoices(m.links), 'Sage invoice numbers saved')) onClose() }

  return (
    <Modal open onClose={onClose} title="Load Sage invoices" wide>
      <div className="space-y-3 text-sm">
        <p className="text-slate-600">In Sage run the <b>Invoice Listing</b> and the <b>Open Sales Order Listing</b>, save them to Excel, and choose them here (one or both). Each CRM order gets its Sage invoice number, date and total.</p>
        <label className="btn-secondary cursor-pointer inline-flex"><Upload size={16} /> Choose files
          <input type="file" multiple accept=".xlsx,.csv" className="hidden" onChange={onFiles} /></label>
        {files.length > 0 && <ul className="list-disc pl-5 text-slate-600">{files.map(f => <li key={f}>{f}</li>)}</ul>}
        {problem && <div className="rounded-lg bg-red-50 text-red-700 p-2">{problem}</div>}
        {(invoices.length > 0 || open.length > 0) && (
          <div className="rounded-lg bg-slate-50 p-3 space-y-1">
            <div><b>{m.links.length}</b> CRM order{m.links.length === 1 ? '' : 's'} will get Sage numbers{m.unchanged ? ` · ${m.unchanged} already up to date` : ''}</div>
            <div className="text-slate-500">{m.sageOnly} Sage document{m.sageOnly === 1 ? '' : 's'} did not come from a CRM order (walk-ins, standing orders, keyed in Sage) and are ignored.</div>
            {m.mismatched.length > 0 && <div className="text-red-700">{m.mismatched.length} skipped, wrong customer: {m.mismatched.slice(0, 3).map(x => `${x.orderNo} / ${x.invoiceNo} (${x.reason})`).join('; ')}{m.mismatched.length > 3 ? '…' : ''}</div>}
          </div>)}
        {m.links.length > 0 && (
          <div className="max-h-56 overflow-auto border border-slate-100 rounded-lg">
            <table className="w-full"><thead><tr><th className="th">CRM order</th><th className="th">Sage order</th><th className="th">Invoice</th><th className="th text-right">Invoice total</th></tr></thead>
              <tbody>{m.links.slice(0, 100).map(l => <tr key={l.orderId}><td className="td">{l.orderNo}</td><td className="td">{l.sageOrderNo ?? ''}</td><td className="td font-medium">{l.invoiceNo ?? <span className="text-slate-400">not yet</span>}</td><td className="td text-right">{l.invoiceTotal != null ? money(l.invoiceTotal) : ''}</td></tr>)}</tbody></table>
          </div>)}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!m.links.length} onClick={apply}>Save {m.links.length} order{m.links.length === 1 ? '' : 's'}</button>
        </div>
      </div>
    </Modal>
  )
}
