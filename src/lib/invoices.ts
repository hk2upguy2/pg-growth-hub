import type { Account, Order } from '../types'
import { parseAmount } from './sales'

/**
 * Ties Sage invoices back to CRM orders.
 * Our Sage export puts the CRM order number in the Customer PO field, so Sage's "Invoice Listing" (CustomerPONo) and its
 * "Open Sales Order Listing" (PO Number, with Sage's own Order No and CurrentInvoiceNo) can be matched to CRM orders exactly.
 */
export interface SageInvoice { invoiceNo: string; date: string; customerNo: string; total: number | null; po: string }
export interface SageOpenOrder { sageOrderNo: string; po: string; invoiceNo: string; customer: string }
export interface InvoiceLink { orderId: string; orderNo: string; invoiceNo: string | null; invoicedAt: string | null; invoiceTotal: number | null; sageOrderNo: string | null }

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
const headerRow = (rows: string[][], must: string[]) => rows.findIndex(r => must.every(m => r.some(c => norm(c) === m)))
const col = (hdr: string[], ...names: string[]) => hdr.findIndex(h => names.includes(norm(h)))
const key = (s: string) => s.trim().toUpperCase()

export function parseInvoiceListing(rows: string[][]): SageInvoice[] | null {
  const h = headerRow(rows, ['invoice', 'invdate'])
  if (h < 0) return null
  const hdr = rows[h]
  const c = { no: col(hdr, 'invoice', 'invoiceno'), date: col(hdr, 'invdate', 'invoicedate'), cust: col(hdr, 'customerno', 'customernumber'), total: col(hdr, 'invtotal', 'invoicetotal'), po: col(hdr, 'customerpono', 'ponumber', 'po') }
  return rows.slice(h + 1).filter(r => (r[c.no] ?? '').trim()).map(r => ({
    invoiceNo: r[c.no].trim(), date: (r[c.date] ?? '').trim().slice(0, 10), customerNo: c.cust >= 0 ? (r[c.cust] ?? '').trim() : '',
    total: c.total >= 0 ? parseAmount(r[c.total] ?? '') : null, po: c.po >= 0 ? (r[c.po] ?? '').trim() : '',
  }))
}

export function parseOpenOrders(rows: string[][]): SageOpenOrder[] | null {
  const h = headerRow(rows, ['orderno', 'currentinvoiceno'])
  if (h < 0) return null
  const hdr = rows[h]
  const c = { no: col(hdr, 'orderno'), po: col(hdr, 'ponumber', 'customerpono', 'po'), inv: col(hdr, 'currentinvoiceno'), cust: col(hdr, 'billtoname') }
  return rows.slice(h + 1).filter(r => (r[c.no] ?? '').trim()).map(r => ({
    sageOrderNo: r[c.no].trim(), po: c.po >= 0 ? (r[c.po] ?? '').trim() : '', invoiceNo: c.inv >= 0 ? (r[c.inv] ?? '').trim() : '', customer: c.cust >= 0 ? (r[c.cust] ?? '').trim() : '',
  }))
}

export interface InvoiceMatch {
  links: InvoiceLink[]
  /** matched, but the Sage customer on the invoice is not the order's customer: left alone */
  mismatched: { orderNo: string; invoiceNo: string; reason: string }[]
  /** Sage documents that were not created from a CRM order (walk-ins, standing orders, keyed in Sage): just counted */
  sageOnly: number
  /** invoices the CRM has already recorded with the same number and total */
  unchanged: number
}

export function matchInvoices(invoices: SageInvoice[], open: SageOpenOrder[], orders: Order[], accounts: Account[]): InvoiceMatch {
  const byNo = new Map(orders.map(o => [key(o.orderNo), o]))
  const acct = new Map(accounts.map(a => [a.id, a]))
  const draft = new Map<string, InvoiceLink>()
  const get = (o: Order) => draft.get(o.id) ?? { orderId: o.id, orderNo: o.orderNo, invoiceNo: o.invoiceNo ?? null, invoicedAt: o.invoicedAt ?? null, invoiceTotal: o.invoiceTotal ?? null, sageOrderNo: o.sageOrderNo ?? null }
  const mismatched: InvoiceMatch['mismatched'] = []
  let sageOnly = 0

  for (const s of open) {
    const o = byNo.get(key(s.po))
    if (!o) { sageOnly++; continue }
    const l = get(o); l.sageOrderNo = s.sageOrderNo; if (s.invoiceNo) l.invoiceNo = s.invoiceNo
    draft.set(o.id, l)
  }
  for (const s of invoices) {
    const o = byNo.get(key(s.po))
    if (!o) { sageOnly++; continue }
    const sage = acct.get(o.accountId)?.sageNo?.trim()
    if (sage && s.customerNo && key(sage).replace(/^0+/, '') !== key(s.customerNo).replace(/^0+/, '')) {
      mismatched.push({ orderNo: o.orderNo, invoiceNo: s.invoiceNo, reason: `Invoice is for customer ${s.customerNo}, the order is for ${sage}` }); continue
    }
    const l = get(o); l.invoiceNo = s.invoiceNo; l.invoicedAt = s.date || l.invoicedAt; l.invoiceTotal = s.total ?? l.invoiceTotal
    draft.set(o.id, l)
  }
  const links: InvoiceLink[] = []; let unchanged = 0
  for (const l of draft.values()) {
    const o = orders.find(x => x.id === l.orderId)!
    const same = (o.invoiceNo ?? null) === l.invoiceNo && (o.invoicedAt ?? null) === l.invoicedAt && (o.invoiceTotal ?? null) === l.invoiceTotal && (o.sageOrderNo ?? null) === l.sageOrderNo
    if (same) unchanged++; else links.push(l)
  }
  return { links, mismatched, sageOnly, unchanged }
}
