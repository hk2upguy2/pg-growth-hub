import { ChangeEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Upload } from 'lucide-react'
import { useStore } from '../lib/store'
import { Badge, EmptyState, Field, PageHeader } from '../components/ui'
import { downloadFile, money } from '../lib/utils'
import { autoMap, parseCSV, FieldDef } from '../lib/importer'
import { parseAmount, sageKey } from '../lib/sales'

const FIELDS: FieldDef[] = [
  { key: 'customer', label: 'Sage customer number', required: true, aliases: ['customer number', 'customer no', 'customer #', 'customerno', 'cust no', 'custno', 'customer id', 'customer', 'account number', 'account no'] },
  { key: 'balance', label: 'Balance owed ($)', required: true, aliases: ['balance', 'balance due', 'total balance', 'ar balance', 'amount owed', 'outstanding', 'total due', 'current balance'] },
  { key: 'overdue', label: 'Overdue / past due ($)', aliases: ['overdue', 'past due', 'pastdue', 'overdue balance', 'past due balance', 'amount overdue', 'over 30', '31 days and over'] },
]

export default function BalanceImport() {
  const { accounts, isAdmin, importBalances } = useStore()
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ updated: number; overdueTotal: number; error?: string } | null>(null)
  const [readError, setReadError] = useState('')

  const prep = useMemo(() => {
    if (!rows.length || mapping.customer < 0 || mapping.balance < 0) return null
    const bySage = new Map(accounts.filter(a => a.sageNo).map(a => [sageKey(a.sageNo!), a]))
    const sum = new Map<string, { accountId: string; balance: number; overdue: number }>()
    const unmatched = new Map<string, number>(); const errors: string[] = []
    rows.forEach((r, i) => {
      const cust = (r[mapping.customer] ?? '').trim()
      if (!cust) return
      const bal = parseAmount(r[mapping.balance] ?? '')
      if (bal === null) { errors.push(`Line ${i + 2}: cannot read the balance “${r[mapping.balance] ?? ''}”`); return }
      const od = mapping.overdue >= 0 ? parseAmount(r[mapping.overdue] ?? '') ?? 0 : 0
      const acc = bySage.get(sageKey(cust))
      if (!acc) { unmatched.set(cust, (unmatched.get(cust) ?? 0) + bal); return }
      const cur = sum.get(acc.id) ?? { accountId: acc.id, balance: 0, overdue: 0 }   // invoice-level files add up per customer
      cur.balance += bal; cur.overdue += od; sum.set(acc.id, cur)
    })
    const list = [...sum.values()]
    return { list, unmatched: [...unmatched.entries()], errors, total: list.reduce((n, x) => n + x.balance, 0), overdue: list.reduce((n, x) => n + x.overdue, 0), withOverdue: list.filter(x => x.overdue > 0).length }
  }, [rows, mapping, accounts])

  if (!isAdmin) return <div className="card p-8"><EmptyState title="Only management can load balances" /></div>

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setResult(null); setReadError('')
    if (/\.xlsx?$/i.test(f.name)) { setReadError('This is an Excel file. In Excel choose File, Save As, then “CSV UTF-8 (Comma delimited)”, and upload that file.'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const all = parseCSV(String(reader.result ?? ''))
      if (all.length < 2) { setReadError('The file has no data rows. The first row must be the column headings.'); return }
      setFileName(f.name); setHeaders(all[0]); setRows(all.slice(1)); setMapping(autoMap(all[0], FIELDS))
    }
    reader.readAsText(f, 'utf-8')
  }
  const apply = async () => {
    if (!prep) return
    setBusy(true)
    try { setResult(await importBalances(prep.list)) } catch (e) { setResult({ updated: 0, overdueTotal: 0, error: e instanceof Error ? e.message : 'Update failed' }) }
    setBusy(false)
  }

  return (
    <>
      <Link to="/accounts" className="text-sm text-navy-600 hover:underline inline-flex items-center gap-1 mb-2"><ArrowLeft size={14} /> Account Directory</Link>
      <PageHeader title="Balances Update from Sage" subtitle="Load what each customer owes, so reps see overdue accounts before they sell"
        actions={<button className="btn-secondary" onClick={() => downloadFile('pg-balances-template.csv', '﻿Customer Number,Balance,Overdue\r\n', 'text/csv;charset=utf-8')}><Download size={16} /> Download template</button>} />
      {result && (
        <div className={`card p-4 mb-4 ${result.error ? 'border-red-300' : 'border-emerald-300'}`}>
          {result.error ? <div className="font-semibold text-red-700">Update stopped: {result.error}</div>
            : <><div className="font-semibold text-emerald-700">Balances updated.</div><div className="text-sm text-slate-600 mt-1">{result.updated} accounts updated · {money(result.overdueTotal)} overdue in total. Customers not in your file keep their old balance.</div><Link className="btn-primary mt-3" to="/">Go to Dashboard</Link></>}
        </div>
      )}
      {!prep && !rows.length ? (
        <div className="card p-6 space-y-4">
          <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
            <li>Export your Sage <strong>A/R aging</strong> (or customer balance) report to CSV.</li>
            <li>Columns needed: <strong>customer number</strong> and <strong>balance</strong>. Helpful: <strong>overdue / past due</strong> amount.</li>
            <li>One row per customer, or one per invoice (invoice rows are added up per customer). Remove title lines and grand totals.</li>
            <li>Each load replaces the old balance for the customers in the file, so load the full report each time.</li>
          </ul>
          <label className="btn-primary cursor-pointer w-fit"><Upload size={16} /> Choose CSV file<input id="balance-file" type="file" accept=".csv,text/csv,.txt" className="hidden" onChange={onFile} /></label>
          {readError && <div className="text-sm rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2">{readError}</div>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card p-4 flex items-center justify-between gap-2 flex-wrap"><div><span className="font-semibold text-navy-900">{fileName}</span> <span className="text-sm text-slate-500">· {rows.length} rows</span></div>
            <button className="btn-secondary" onClick={() => { setRows([]); setHeaders([]); setFileName(''); setResult(null) }}>Choose a different file</button></div>
          <div className="card p-4">
            <h3 className="font-semibold text-navy-900 mb-3">Match your columns</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {FIELDS.map(f => <Field key={f.key} label={f.label + (f.required ? ' *' : '')}>
                <select className="input" value={mapping[f.key] ?? -1} onChange={e => setMapping(m => ({ ...m, [f.key]: Number(e.target.value) }))}>
                  <option value={-1}>— not in my file —</option>{headers.map((h, i) => <option key={i} value={i}>{h || `(column ${i + 1})`}</option>)}</select></Field>)}
            </div>
          </div>
          {prep && (
            <div className="card p-4">
              <h3 className="font-semibold text-navy-900 mb-3">Check before updating</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge tone="Active">{prep.list.length} customers matched</Badge><Badge tone="A">{money(prep.total)} owed</Badge>
                <Badge tone="Lost">{money(prep.overdue)} overdue ({prep.withOverdue} customers)</Badge><Badge tone="On Hold">{prep.unmatched.length} not in the CRM</Badge>
                {prep.errors.length > 0 && <Badge tone="Lost">{prep.errors.length} rows skipped</Badge>}
              </div>
              {prep.errors.length > 0 && <ul className="text-xs text-red-700 mb-2 max-h-28 overflow-y-auto">{prep.errors.slice(0, 50).map(e => <li key={e}>{e}</li>)}</ul>}
              {prep.unmatched.length > 0 && <details className="mb-2"><summary className="text-sm cursor-pointer font-medium text-amber-800">Sage customers with no matching account</summary><ul className="text-xs text-slate-600 mt-1 max-h-32 overflow-y-auto">{prep.unmatched.slice(0, 100).map(([c, b]) => <li key={c}>{c}: {money(b)}</li>)}</ul></details>}
              <div className="flex justify-end"><button className="btn-primary" disabled={busy || prep.list.length === 0 || (!!result && !result.error)} onClick={apply}>{busy ? 'Updating…' : `Update balances for ${prep.list.length} customers`}</button></div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
