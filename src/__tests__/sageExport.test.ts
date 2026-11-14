import { describe, it, expect } from 'vitest'
import { buildSageExport, SAGE_COLUMNS } from '../lib/sageExport'
import { orderUpdatesFor } from '../lib/notifications'
import { buildSeed } from '../lib/seed'
import type { Account, Order } from '../types'

const acct = (o: Partial<Account> = {}): Account => ({ ...buildSeed().accounts[0], id: 'a1', name: 'O S 7 MART', sageNo: '01-0010645', ...o })
const order = (o: Partial<Order> = {}): Order => ({ id: 'o1', orderNo: 'SO-1', accountId: 'a1', repId: 'r1', status: 'Confirmed', deliveryDate: '2026-08-22', notes: 'back door', total: 0, createdAt: '2026-08-21T08:00:00', lines: [
  { brand: 'Hostess', product: 'HOHO 6/3oz', sku: 'CH1015920', unit: 'Box', qty: 2, price: 10, discountPct: 10 },
  { brand: 'Hostess', product: 'DONETTES 10/3oz', sku: 'CH1047060', unit: 'Box', qty: 1, price: 20, discountPct: 0 }], ...o })
const rep = () => 'Rep One'

describe('Sage order export', () => {
  it('writes one row per order line with the header repeated and the net price', () => {
    const r = buildSageExport([order()], [acct()], rep)
    expect(r.rows).toHaveLength(2); expect(r.exported).toHaveLength(1); expect(r.skipped).toHaveLength(0)
    expect(r.rows[0]).toMatchObject({ SalesOrderNo: 'SO-1', CustomerNo: '01-0010645', OrderDate: '08/21/2026', ShipExpireDate: '08/22/2026', WarehouseCode: '000', LineNo: 1, ItemCode: 'CH1015920', UnitOfMeasure: 'BOX', QuantityOrdered: 2, ListPrice: 10, DiscountPercent: 10, UnitPrice: 9, SalesPerson: 'Rep One', Comment: 'back door' })
    expect(r.rows[1]).toMatchObject({ SalesOrderNo: 'SO-1', LineNo: 2, UnitPrice: 20 })
    expect(Object.keys(r.rows[0])).toEqual([...SAGE_COLUMNS])
  })
  it('skips (and says why) an order whose customer has no Sage number', () => {
    const r = buildSageExport([order()], [acct({ sageNo: '' })], rep)
    expect(r.rows).toHaveLength(0); expect(r.skipped[0].reason).toMatch(/no Sage customer number/)
  })
  it('skips an order with a line that has no item code, but still exports the good ones', () => {
    const bad = order({ id: 'o2', orderNo: 'SO-2', lines: [{ brand: 'Hostess', product: 'Mystery', sku: '', unit: 'Box', qty: 1, price: 1, discountPct: 0 }] })
    const r = buildSageExport([order(), bad], [acct()], rep)
    expect(r.exported.map(o => o.orderNo)).toEqual(['SO-1']); expect(r.skipped[0].reason).toMatch(/Mystery.*no item code/)
  })
})

describe('telling reps about order updates', () => {
  const now = new Date('2026-08-25T00:00:00').getTime()
  const o = (x: Partial<Order>) => order({ statusChangedAt: '2026-08-24T10:00:00', ...x })
  it('lists confirmed, delivered and cancelled orders of that rep that they have not seen', () => {
    const list = [o({ id: 'a', status: 'Confirmed' }), o({ id: 'b', status: 'Delivered' }), o({ id: 'c', status: 'Cancelled' })]
    expect(orderUpdatesFor('r1', list, new Set(), now).map(x => x.id)).toEqual(['a', 'b', 'c'])
  })
  it('ignores Submitted orders, other reps, seen updates and old news', () => {
    expect(orderUpdatesFor('r1', [o({ id: 'a', status: 'Submitted' })], new Set(), now)).toHaveLength(0)
    expect(orderUpdatesFor('r1', [o({ id: 'a', repId: 'r2' })], new Set(), now)).toHaveLength(0)
    expect(orderUpdatesFor('r1', [o({ id: 'a' })], new Set(['a|Confirmed']), now)).toHaveLength(0)
    expect(orderUpdatesFor('r1', [o({ id: 'a', statusChangedAt: '2026-07-01T00:00:00' })], new Set(), now)).toHaveLength(0)
    expect(orderUpdatesFor('r1', [o({ id: 'a', statusChangedAt: null })], new Set(), now)).toHaveLength(0)
  })
  it('a new status on an order is news again (Confirmed seen, now Delivered)', () => {
    expect(orderUpdatesFor('r1', [o({ id: 'a', status: 'Delivered' })], new Set(['a|Confirmed']), now)).toHaveLength(1)
  })
})
