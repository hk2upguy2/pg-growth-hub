import { createClient } from '@supabase/supabase-js'
import type { Account, Order } from '../src/types'
import type { InvoiceLink } from '../src/lib/invoices'
import { sageKey } from '../src/lib/sales'
import type { Balance, Db, SyncStatus } from './core'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const orderFrom = (r: Row): Order => ({ id: r.id, orderNo: r.order_no, accountId: r.account_id, repId: r.rep_id, status: r.status, deliveryDate: r.delivery_date ?? '', notes: r.notes ?? '', lines: r.lines ?? [], total: Number(r.total ?? 0), quoteId: r.quote_id ?? null, createdAt: r.created_at, editedAt: r.edited_at ?? null, sageExportedAt: r.sage_exported_at ?? null, statusChangedAt: r.status_changed_at ?? null, invoiceNo: r.invoice_no ?? null, invoicedAt: r.invoiced_at ?? null, invoiceTotal: r.invoice_total == null ? null : Number(r.invoice_total), sageOrderNo: r.sage_order_no ?? null })
const accountFrom = (r: Row) => ({ id: r.id, name: r.name, sageNo: r.sage_customer_no ?? '', address: r.address ?? '' }) as unknown as Account

/** Uses the Supabase SERVICE ROLE key, which bypasses row-level security. It lives only on the Sage server, never in the app. */
export function supabaseDb(url: string, serviceKey: string): Db {
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } })
  const ok = (e: { message: string } | null, what: string) => { if (e) throw new Error(`${what}: ${e.message}`) }
  return {
    async unsent() {
      const o = await sb.from('orders').select('*').eq('status', 'Confirmed').is('sage_exported_at', null).order('created_at')
      ok(o.error, 'read orders')
      const orders = (o.data ?? []).map(orderFrom)
      if (!orders.length) return { orders, accounts: [], repNames: {} }
      const a = await sb.from('accounts').select('id,name,sage_customer_no,address').in('id', [...new Set(orders.map(x => x.accountId))]); ok(a.error, 'read customers')
      const p = await sb.from('profiles').select('id,full_name').in('id', [...new Set(orders.map(x => x.repId))]); ok(p.error, 'read reps')
      return { orders, accounts: (a.data ?? []).map(accountFrom), repNames: Object.fromEntries((p.data ?? []).map((x: Row) => [x.id, x.full_name])) }
    },
    async markSent(ids) { const r = await sb.from('orders').update({ sage_exported_at: new Date().toISOString() }).in('id', ids); ok(r.error, 'mark orders sent') },
    async everything() {
      const o = await sb.from('orders').select('*').gte('created_at', new Date(Date.now() - 120 * 86400000).toISOString()); ok(o.error, 'read orders')
      const a = await sb.from('accounts').select('id,name,sage_customer_no,address'); ok(a.error, 'read customers')
      return { orders: (o.data ?? []).map(orderFrom), accounts: (a.data ?? []).map(accountFrom) }
    },
    async applyInvoices(links: InvoiceLink[]) {
      for (const l of links) { const r = await sb.from('orders').update({ invoice_no: l.invoiceNo, invoiced_at: l.invoicedAt, invoice_total: l.invoiceTotal, sage_order_no: l.sageOrderNo }).eq('id', l.orderId); ok(r.error, `save invoice for ${l.orderNo}`) }
    },
    async applyBalances(rows: Balance[]) {
      const a = await sb.from('accounts').select('id,sage_customer_no').not('sage_customer_no', 'is', null); ok(a.error, 'read customers')
      const byKey = new Map((a.data ?? []).map((x: Row) => [sageKey(x.sage_customer_no), x.id as string]))
      const today = new Date().toISOString().slice(0, 10); let n = 0
      for (const b of rows) {
        const id = byKey.get(sageKey(b.sageNo)); if (!id) continue
        const r = await sb.from('accounts').update({ balance_due: b.balance, overdue_balance: b.overdue, balance_updated: today }).eq('id', id); ok(r.error, `save balance ${b.sageNo}`); n++
      }
      return n
    },
    async report(s: SyncStatus) {
      const r = await sb.from('sage_sync').upsert({ id: 1, last_run: new Date().toISOString(), ok: s.ok, message: s.message.slice(0, 1500), orders_sent: s.ordersSent, orders_skipped: s.ordersSkipped, invoices_matched: s.invoicesMatched, balances_updated: s.balancesUpdated }); ok(r.error, 'write status')
    },
  }
}
