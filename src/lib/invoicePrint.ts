import type { Account, Order } from '../types'
import { lineTotal } from '../types'

/**
 * Customer invoice printed from a CRM order, one per page. Once Sage has invoiced the order (Sage invoice number loaded from the
 * Invoice Listing) it prints as INVOICE with that number. Before that it prints as PRO FORMA INVOICE, so two different
 * "invoices" for the same sale are never handed out. Guam has no sales tax line; tax is not added here.
 */
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const dmy = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso); return isNaN(+d) ? '' : `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}` }
const num = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const r2 = (n: number) => Math.round(n * 100) / 100

export interface InvoiceContext { accounts: Account[]; repName: (id: string) => string; company?: { name: string; address: string; phone?: string } }
const COMPANY = { name: 'Pacific Grocers', address: 'Barrigada, Guam', phone: '' }

export function invoiceHtml(orders: Order[], ctx: InvoiceContext): string {
  const co = ctx.company ?? COMPANY
  const pages = orders.map(o => {
    const a = ctx.accounts.find(x => x.id === o.accountId)
    const official = !!o.invoiceNo
    const rows = o.lines.map(l => `<tr><td>${esc(l.sku)}</td><td>${esc(l.product)}</td><td class="c">${esc(l.unit.toUpperCase())}</td><td class="n">${num(l.qty)}</td><td class="n">${num(l.price)}</td><td class="n">${l.discountPct ? num(l.discountPct) + '%' : ''}</td><td class="n">${num(r2(lineTotal(l)))}</td></tr>`).join('')
    const total = r2(o.lines.reduce((n, l) => n + lineTotal(l), 0))
    const differs = o.invoiceTotal != null && Math.abs(o.invoiceTotal - total) > 0.005
    return `<section class="inv">
      <div class="top"><div><div class="co">${esc(co.name)}</div><div>${esc(co.address)}${co.phone ? ' · ' + esc(co.phone) : ''}</div></div>
        <div class="ttl"><h1>${official ? 'INVOICE' : 'PRO FORMA INVOICE'}</h1><div class="no">${official ? 'Invoice No. <b>' + esc(o.invoiceNo) + '</b>' : 'Sage invoice number not assigned yet'}</div></div></div>
      <div class="meta">
        <div><b>Invoice date:</b> ${esc(dmy(o.invoicedAt || o.deliveryDate || o.createdAt))}</div>
        <div><b>Order No.:</b> ${esc(o.orderNo)}${o.sageOrderNo ? ` &nbsp;(Sage ${esc(o.sageOrderNo)})` : ''}</div>
        <div><b>Order date:</b> ${esc(dmy(o.createdAt))}</div>
        <div><b>Customer No.:</b> ${esc(a?.sageNo ?? '')}</div>
        <div><b>Salesperson:</b> ${esc(ctx.repName(o.repId))}</div>
        <div><b>Ship date:</b> ${esc(dmy(o.deliveryDate))}</div>
      </div>
      <div class="addr"><div><b>Bill To:</b><br>${esc(a?.name ?? '')}<br>${esc(a?.address ?? '')}</div><div><b>Ship To:</b><br>${esc(a?.name ?? '')}<br>${esc(a?.address ?? '')}</div></div>
      <table><thead><tr><th>Item code</th><th>Description</th><th class="c">Unit</th><th class="n">Qty</th><th class="n">Price</th><th class="n">Disc.</th><th class="n">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="tot"><div><span>Subtotal</span><span>$${num(total)}</span></div><div class="g"><span>Total due</span><span>$${num(total)}</span></div></div>
      ${differs ? `<div class="warn">Sage invoice total is $${num(o.invoiceTotal!)}; this order totals $${num(total)}. Check the difference before sending.</div>` : ''}
      ${o.notes ? `<div class="notes"><b>Notes:</b> ${esc(o.notes)}</div>` : ''}
      <div class="sign"><div>Received by (name / signature)</div><div>Date</div></div>
      ${official ? '' : '<div class="fine">Pro forma: for the customer\'s records until the Sage invoice is issued. Not a tax document.</div>'}
    </section>`
  }).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice${orders.length === 1 ? ' ' + esc(orders[0].invoiceNo || orders[0].orderNo) : 's'}</title>
<style>
  @page { size: letter; margin: 0.5in } * { box-sizing: border-box }
  body { font: 12px/1.4 Arial, Helvetica, sans-serif; color: #000; margin: 0 }
  .inv { page-break-after: always } .inv:last-child { page-break-after: auto }
  .top { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px }
  .co { font-size: 20px; font-weight: bold } .ttl { text-align: right } h1 { font-size: 22px; margin: 0 0 2px }
  .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3px 16px; margin-bottom: 10px }
  .addr { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 12px }
  table { width: 100%; border-collapse: collapse } th { text-align: left; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 5px 4px }
  td { padding: 4px; border-bottom: 1px solid #ccc; vertical-align: top } .n { text-align: right } .c { text-align: center }
  .tot { margin: 10px 0 0 auto; width: 240px } .tot div { display: flex; justify-content: space-between; padding: 3px 0 } .tot .g { border-top: 2px solid #000; font-weight: bold; font-size: 14px }
  .warn { margin-top: 10px; border: 2px solid #000; padding: 5px; font-weight: bold } .notes { margin-top: 10px }
  .sign { display: flex; gap: 30px; margin-top: 36px } .sign div { flex: 1; border-top: 1px solid #000; padding-top: 3px; font-size: 11px } .sign div:last-child { flex: .4 }
  .fine { margin-top: 14px; font-size: 10px; color: #444 }
  .bar { position: fixed; top: 0; left: 0; right: 0; background: #1f3a5f; color: #fff; padding: 8px 14px; font: 13px Arial } .bar button { margin-left: 10px; padding: 5px 12px; font-size: 13px }
  @media screen { body { padding: 52px 24px 24px; background: #e8ebef } .inv { background: #fff; max-width: 8.5in; margin: 0 auto 18px; padding: 0.5in; box-shadow: 0 1px 6px rgba(0,0,0,.2) } }
  @media print { .bar { display: none } }
</style></head><body>
<div class="bar">${orders.length} invoice${orders.length === 1 ? '' : 's'} <button onclick="window.print()">Print</button></div>
${pages}
<script>setTimeout(function(){ window.print() }, 400)</script>
</body></html>`
}

/** Opens the invoices in a new window and starts the print dialog. Returns false if the browser blocked the window. */
export function printInvoices(orders: Order[], ctx: InvoiceContext): boolean {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.open(); w.document.write(invoiceHtml(orders, ctx)); w.document.close()
  return true
}
