// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { readXlsx } from '../lib/xlsx'
import { matchInvoices, parseInvoiceListing, parseOpenOrders } from '../lib/invoices'
import { invoiceHtml } from '../lib/invoicePrint'
import { buildSeed } from '../lib/seed'
import type { Order } from '../types'

const xlsx = (sheetRows: string, shared: string[], dateStyle = true) => zipSync({
  'xl/sharedStrings.xml': strToU8(`<sst>${shared.map(s => `<si><t>${s}</t></si>`).join('')}</sst>`),
  'xl/styles.xml': strToU8(`<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="${dateStyle ? 14 : 0}"/></cellXfs></styleSheet>`),
  'xl/worksheets/sheet1.xml': strToU8(`<worksheet><sheetData>${sheetRows}</sheetData></worksheet>`),
})

describe('xlsx reader', () => {
  it('reads text, numbers and dates, and skips empty cells', () => {
    const rows = readXlsx(xlsx(
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="s"><v>2</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" s="1"><v>46339</v></c><c r="C2"><v>68.99</v></c></row>',
      ['Invoice', 'Inv Date', 'PO', '0859147']))
    expect(rows[0]).toEqual(['Invoice', 'Inv Date', '', 'PO'])
    expect(rows[1]).toEqual(['0859147', '2026-11-13', '68.99'])
  })
  it('says so for a file that is not Excel', () => { expect(() => readXlsx(new Uint8Array([1, 2, 3]))).toThrow(/Excel/) })
})

const rows = (...r: string[][]) => [['Invoice List'], ...r]
const order = (o: Partial<Order> & { id: string; orderNo: string }): Order => ({ accountId: 'a1', repId: 'u-rep1', status: 'Confirmed', deliveryDate: '2026-11-14', notes: '', lines: [{ id: 'l1', brand: 'Hostess', product: 'Party Wings', sku: 'HW1', unit: 'case', qty: 10, price: 25, discountPct: 10 } as never], total: 225, createdAt: '2026-11-13T01:00:00Z', ...o })

describe('matching Sage invoices to CRM orders', () => {
  const accts = [{ ...buildSeed().accounts[0], id: 'a1', sageNo: '01-0010645' }]
  const inv = parseInvoiceListing(rows(
    ['Invoice', 'Inv Date', 'Customer No', 'Bill To Name', 'Inv Total', 'SalespersonNo', 'ShipToName', 'CustomerPONo', 'Comment'],
    ['0859300', '2026-11-14', '01-0010645', 'X', '225', '0400', 'X', 'SO-261113-AB12', ''],
    ['0859301', '2026-11-14', '02-0011111', 'SUBWAY', '68.99', '0222', 'S', 'STANDING ORDER', ''],
    ['0859302', '2026-11-14', '99-9999999', 'OTHER', '10', '0400', 'O', 'SO-261113-ZZ99', ''],
  ))!
  const open = parseOpenOrders([['Order Number List'], ['Order No', 'Order Date', 'PO Number', 'CurrentInvoiceNo'], ['0866999', '', 'SO-261113-AB12', '']])!

  it('finds the headings and ignores the title row', () => { expect(inv).toHaveLength(3); expect(open[0].sageOrderNo).toBe('0866999'); expect(parseInvoiceListing([['nothing']])).toBeNull() })
  it('attaches invoice no, date, total and Sage order no on the CRM order number', () => {
    const m = matchInvoices(inv, open, [order({ id: 'o1', orderNo: 'SO-261113-AB12' })], accts)
    expect(m.links).toEqual([{ orderId: 'o1', orderNo: 'SO-261113-AB12', invoiceNo: '0859300', invoicedAt: '2026-11-14', invoiceTotal: 225, sageOrderNo: '0866999' }])
    expect(m.sageOnly).toBe(2)   // the standing order, and an invoice for an order this CRM does not hold
  })
  it('refuses an invoice for a different customer', () => {
    const m = matchInvoices(inv, [], [order({ id: 'o2', orderNo: 'SO-261113-ZZ99' })], accts)
    expect(m.links).toHaveLength(0); expect(m.mismatched[0].reason).toMatch(/99-9999999/)
  })
  it('does not rewrite orders that are already up to date', () => {
    const done = order({ id: 'o1', orderNo: 'SO-261113-AB12', invoiceNo: '0859300', invoicedAt: '2026-11-14', invoiceTotal: 225, sageOrderNo: '0866999' })
    const m = matchInvoices(inv, open, [done], accts); expect(m.links).toHaveLength(0); expect(m.unchanged).toBe(1)
  })
})

describe('invoice print', () => {
  const ctx = { accounts: [{ ...buildSeed().accounts[0], id: 'a1', name: 'O S 7 MART', sageNo: '01-0010645' }], repName: () => 'Rep One' }
  it('is a pro forma until Sage has issued a number, then the real invoice', () => {
    expect(invoiceHtml([order({ id: 'o1', orderNo: 'SO-1' })], ctx)).toContain('PRO FORMA INVOICE')
    const h = invoiceHtml([order({ id: 'o1', orderNo: 'SO-1', invoiceNo: '0859300', invoiceTotal: 225 })], ctx)
    expect(h).toContain('>INVOICE<'); expect(h).toContain('0859300'); expect(h).not.toContain('Check the difference')
  })
  it('shows the customer, Sage customer number, line amount and total, and warns if Sage disagrees', () => {
    const h = invoiceHtml([order({ id: 'o1', orderNo: 'SO-1', invoiceNo: '0859300', invoiceTotal: 230 })], ctx)
    expect(h).toContain('O S 7 MART'); expect(h).toContain('01-0010645'); expect(h).toContain('225.00'); expect(h).toContain('Check the difference')
  })
  it('escapes names so a customer name cannot inject markup', () => {
    const h = invoiceHtml([order({ id: 'o1', orderNo: 'SO-1', notes: '<script>x</script>' })], ctx)
    expect(h).not.toContain('<script>x'); expect(h).toContain('&lt;script&gt;')
  })
})
