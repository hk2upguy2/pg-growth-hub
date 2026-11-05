import { ChangeEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Upload } from 'lucide-react'
import { useStore } from '../lib/store'
import { Badge, EmptyState, Field, PageHeader } from '../components/ui'
import { downloadFile, money, monthLabel } from '../lib/utils'
import { autoMap, parseCSV } from '../lib/importer'
import { SALES_FIELDS, prepareSales } from '../lib/sales'

const FALLBACK_BRANDS = ['Other', 'Agrosuper', 'Hostess', 'Kikkoman']

export default function SalesImport() {
  const { accounts, isAdmin, importSales } = useStore()
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, number>>({})
  const [fallbackBrand, setFallbackBrand] = useState('Other')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ saved: number; updated: number; activated: number; error?: string } | null>(null)
  const [readError, setReadError] = useState('')

  const withSage = accounts.filter(a => a.sageNo).length
  const prep = useMemo(
    () => (rows.length ? prepareSales(rows, mapping, fallbackBrand, accounts) : null),
    [rows, mapping, fallbackBrand, accounts],
  )

  if (!isAdmin) return <div className="card p-8"><EmptyState title="Only management can load sales data" /></div>

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setResult(null); setReadError('')
    if (/\.xlsx?$/i.test(f.name)) { setReadError('This is an Excel file. In Excel choose File, Save As, then “CSV UTF-8 (Comma delimited)”, and upload that file.'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const all = parseCSV(String(reader.result ?? ''))
      if (all.length < 2) { setReadError('The file has no data rows. The first row must be the column headings.'); return }
      setFileName(f.name); setHeaders(all[0]); setRows(all.slice(1)); setMapping(autoMap(all[0], SALES_FIELDS))
    }
    reader.onerror = () => setReadError('Could not read that file.')
    reader.readAsText(f, 'utf-8')
  }

  const apply = async () => {
    if (!prep) return
    setBusy(true)
    try { setResult(await importSales(prep.records)) }
    catch (e) { setResult({ saved: 0, updated: 0, activated: 0, error: e instanceof Error ? e.message : 'Update failed' }) }
    setBusy(false)
  }
  const template = () => downloadFile('pg-sales-update-template.csv', '﻿Customer Number,Month,Brand,Amount,Quantity\r\n', 'text/csv;charset=utf-8')
  const mapped = mapping.customer >= 0 && mapping.date >= 0 && mapping.amount >= 0
  const nameOf = (id: string) => accounts.find(a => a.id === id)?.name ?? id

  return (
    <>
      <Link to="/accounts" className="text-sm text-navy-600 hover:underline inline-flex items-center gap-1 mb-2"><ArrowLeft size={14} /> Account Directory</Link>
      <PageHeader title="Sales Update from Sage" subtitle="Load monthly sales exported from Sage 100"
        actions={<button className="btn-secondary" onClick={template}><Download size={16} /> Download template</button>} />

      {withSage === 0 && (
        <div className="card p-4 mb-4 border-amber-300 bg-amber-50 text-sm text-amber-900">
          None of your accounts has a Sage customer number yet, so nothing can be matched. Add the number when you import your customer list
          (a “Customer Number” column), or edit an account and fill in <strong>Sage customer number</strong>.
        </div>
      )}

      {result && (
        <div className={`card p-4 mb-4 ${result.error ? 'border-red-300' : 'border-emerald-300'}`}>
          {result.error
            ? <div className="font-semibold text-red-700">Update stopped: {result.error}</div>
            : <>
              <div className="font-semibold text-emerald-700">Sales updated.</div>
              <div className="text-sm text-slate-600 mt-1">{result.saved} monthly figures saved · {result.updated} accounts updated · {result.activated} prospects became Active.</div>
              <Link className="btn-primary mt-3" to="/">Go to Dashboard</Link>
            </>}
        </div>
      )}

      {!prep ? (
        <div className="card p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-navy-900">1. Export from Sage</h3>
            <ul className="text-sm text-slate-600 list-disc pl-5 mt-1 space-y-1">
              <li>One row per customer per month per brand works best. Daily invoice lines also work: they are added up by month.</li>
              <li>Columns needed: <strong>customer number</strong>, <strong>month or invoice date</strong>, <strong>sales amount</strong>. Helpful: <strong>brand</strong> (or an item name containing Agrosuper, Hostess or Kikkoman) and <strong>quantity</strong>.</li>
              <li>In Excel, format the customer number column as <strong>Text</strong> before saving, then save as <strong>CSV UTF-8</strong>. Remove any title lines or grand-total rows.</li>
              <li>Loading a month again replaces that customer’s figure for that month and brand. It never double counts.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-navy-900 mb-2">2. Choose the file</h3>
            <label className="btn-primary cursor-pointer"><Upload size={16} /> Choose CSV file
              <input id="sales-file" type="file" accept=".csv,text/csv,.txt" className="hidden" onChange={onFile} /></label>
            {readError && <div className="mt-3 text-sm rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2">{readError}</div>}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card p-4 flex items-center justify-between gap-2 flex-wrap">
            <div><span className="font-semibold text-navy-900">{fileName}</span> <span className="text-sm text-slate-500">· {rows.length} rows</span></div>
            <button className="btn-secondary" onClick={() => { setRows([]); setHeaders([]); setFileName(''); setResult(null) }}>Choose a different file</button>
          </div>

          <div className="card p-4">
            <h3 className="font-semibold text-navy-900 mb-1">Match your columns</h3>
            <p className="text-xs text-slate-500 mb-3">Change any that look wrong.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {SALES_FIELDS.map(f => (
                <Field key={f.key} label={f.label + (f.required ? ' *' : '')}>
                  <select className="input" value={mapping[f.key] ?? -1} onChange={e => setMapping(m => ({ ...m, [f.key]: Number(e.target.value) }))}>
                    <option value={-1}>— not in my file —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `(column ${i + 1})`}</option>)}
                  </select>
                </Field>
              ))}
              <Field label="Brand when the file has none">
                <select className="input" value={fallbackBrand} onChange={e => setFallbackBrand(e.target.value)}>{FALLBACK_BRANDS.map(b => <option key={b}>{b}</option>)}</select>
              </Field>
            </div>
            {!mapped && <div className="mt-3 text-sm text-red-700">Choose the customer number, date and amount columns.</div>}
          </div>

          <div className="card p-4">
            <h3 className="font-semibold text-navy-900 mb-3">Check before updating</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge tone="Active">{prep.customersMatched} customers matched</Badge>
              <Badge tone="Planned">{prep.months.length ? prep.months.map(monthLabel).join(', ') : 'no months'}</Badge>
              <Badge tone="A">{money(prep.totalAmount)} total</Badge>
              <Badge tone="On Hold">{prep.unmatched.length} Sage customers not in the CRM</Badge>
              <Badge tone="Lost">{prep.errors.length} rows with errors (skipped)</Badge>
            </div>
            {prep.errors.length > 0 && (
              <details className="mb-2" open={prep.errors.length < 8}><summary className="text-sm cursor-pointer font-medium text-red-700">Rows with errors</summary>
                <ul className="text-xs text-slate-600 mt-1 space-y-0.5 max-h-40 overflow-y-auto">{prep.errors.slice(0, 100).map(e => <li key={e.line}>Line {e.line}: {e.msg}</li>)}</ul></details>
            )}
            {prep.unmatched.length > 0 && (
              <details className="mb-2"><summary className="text-sm cursor-pointer font-medium text-amber-800">Sage customers with no matching account (their sales are not loaded)</summary>
                <ul className="text-xs text-slate-600 mt-1 space-y-0.5 max-h-40 overflow-y-auto">{prep.unmatched.slice(0, 150).map(u => <li key={u.sageNo}>{u.sageNo}: {u.rows} rows, {money(u.amount)}</li>)}</ul></details>
            )}
            <div className="overflow-x-auto mt-3 border border-slate-200 rounded-lg">
              <table className="w-full min-w-[500px]"><thead><tr><th className="th">Account</th><th className="th">Month</th><th className="th">Brand</th><th className="th">Amount</th></tr></thead>
                <tbody>{prep.records.slice(0, 8).map((r, i) => <tr key={i}><td className="td">{nameOf(r.accountId)}</td><td className="td">{monthLabel(r.month)}</td><td className="td">{r.brand}</td><td className="td">{money(r.amount)}</td></tr>)}</tbody></table>
            </div>
            <p className="text-xs text-slate-500 mt-1">Showing the first {Math.min(8, prep.records.length)} of {prep.records.length} monthly figures.</p>
            <p className="text-xs text-slate-500 mt-2">Actual monthly sales on each account will be the average of the newest three months in your data. Last order date is the newest sale. A Prospect that has bought becomes Active.</p>
            <div className="flex justify-end mt-4">
              <button className="btn-primary" disabled={busy || !mapped || prep.records.length === 0 || (!!result && !result.error)} onClick={apply}>
                {busy ? 'Updating…' : `Update sales for ${prep.customersMatched} customers`}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
