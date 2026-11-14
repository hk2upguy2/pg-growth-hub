// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { runCycle, toCsv, type Db, type SageSource } from '../../bridge/core'
import { buildSeed } from '../lib/seed'
import type { Order } from '../types'

const acct = { ...buildSeed().accounts[0], id: 'a1', name: 'O S 7 MART', sageNo: '01-0010645' }
const order = (o: Partial<Order> = {}): Order => ({ id: 'o1', orderNo: 'SO-1', accountId: 'a1', repId: 'r1', status: 'Confirmed', deliveryDate: '2026-11-15', notes: '', total: 18, createdAt: '2026-11-14T01:00:00Z',
  lines: [{ brand: 'Hostess', product: 'HOHO', sku: 'CH1', unit: 'Box', qty: 2, price: 10, discountPct: 10 }], ...o })

function fakes(opts: { orders?: Order[]; accounts?: typeof acct[]; source?: Partial<SageSource>; failMark?: boolean } = {}) {
  const log: string[] = [], files: Record<string, string> = {}, marked: string[] = [], applied: unknown[] = [], balances: unknown[] = []; let status: unknown
  const orders = opts.orders ?? [order()]
  const db: Db = {
    unsent: async () => ({ orders: orders.filter(o => o.status === 'Confirmed' && !o.sageExportedAt), accounts: opts.accounts ?? [acct], repNames: { r1: 'Rep One' } }),
    markSent: async ids => { if (opts.failMark) throw new Error('db down'); marked.push(...ids) },
    everything: async () => ({ orders, accounts: opts.accounts ?? [acct] }),
    applyInvoices: async l => { applied.push(...l) },
    applyBalances: async r => { balances.push(...r); return r.length },
    report: async s => { status = s },
  }
  const source: SageSource = { invoices: async () => null, openOrders: async () => null, balances: async () => null, ...opts.source }
  return { db, source, out: { writeOrders: async (n: string, c: string) => { files[n] = c } }, log: (m: string) => log.push(m), logs: log, files, marked, applied, balances, status: () => status }
}

describe('Sage link cycle', () => {
  it('writes confirmed orders as a file with the Sage customer number and marks them sent', async () => {
    const f = fakes(); const s = await runCycle({ ...f, now: () => new Date('2026-11-14T02:03:04Z'), salesCodes: { 'Rep One': '0010' } })
    expect(Object.keys(f.files)).toEqual(['pg-orders-20261114020304.csv'])
    const csv = Object.values(f.files)[0]
    expect(csv.split('\r\n')[0]).toMatch(/^SalesOrderNo,OrderDate/); expect(csv).toContain('01-0010645'); expect(csv).toContain(',0010,')
    expect(f.marked).toEqual(['o1']); expect(s).toMatchObject({ ok: true, ordersSent: 1 }); expect(f.status()).toMatchObject({ ok: true })
  })
  it('does not mark orders as sent if writing the file failed (they are retried next cycle)', async () => {
    const f = fakes(); f.out.writeOrders = async () => { throw new Error('disk full') }
    const s = await runCycle(f); expect(f.marked).toEqual([]); expect(s.ok).toBe(false); expect(s.message).toMatch(/disk full/)
  })
  it('reports orders it cannot send, and still sends the others', async () => {
    const f = fakes({ orders: [order(), order({ id: 'o2', orderNo: 'SO-2', accountId: 'a2' })], accounts: [acct, { ...acct, id: 'a2', name: 'No Number', sageNo: '' }] })
    const s = await runCycle(f); expect(f.marked).toEqual(['o1']); expect(s.ordersSkipped).toBe(1); expect(s.message).toMatch(/SO-2 not sent: No Number has no Sage customer number/)
  })
  it('attaches Sage invoice numbers and updates balances', async () => {
    const f = fakes({ orders: [order({ sageExportedAt: '2026-11-14T03:00:00Z' })], source: {
      invoices: async () => [{ invoiceNo: '0859300', date: '2026-11-15', customerNo: '01-0010645', total: 18, po: 'SO-1' }],
      openOrders: async () => [{ sageOrderNo: '0866999', po: 'SO-1', invoiceNo: '', customer: 'X' }],
      balances: async () => [{ sageNo: '01-0010645', balance: 500, overdue: 100 }, { sageNo: '', balance: 1, overdue: 0 }] } })
    const s = await runCycle(f)
    expect(f.applied).toEqual([{ orderId: 'o1', orderNo: 'SO-1', invoiceNo: '0859300', invoicedAt: '2026-11-15', invoiceTotal: 18, sageOrderNo: '0866999' }])
    expect(f.balances).toHaveLength(1); expect(s).toMatchObject({ ok: true, invoicesMatched: 1, balancesUpdated: 1 })
  })
  it('a Sage read failure does not stop orders going out, and is reported', async () => {
    const f = fakes({ source: { invoices: async () => { throw new Error('ODBC login failed') } } })
    const s = await runCycle(f); expect(f.marked).toEqual(['o1']); expect(s.ok).toBe(false); expect(s.message).toMatch(/ODBC login failed/)
  })
  it('dry run changes nothing', async () => {
    const f = fakes(); const s = await runCycle({ ...f, dryRun: true })
    expect(f.files).toEqual({}); expect(f.marked).toEqual([]); expect(f.status()).toBeUndefined(); expect(s.ordersSent).toBe(0)
  })
  it('quotes CSV fields with commas and quotes', () => { expect(toCsv([{ a: 'x,y', b: 'say "hi"' }])).toBe('a,b\r\n"x,y","say ""hi"""\r\n') })
})
