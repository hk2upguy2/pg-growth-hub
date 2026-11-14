import type { Account, Order } from '../src/types'
import { buildSageExport } from '../src/lib/sageExport'
import { matchInvoices, type InvoiceLink, type SageInvoice, type SageOpenOrder } from '../src/lib/invoices'
import { sageKey } from '../src/lib/sales'

/**
 * The Sage link: one cycle moves confirmed CRM orders OUT to Sage and brings Sage invoice numbers and customer balances IN.
 * Everything that touches the outside world (Supabase, Sage, the file system) is passed in, so the logic can be tested without them.
 */
export interface Balance { sageNo: string; balance: number; overdue: number }
export interface SyncStatus { ok: boolean; message: string; ordersSent: number; ordersSkipped: number; invoicesMatched: number; balancesUpdated: number }

export interface Db {
  /** confirmed orders not yet sent to Sage, with their customers and rep names */
  unsent(): Promise<{ orders: Order[]; accounts: Account[]; repNames: Record<string, string> }>
  markSent(ids: string[]): Promise<void>
  /** every order and customer, for matching Sage invoices */
  everything(): Promise<{ orders: Order[]; accounts: Account[] }>
  applyInvoices(links: InvoiceLink[]): Promise<void>
  applyBalances(rows: Balance[]): Promise<number>
  report(s: SyncStatus): Promise<void>
}
/** null means "this source has nothing new / is not configured" (not an error) */
export interface SageSource { invoices(): Promise<SageInvoice[] | null>; openOrders(): Promise<SageOpenOrder[] | null>; balances(): Promise<Balance[] | null> }
export interface Out { writeOrders(fileName: string, csv: string): Promise<void> }
export interface Deps { db: Db; source: SageSource; out: Out; log: (m: string) => void; now?: () => Date; dryRun?: boolean; /** CRM rep name -> Sage salesperson code */ salesCodes?: Record<string, string>; warehouse?: string }

const cell = (v: unknown) => { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
export const toCsv = (rows: Record<string, unknown>[]) => rows.length ? [Object.keys(rows[0]).join(','), ...rows.map(r => Object.values(r).map(cell).join(','))].join('\r\n') + '\r\n' : ''

export async function runCycle(d: Deps): Promise<SyncStatus> {
  const st: SyncStatus = { ok: true, message: '', ordersSent: 0, ordersSkipped: 0, invoicesMatched: 0, balancesUpdated: 0 }
  const notes: string[] = []
  const fail = (what: string, e: unknown) => { st.ok = false; const m = `${what}: ${e instanceof Error ? e.message : String(e)}`; notes.push(m); d.log('ERROR ' + m) }
  const stamp = (d.now?.() ?? new Date()).toISOString().slice(0, 19).replace(/\D/g, '')

  // 1) CRM -> Sage: confirmed orders become a Visual Integrator file
  try {
    const { orders, accounts, repNames } = await d.db.unsent()
    if (orders.length) {
      const code = (id: string) => { const n = repNames[id] ?? ''; return d.salesCodes?.[n] ?? n }
      const r = buildSageExport(orders, accounts, code, d.warehouse)
      st.ordersSkipped = r.skipped.length
      r.skipped.forEach(x => { d.log(`skipped ${x.order.orderNo}: ${x.reason}`); notes.push(`${x.order.orderNo} not sent: ${x.reason}`) })
      if (r.rows.length && !d.dryRun) {
        await d.out.writeOrders(`pg-orders-${stamp}.csv`, toCsv(r.rows as unknown as Record<string, unknown>[]))
        await d.db.markSent(r.exported.map(o => o.id))   // only after the file is safely written
      }
      st.ordersSent = d.dryRun ? 0 : r.exported.length
      d.log(`${d.dryRun ? '[dry run] would send' : 'sent'} ${r.exported.length} order(s), ${r.rows.length} line(s)`)
    }
  } catch (e) { fail('sending orders to Sage', e) }

  // 2) Sage -> CRM: invoice numbers, dates and totals
  try {
    const [inv, open] = [await d.source.invoices(), await d.source.openOrders()]
    if (inv || open) {
      const { orders, accounts } = await d.db.everything()
      const m = matchInvoices(inv ?? [], open ?? [], orders, accounts)
      m.mismatched.forEach(x => notes.push(`${x.orderNo}: ${x.reason}`))
      if (m.links.length && !d.dryRun) await d.db.applyInvoices(m.links)
      st.invoicesMatched = d.dryRun ? 0 : m.links.length
      d.log(`${d.dryRun ? '[dry run] would match' : 'matched'} ${m.links.length} invoice link(s); ${m.sageOnly} Sage-only, ${m.mismatched.length} wrong customer`)
    }
  } catch (e) { fail('reading Sage invoices', e) }

  // 3) Sage -> CRM: customer balances
  try {
    const bal = await d.source.balances()
    if (bal) {
      const clean = bal.filter(b => sageKey(b.sageNo))
      if (!d.dryRun) st.balancesUpdated = await d.db.applyBalances(clean)
      d.log(`${d.dryRun ? '[dry run] would update' : 'updated'} balances (${clean.length} in Sage)`)
    }
  } catch (e) { fail('reading Sage balances', e) }

  st.message = notes.slice(0, 20).join(' | ')
  if (!d.dryRun) { try { await d.db.report(st) } catch (e) { d.log('could not write the status line: ' + (e instanceof Error ? e.message : e)) } }
  return st
}
