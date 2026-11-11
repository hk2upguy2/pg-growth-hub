import type { Account, Order, StockItem } from '../types'

/**
 * Picking sheets laid out like the Sage 100 "Picking Sheet" report: header block, then one block per item
 * (item code, unit, ordered, shipped, quantity on hand, description, brand). One order per page.
 * It opens a clean print window, so nothing from the app's screen gets on the paper.
 * Fields the CRM does not hold (location, lot number, terms, UPC) are left blank for the warehouse to write in.
 */
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const dmy = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso); return isNaN(+d) ? '' : `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}` }
const num = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export interface SheetContext {
  accounts: Account[]
  stock: StockItem[]
  repName: (id: string) => string
  now?: Date
}

export function pickingSheetHtml(orders: Order[], ctx: SheetContext): string {
  const now = ctx.now ?? new Date()
  const printDate = dmy(now.toISOString().slice(0, 10)).replace(/^(\d+)\/(\d+)\/(\d+)$/, `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`)
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
  const stockOf = (sku: string, product: string) => ctx.stock.find(s => (s.sku && s.sku.toLowerCase() === sku.toLowerCase()) || s.product.toLowerCase() === product.toLowerCase())

  const sheets = orders.map(o => {
    const a = ctx.accounts.find(x => x.id === o.accountId)
    const name = a?.name ?? ''
    const items = o.lines.map(l => {
      const st = stockOf(l.sku, l.product)
      return `<div class="item">
        <div class="row main"><span class="loc"></span><span class="code">${esc(l.sku)}</span><span class="unit">${esc(l.unit.toUpperCase())}</span><span class="ord">${num(l.qty)}</span><span class="ship"><i></i></span><span class="qoh">${st ? `<u>${num(st.onHand)}</u>` : '<u>&nbsp;</u>'}</span></div>
        <div class="row desc"><span class="d">${esc(l.product)}</span><span class="lot">Lot Number: ________${st?.expiryDate ? ` &nbsp; Exp ${esc(dmy(st.expiryDate))}` : ''}</span></div>
        <div class="row brand"><span class="b">BRAND ${esc(l.brand.toUpperCase())}</span></div>
      </div>`
    }).join('')
    const units = o.lines.reduce((n, l) => n + l.qty, 0)
    return `<section class="sheet">
      <div class="page">Page: 1</div>
      <h1>Picking Sheet</h1>
      ${o.editedAt ? `<div class="rev">REVISED ORDER, changed ${esc(dmy(o.editedAt))}</div>` : ''}
      <div class="hdr">
        <div class="l">
          <p><b>Warehouse:</b> 000 &nbsp;&nbsp;&nbsp; MAIN WAREHOUSE</p>
          <p><b>Order Number:</b> ${esc(o.orderNo)}</p>
          <p><b>Customer Number:</b> ${esc(a?.accountNo ?? '')}</p>
        </div>
        <div class="r">
          <p><b>Order Date:</b> ${esc(dmy(o.createdAt))}</p>
          <p><b>Salesperson:</b> ${esc(ctx.repName(o.repId))}</p>
          <p><b>Created By:</b> ${esc(ctx.repName(o.repId))}</p>
        </div>
      </div>
      <div class="addr">
        <div><b>Sold To:</b><br>${esc(name)}<br>${esc(a?.address ?? '')}</div>
        <div><b>Ship To:</b><br>${esc(name)}<br>${esc(a?.address ?? '')}</div>
        <div class="pd"><b>Print Date:</b> ${esc(printDate)} &nbsp; <b>Time:</b> ${esc(time)}</div>
      </div>
      <div class="conf"><b>Confirm To:</b> ${esc(a?.contactName ?? '')} ${esc(a?.phone ?? '')}</div>
      <div class="terms">
        <div><b>Customer P.O.</b></div><div><b>Ship VIA</b></div><div><b>F. O. B.</b></div><div><b>Terms</b><br>&nbsp;</div><div><b>Ship Date</b><br>${esc(dmy(o.deliveryDate))}</div>
      </div>
      <div class="cols"><span class="loc"><b>Location</b></span><span class="code"><b>Item Code</b></span><span class="unit"><b>Unit</b></span><span class="ord"><b>Ordered</b></span><span class="ship"><b>Shipped</b></span><span class="qoh"><b>Quan on Hand</b></span></div>
      ${items}
      <div class="foot">${o.lines.length} line${o.lines.length === 1 ? '' : 's'} · ${num(units)} units${o.notes ? ` &nbsp;|&nbsp; <b>Notes:</b> ${esc(o.notes)}` : ''}</div>
    </section>`
  }).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>Picking Sheet${orders.length === 1 ? ' ' + esc(orders[0].orderNo) : 's'}</title>
<style>
  @page { size: letter; margin: 0.5in }
  * { box-sizing: border-box }
  body { font: 12px/1.35 Arial, Helvetica, sans-serif; color: #000; margin: 0 }
  .sheet { position: relative; page-break-after: always; padding-top: 4px }
  .sheet:last-child { page-break-after: auto }
  .page { position: absolute; right: 0; top: 0; font-weight: bold }
  h1 { text-align: center; font-size: 20px; margin: 14px 0 18px }
  .rev { text-align: center; font-weight: bold; margin: -10px 0 12px; border: 2px solid #000; padding: 3px; }
  .hdr { display: flex; justify-content: space-between; margin-bottom: 14px }
  .hdr p { margin: 3px 0 } .hdr .r { text-align: left; min-width: 250px }
  .addr { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 30px; margin-bottom: 8px }
  .addr .pd { grid-column: 2; text-align: right }
  .conf { margin-bottom: 10px }
  .terms { display: grid; grid-template-columns: 1.3fr 1fr 1fr 1fr 1fr; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 0; margin-bottom: 0 }
  .cols, .row.main { display: grid; grid-template-columns: 90px 160px 1fr 90px 130px 120px; align-items: end }
  .cols { border-bottom: 2px solid #000; padding: 5px 0 3px }
  .cols .ord, .row .ord, .cols .qoh, .row .qoh, .cols .ship, .row .ship { text-align: right }
  .item { padding: 7px 0 5px; break-inside: avoid }
  .row.main .code { font-size: 13px } .row .ship i { display: block; border-bottom: 1px solid #000; height: 14px; margin: 0 10px 0 20px }
  .row .qoh u { text-decoration: none; border-bottom: 1px solid #000; display: inline-block; min-width: 80px }
  .row.desc { display: flex; justify-content: space-between; padding-left: 90px; margin-top: 1px }
  .row.desc .lot { margin-right: 130px }
  .row.brand { padding-left: 90px; font-size: 14px; margin-top: 4px }
  .foot { border-top: 1px solid #000; margin-top: 10px; padding-top: 6px; font-size: 11px }
  .bar { position: fixed; top: 0; left: 0; right: 0; background: #1f3a5f; color: #fff; padding: 8px 14px; font: 13px Arial }
  .bar button { margin-left: 10px; padding: 5px 12px; font-size: 13px }
  @media screen { .page { right: 0.5in; top: 0.35in } body { padding: 52px 24px 24px; background: #e8ebef } .sheet { background: #fff; max-width: 8.5in; margin: 0 auto 18px; padding: 0.5in; box-shadow: 0 1px 6px rgba(0,0,0,.2) } }
  @media print { .bar { display: none } }
</style></head><body>
<div class="bar">${orders.length} picking sheet${orders.length === 1 ? '' : 's'} <button onclick="window.print()">Print</button></div>
${sheets}
<script>setTimeout(function(){ window.print() }, 400)</script>
</body></html>`
}

/** Opens the sheets in a new window and starts the print dialog. Returns false if the browser blocked the window. */
export function printPickingSheets(orders: Order[], ctx: SheetContext): boolean {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.open(); w.document.write(pickingSheetHtml(orders, ctx)); w.document.close()
  return true
}
