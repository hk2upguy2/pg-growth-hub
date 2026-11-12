// Integration tests: the real store, the real seed data and the real permission rules, in demo mode (no database).
import { describe, it, expect, beforeEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { StoreProvider, useStore } from '../lib/store'
import { ToastProvider } from '../components/ui'
import type { QuoteLine } from '../types'

type S = ReturnType<typeof useStore>
let ctx: { current: S }
function Probe() { ctx.current = useStore(); return null }

const mount = () => { ctx = { current: undefined as unknown as S }; render(<ToastProvider><StoreProvider><Probe /></StoreProvider></ToastProvider>) }
const as = (id: string) => act(() => { ctx.current.login(id) })
const line = (o: Partial<QuoteLine> = {}): QuoteLine => ({ brand: 'Agrosuper', product: 'Party Wings', sku: 'AG-PW', unit: 'case', qty: 2, price: 50, discountPct: 0, ...o })
const order = (accountId: string, lines = [line()]) => ({ accountId, deliveryDate: '2026-12-01', notes: '', lines })
const ok = <T,>(fn: () => T) => { let r!: T; act(() => { r = fn() }); return r }
const fails = (fn: () => unknown, msg?: RegExp) => { let err: unknown; act(() => { try { fn() } catch (e) { err = e } }); expect(err).toBeInstanceOf(Error); if (msg) expect((err as Error).message).toMatch(msg) }

beforeEach(() => { cleanup(); localStorage.clear(); mount() })

describe('who sees what', () => {
  it('a rep sees only their own accounts; management and customer service see all', () => {
    as('u-admin'); const all = ctx.current.accounts.length
    expect(all).toBeGreaterThan(10)
    as('u-service'); expect(ctx.current.accounts.length).toBe(all)
    as('u-rep1'); const mine = ctx.current.accounts.length
    expect(mine).toBeGreaterThan(0); expect(mine).toBeLessThan(all)
    expect(ctx.current.accounts.every(a => a.repId === 'u-rep1')).toBe(true)
  })
  it('a rep only sees their own orders', () => {
    as('u-rep1'); expect(ctx.current.orders.every(o => o.repId === 'u-rep1')).toBe(true)
    as('u-service'); expect(ctx.current.orders.length).toBeGreaterThanOrEqual(1)
  })
  it('the roles are exposed correctly', () => {
    as('u-admin'); expect(ctx.current.isAdmin).toBe(true)
    as('u-service'); expect(ctx.current.isService).toBe(true); expect(ctx.current.isAdmin).toBe(false)
    as('u-rep1'); expect(ctx.current.isAdmin || ctx.current.isService).toBe(false)
  })
})

describe('taking orders', () => {
  it('a rep can place an order on their own customer, and it shows up with the right total', () => {
    as('u-rep1'); const acct = ctx.current.accounts[0]
    const before = ctx.current.orders.length
    const o = ok(() => ctx.current.saveOrder(order(acct.id, [line({ qty: 3, price: 50, discountPct: 10 })])))
    expect(o.total).toBe(135); expect(o.status).toBe('Submitted'); expect(o.repId).toBe('u-rep1')
    expect(ctx.current.orders.length).toBe(before + 1)
  })
  it('an order must have at least one line and a quantity above zero', () => {
    as('u-rep1'); const acct = ctx.current.accounts[0]
    fails(() => ctx.current.saveOrder(order(acct.id, [])), /at least one/i)
    fails(() => ctx.current.saveOrder(order(acct.id, [line({ qty: 0 })])), /quantity/i)
  })
  it('a rep cannot discount above 10%; management can', () => {
    as('u-rep1'); const acct = ctx.current.accounts[0]
    fails(() => ctx.current.saveOrder(order(acct.id, [line({ discountPct: 11 })])), /10%/)
    as('u-admin'); ok(() => ctx.current.saveOrder(order(acct.id, [line({ discountPct: 15 })])))
  })
  it("a rep cannot order for another rep's customer", () => {
    as('u-rep1'); const others = ctx.current.accounts.filter(a => a.repId !== 'u-rep1')
    expect(others.length).toBe(0)   // reps are scoped: the other rep's customers are not even visible
    as('u-admin'); const theirs = ctx.current.accounts.find(a => a.repId && a.repId !== 'u-rep1')!
    as('u-rep1'); fails(() => ctx.current.saveOrder(order(theirs.id)))
  })
  it('a customer On Hold blocks reps but not management', () => {
    as('u-admin'); const acct = ctx.current.accounts.find(a => a.repId === 'u-rep1')!
    ok(() => ctx.current.saveAccount({ ...acct, status: 'On Hold' }))
    as('u-rep1'); fails(() => ctx.current.saveOrder(order(acct.id)), /on hold/i)
    as('u-admin'); ok(() => ctx.current.saveOrder(order(acct.id)))
  })
  it('only management can delete an order', () => {
    as('u-admin'); const id = ctx.current.orders[0].id
    as('u-rep1'); fails(() => ctx.current.deleteOrder(id))
    as('u-service'); fails(() => ctx.current.deleteOrder(id))
    as('u-admin'); ok(() => ctx.current.deleteOrder(id)); expect(ctx.current.orders.some(o => o.id === id)).toBe(false)
  })
})

describe('customer service', () => {
  it('cannot create an order', () => {
    as('u-service'); const acct = ctx.current.accounts[0]
    fails(() => ctx.current.saveOrder(order(acct.id)), /cannot create/i)
  })
  it('can move an order along and add notes, but cannot change the lines or total', () => {
    as('u-service'); const o = ctx.current.orders.find(x => x.status === 'Submitted')!
    const upd = ok(() => ctx.current.saveOrder({ ...order(o.accountId, [line({ qty: 999, price: 1 })]), id: o.id, status: 'Confirmed', notes: 'Short 2 cases' }))
    expect(upd.status).toBe('Confirmed'); expect(upd.notes).toBe('Short 2 cases')
    expect(upd.lines).toEqual(o.lines); expect(upd.total).toBe(o.total)
  })
  it('cannot edit customers or users', () => {
    as('u-service'); const a = ctx.current.accounts[0]
    fails(() => ctx.current.saveAccount({ ...a, name: 'Hacked' }))
  })
})

describe('sales channels and assignment', () => {
  it('management cannot give a Hotel customer to a Retail-only rep (it is skipped, not assigned)', () => {
    as('u-admin')
    const retailRep = ctx.current.profiles.find(p => p.role === 'rep' && p.channel === 'Retail')
    const hotel = ctx.current.accounts.find(a => a.type === 'Hotel')
    if (!retailRep || !hotel) return   // seed has no such pair: nothing to test
    const r = ok(() => ctx.current.assignAccounts([hotel.id], retailRep.id))
    expect(r.assigned).toBe(0); expect(r.skipped).toBe(1)
  })
  it('a rep cannot edit the credit limit or balances (management only)', () => {
    as('u-rep1'); const a = ctx.current.accounts[0]
    const saved = ok(() => ctx.current.saveAccount({ ...a, creditLimit: 999999, balanceDue: 1 }))
    expect(saved.creditLimit ?? 0).toBe(a.creditLimit ?? 0); expect(saved.balanceDue ?? 0).toBe(a.balanceDue ?? 0)
  })
})

describe('reps changing their own submitted order', () => {
  const place = () => { as('u-rep1'); const acct = ctx.current.accounts[0]; return ok(() => ctx.current.saveOrder(order(acct.id, [line({ qty: 2, price: 50 })]))) }
  it('a rep can change the lines of their own order while it is still Submitted, and the order is marked Edited', () => {
    const o = place(); expect(o.editedAt ?? null).toBeNull()
    const upd = ok(() => ctx.current.saveOrder({ ...order(o.accountId, [line({ qty: 5, price: 50 }), line({ product: 'Drummettes', sku: 'AG-DR', qty: 1, price: 40 })]), id: o.id, notes: 'add drummettes' }))
    expect(upd.orderNo).toBe(o.orderNo); expect(upd.total).toBe(290); expect(upd.lines).toHaveLength(2)
    expect(upd.status).toBe('Submitted'); expect(upd.editedAt).toBeTruthy()
    expect(ctx.current.orders.filter(x => x.id === o.id)).toHaveLength(1)
  })
  it('a rep cannot change it after customer service confirms it', () => {
    const o = place()
    as('u-service'); ok(() => ctx.current.saveOrder({ ...order(o.accountId), id: o.id, status: 'Confirmed', notes: '' }))
    as('u-rep1'); fails(() => ctx.current.saveOrder({ ...order(o.accountId, [line({ qty: 9 })]), id: o.id }), /already confirmed/i)
  })
  it('a rep cannot change the status or the customer, even on their own order', () => {
    const o = place()
    const upd = ok(() => ctx.current.saveOrder({ ...order(o.accountId, [line({ qty: 3 })]), id: o.id, status: 'Delivered' }))
    expect(upd.status).toBe('Submitted')
    as('u-admin'); const other = ctx.current.accounts.find(a => a.id !== o.accountId && a.repId === 'u-rep1')
    as('u-rep1'); if (other) fails(() => ctx.current.saveOrder({ ...order(other.id), id: o.id }), /customer cannot be changed/i)
  })
  it("a rep cannot change another rep's order", () => {
    as('u-admin'); const theirs = ctx.current.orders.find(x => x.repId !== 'u-rep1' && x.status === 'Submitted')
    if (!theirs) return
    as('u-rep1'); fails(() => ctx.current.saveOrder({ ...order(theirs.accountId), id: theirs.id }))
  })
  it('the 10% discount limit still applies when editing', () => {
    const o = place(); fails(() => ctx.current.saveOrder({ ...order(o.accountId, [line({ discountPct: 12 })]), id: o.id }), /10%/)
  })
})

describe('Sage export marker and status stamp', () => {
  it('only the office can mark orders as exported', () => {
    as('u-admin'); const id = ctx.current.orders[0].id
    as('u-rep1'); fails(() => ctx.current.markOrdersExported([id]), /office/i)
    as('u-service'); ok(() => ctx.current.markOrdersExported([id])); expect(ctx.current.orders.find(o => o.id === id)!.sageExportedAt).toBeTruthy()
  })
  it('confirming an order stamps when the status changed', () => {
    as('u-rep1'); const acct = ctx.current.accounts[0]; const o = ok(() => ctx.current.saveOrder(order(acct.id)))
    expect(o.statusChangedAt).toBeTruthy()
    as('u-service'); const c = ok(() => ctx.current.saveOrder({ ...order(acct.id), id: o.id, status: 'Confirmed', notes: '' }))
    expect(c.status).toBe('Confirmed'); expect(new Date(c.statusChangedAt!).getTime()).toBeGreaterThanOrEqual(new Date(o.statusChangedAt!).getTime())
  })
})
