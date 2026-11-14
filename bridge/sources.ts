import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parseCSV } from '../src/lib/importer'
import { parseInvoiceListing, parseOpenOrders } from '../src/lib/invoices'
import { parseAmount } from '../src/lib/sales'
import { readXlsx } from '../src/lib/xlsx'
import type { Balance, SageSource } from './core'

const ODBC = 'odbc'   // installed only on the Sage server (npm i odbc); a variable keeps it out of the type check and the app build
const iso = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 10))

/** Reads Sage's two listings when Sage (or a person) saves them as .xlsx/.csv into a folder. Needs no ODBC; handy to start with. */
export function folderSource(dir: string): SageSource {
  const newest = (re: RegExp) => readdirSync(dir).filter(f => re.test(f) && /\.(xlsx|csv)$/i.test(f)).map(f => ({ f, t: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t)[0]?.f
  const rows = (f?: string) => (f ? (/\.xlsx$/i.test(f) ? readXlsx(readFileSync(join(dir, f))) : parseCSV(readFileSync(join(dir, f), 'utf-8'))) : null)
  return {
    async invoices() { const r = rows(newest(/invoice/i)); return r ? parseInvoiceListing(r) : null },
    async openOrders() { const r = rows(newest(/open.*order|order.*list/i)); return r ? parseOpenOrders(r) : null },
    async balances() { return null },
  }
}

/** Reads Sage 100 directly through its read-only ODBC driver (needs `npm i odbc` on the Sage server). */
export function odbcSource(dsn: string, user: string, pass: string, q: { invoices: string; openOrders: string; balances: string }): SageSource {
  const since = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
  const query = async <T,>(sql: string): Promise<T[]> => {
    const odbc = (await import(ODBC)) as unknown as { connect: (s: string) => Promise<{ query: (s: string) => Promise<unknown[]>; close: () => Promise<void> }> }
    const c = await odbc.connect(`DSN=${dsn};UID=${user};PWD=${pass}`)
    try { return (await c.query(sql.replace('{SINCE}', since))) as T[] } finally { await c.close() }
  }
  const s = (v: unknown) => String(v ?? '').trim()
  return {
    async invoices() { return (await query<Record<string, unknown>>(q.invoices)).map(r => ({ invoiceNo: s(r.InvoiceNo), date: iso(r.InvoiceDate), customerNo: s(r.CustomerNo), po: s(r.PO), total: parseAmount(s(r.Total)) })) },
    async openOrders() { return (await query<Record<string, unknown>>(q.openOrders)).map(r => ({ sageOrderNo: s(r.SalesOrderNo), po: s(r.PO), invoiceNo: s(r.CurrentInvoiceNo), customer: s(r.BillToName) })) },
    async balances(): Promise<Balance[]> { return (await query<Record<string, unknown>>(q.balances)).map(r => ({ sageNo: s(r.CustomerNo), balance: parseAmount(s(r.Balance)) ?? 0, overdue: parseAmount(s(r.Overdue)) ?? 0 })) },
  }
}

/** Lists tables and columns so the queries can be checked against your Sage version. */
export async function discover(dsn: string, user: string, pass: string, like = /^(AR_Customer|AR_InvoiceHistoryHeader|SO_SalesOrderHeader|AR_OpenInvoice)$/i) {
  const odbc = (await import(ODBC)) as unknown as { connect: (s: string) => Promise<{ tables: (a: null, b: null, c: null, d: null) => Promise<{ TABLE_NAME: string }[]>; columns: (a: null, b: null, c: string, d: null) => Promise<{ COLUMN_NAME: string }[]>; close: () => Promise<void> }> }
  const c = await odbc.connect(`DSN=${dsn};UID=${user};PWD=${pass}`)
  try {
    const tables = (await c.tables(null, null, null, null)).map(t => t.TABLE_NAME).filter(n => like.test(n))
    for (const t of tables) console.log(`${t}: ${(await c.columns(null, null, t, null)).map(x => x.COLUMN_NAME).join(', ')}`)
    if (!tables.length) console.log('None of the expected tables were found. Check the DSN and the Sage user.')
  } finally { await c.close() }
}
