import { ChangeEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Upload } from 'lucide-react'
import { useStore } from '../lib/store'
import { ACCOUNT_TYPES, AccountStatus, AccountType, STATUSES } from '../types'
import { Badge, EmptyState, Field, PageHeader } from '../components/ui'
import { downloadFile } from '../lib/utils'
import { FIELDS, ImportSettings, TEMPLATE_HEADERS, autoMap, parseCSV, prepare } from '../lib/importer'

export default function ImportAccounts() {
  const { profiles, accounts, importAccounts, isAdmin } = useStore()
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, number>>({})
  const [defaultType, setDefaultType] = useState<AccountType>('Retail')
  const [defaultStatus, setDefaultStatus] = useState<AccountStatus>('Prospect')
  const [defaultRepId, setDefaultRepId] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ added: number; failed: number; error?: string } | null>(null)
  const [readError, setReadError] = useState('')

  const reps = profiles.filter(p => p.role === 'rep' && p.active)
  const settings: ImportSettings = { defaultType, defaultStatus, defaultRepId }
  const prepared = useMemo(
    () => (rows.length ? prepare(rows, mapping, settings, reps.map(r => ({ id: r.id, name: r.name, email: r.email })), accounts) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, mapping, defaultType, defaultStatus, defaultRepId, profiles, accounts],
  )
  const ready = prepared.filter(p => p.data && !p.duplicate)
  const dupes = prepared.filter(p => p.duplicate)
  const bad = prepared.filter(p => p.errors.length)
  const warned = ready.filter(p => p.warnings.length)

  if (!isAdmin) return <div className="card p-8"><EmptyState title="Only management can import accounts" /></div>

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setResult(null); setReadError('')
    if (/\.xlsx?$/i.test(f.name)) { setReadError('This is an Excel file. In Excel choose File, Save As, then “CSV UTF-8 (Comma delimited)”, and upload that file.'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const all = parseCSV(String(reader.result ?? ''))
      if (all.length < 2) { setReadError('The file has no data rows. The first row must be the column headings.'); return }
      setFileName(f.name); setHeaders(all[0]); setRows(all.slice(1)); setMapping(autoMap(all[0]))
    }
    reader.onerror = () => setReadError('Could not read that file.')
    reader.readAsText(f, 'utf-8')
  }

  const run = async () => {
    setBusy(true)
    try { setResult(await importAccounts(ready.map(p => p.data!))) }
    catch (e) { setResult({ added: 0, failed: ready.length, error: e instanceof Error ? e.message : 'Import failed' }) }
    setBusy(false)
  }

  const template = () => downloadFile('pg-accounts-import-template.csv', '﻿' + TEMPLATE_HEADERS.join(',') + '\r\n', 'text/csv;charset=utf-8')
  const mappedName = mapping.name >= 0

  return (
    <>
      <Link to="/accounts" className="text-sm text-navy-600 hover:underline inline-flex items-center gap-1 mb-2"><ArrowLeft size={14} /> Account Directory</Link>
      <PageHeader title="Import Accounts" subtitle="Load many businesses at once from a CSV file"
        actions={<button className="btn-secondary" onClick={template}><Download size={16} /> Download template</button>} />

      {result && (
        <div className={`card p-4 mb-4 ${result.error ? 'border-red-300' : 'border-emerald-300'}`}>
          {result.error
            ? <><div className="font-semibold text-red-700">Import stopped: {result.error}</div>
              <div className="text-sm text-slate-600 mt-1">{result.added} account(s) were saved before the error. Fix the problem and import again: rows already saved are skipped as duplicates.</div></>
            : <><div className="font-semibold text-emerald-700">{result.added} accounts imported.</div>
              <Link className="btn-primary mt-3" to="/accounts">View Account Directory</Link></>}
        </div>
      )}

      {!rows.length ? (
        <div className="card p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-navy-900">1. Prepare your file</h3>
            <ul className="text-sm text-slate-600 list-disc pl-5 mt-1 space-y-1">
              <li>Put one business per row, with column headings in the first row. Only <strong>Business Name</strong> is required.</li>
              <li>In Excel, save as <strong>CSV UTF-8 (Comma delimited)</strong>. Plain “CSV” can garble names like Hagåtña.</li>
              <li>Useful columns: Account Type (Retail, Foodservice, Hotel, Institutional), Business Segment (for example Bar, Korean Restaurant, Supermarket), Village, Sales Rep, Priority (A+, A, B, C).</li>
              <li>Your own column names are fine. The next step matches them for you and lets you correct any it misses.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-navy-900 mb-2">2. Choose the file</h3>
            <label className="btn-primary cursor-pointer"><Upload size={16} /> Choose CSV file
              <input id="import-file" type="file" accept=".csv,text/csv,.txt" className="hidden" onChange={onFile} /></label>
            {readError && <div className="mt-3 text-sm rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2">{readError}</div>}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div><span className="font-semibold text-navy-900">{fileName}</span> <span className="text-sm text-slate-500">· {rows.length} rows</span></div>
              <button className="btn-secondary" onClick={() => { setRows([]); setHeaders([]); setFileName(''); setResult(null) }}>Choose a different file</button>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="font-semibold text-navy-900 mb-1">Match your columns</h3>
            <p className="text-xs text-slate-500 mb-3">Each field is matched to a column from your file. Change any that look wrong, or pick “not in my file”.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {FIELDS.map(f => (
                <Field key={f.key} label={f.label + (f.required ? ' *' : '')}>
                  <select className="input" value={mapping[f.key] ?? -1} onChange={e => setMapping(m => ({ ...m, [f.key]: Number(e.target.value) }))}>
                    <option value={-1}>— not in my file —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `(column ${i + 1})`}</option>)}
                  </select>
                </Field>
              ))}
            </div>
            {!mappedName && <div className="mt-3 text-sm text-red-700">Choose the column that holds the business name.</div>}
          </div>

          <div className="card p-4">
            <h3 className="font-semibold text-navy-900 mb-3">Defaults for blank or unrecognised values</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Account type"><select className="input" value={defaultType} onChange={e => setDefaultType(e.target.value as AccountType)}>{ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Status"><select className="input" value={defaultStatus} onChange={e => setDefaultStatus(e.target.value as AccountStatus)}>{STATUSES.map(t => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Sales rep"><select className="input" value={defaultRepId} onChange={e => setDefaultRepId(e.target.value)}><option value="">Leave unassigned</option>{reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="font-semibold text-navy-900 mb-3">Check before importing</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge tone="Active">{ready.length} ready to import</Badge>
              <Badge tone="On Hold">{warned.length} with adjustments</Badge>
              <Badge tone="Inactive">{dupes.length} duplicates (skipped)</Badge>
              <Badge tone="Lost">{bad.length} with errors (skipped)</Badge>
            </div>
            {bad.length > 0 && (
              <details className="mb-2" open={bad.length < 8}><summary className="text-sm cursor-pointer font-medium text-red-700">Rows with errors</summary>
                <ul className="text-xs text-slate-600 mt-1 space-y-0.5 max-h-40 overflow-y-auto">{bad.slice(0, 100).map(p => <li key={p.line}>Line {p.line}: {p.errors.join('; ')}</li>)}</ul></details>
            )}
            {dupes.length > 0 && (
              <details className="mb-2"><summary className="text-sm cursor-pointer font-medium text-slate-700">Duplicates (same name, village and address as an existing or earlier row)</summary>
                <ul className="text-xs text-slate-600 mt-1 space-y-0.5 max-h-40 overflow-y-auto">{dupes.slice(0, 100).map(p => <li key={p.line}>Line {p.line}: {rows[p.line - 2]?.[mapping.name]}</li>)}</ul></details>
            )}
            {warned.length > 0 && (
              <details className="mb-2"><summary className="text-sm cursor-pointer font-medium text-amber-800">Adjustments made (these rows still import)</summary>
                <ul className="text-xs text-slate-600 mt-1 space-y-0.5 max-h-40 overflow-y-auto">{warned.slice(0, 150).map(p => <li key={p.line}>Line {p.line} {p.data?.name}: {p.warnings.join('; ')}</li>)}</ul></details>
            )}

            <div className="overflow-x-auto mt-3 border border-slate-200 rounded-lg">
              <table className="w-full min-w-[700px]"><thead><tr><th className="th">Business</th><th className="th">Type</th><th className="th">Segment</th><th className="th">Village</th><th className="th">Rep</th><th className="th">Priority</th><th className="th">Status</th></tr></thead>
                <tbody>{ready.slice(0, 8).map(p => (
                  <tr key={p.line}><td className="td">{p.data!.name}</td><td className="td">{p.data!.type}</td><td className="td">{p.data!.segment}</td><td className="td">{p.data!.village}</td>
                    <td className="td">{profiles.find(x => x.id === p.data!.repId)?.name ?? <span className="text-slate-400">Unassigned</span>}</td><td className="td">{p.data!.priority}</td><td className="td">{p.data!.status}</td></tr>
                ))}</tbody></table>
            </div>
            <p className="text-xs text-slate-500 mt-1">Showing the first {Math.min(8, ready.length)} of {ready.length} rows to import.</p>

            <div className="flex justify-end mt-4">
              <button className="btn-primary" disabled={busy || !mappedName || ready.length === 0 || !!result && !result.error} onClick={run}>
                {busy ? 'Importing…' : `Import ${ready.length} accounts`}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
