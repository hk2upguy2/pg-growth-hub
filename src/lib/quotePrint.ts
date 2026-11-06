import { Account, Quote, lineTotal } from '../types'
import { fmtDate, money } from './utils'

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/** Opens a clean, printable quote. In the print dialog choose "Save as PDF" to send it to the customer. */
export function printQuote(q: Quote, account: Account | undefined, repName: string) {
  const rows = q.lines.map(l => `<tr><td>${esc(l.product)}<div class="s">${esc(l.brand)}${l.sku ? ' · ' + esc(l.sku) : ''}</div></td><td class="r">${l.qty} ${esc(l.unit)}</td><td class="r">${money(l.price)}</td><td class="r">${l.discountPct ? l.discountPct + '%' : ''}</td><td class="r">${money(lineTotal(l))}</td></tr>`).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Quote ${esc(q.quoteNo)}</title><style>
    body{font:14px/1.4 system-ui,Arial,sans-serif;color:#1e293b;margin:40px;max-width:760px}h1{margin:0;font-size:22px;color:#14305c}.s{font-size:11px;color:#64748b}
    table{width:100%;border-collapse:collapse;margin-top:18px}th{text-align:left;font-size:12px;color:#64748b;border-bottom:2px solid #cbd5e1;padding:6px}td{padding:8px 6px;border-bottom:1px solid #e2e8f0;vertical-align:top}.r{text-align:right}
    .tot td{font-weight:700;font-size:16px;border-bottom:0}.meta{display:flex;justify-content:space-between;margin-top:16px;gap:20px}.foot{margin-top:30px;font-size:12px;color:#64748b}
    @media print{body{margin:16mm}}</style></head><body>
    <h1>Pacific Grocers</h1><div class="s">Barrigada, Guam</div>
    <div class="meta"><div><strong>Quotation ${esc(q.quoteNo)}</strong><br>Date: ${fmtDate(q.createdAt)}<br>${q.validUntil ? 'Valid until: ' + fmtDate(q.validUntil) : ''}</div>
    <div><strong>${esc(account?.name ?? '')}</strong><br>${esc(account?.contactName ?? '')}<br>${esc(account?.address ?? '')}<br>Prepared by ${esc(repName)}</div></div>
    <table><thead><tr><th>Product</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Disc.</th><th class="r">Total</th></tr></thead><tbody>${rows}
    <tr class="tot"><td colspan="4" class="r">Total</td><td class="r">${money(q.total)}</td></tr></tbody></table>
    ${q.notes ? `<p><strong>Notes:</strong> ${esc(q.notes)}</p>` : ''}
    <div class="foot">Prices in US dollars. Subject to availability. Thank you for your business.</div>
    <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script></body></html>`
  const w = window.open('', '_blank')
  if (!w) { alert('Allow pop-ups for this site to print the quote.'); return }
  w.document.write(html); w.document.close()
}
