// The order that reaches Supabase must be an INSERT for a new order and an UPDATE for a changed one (never an upsert),
// because the row-level security rules for customer service and reps allow updates but not inserts.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const calls: { op: string; payload?: unknown; eq?: [string, string] }[] = []
let updateRows: { id: string }[] = [{ id: 'o1' }]
vi.mock('../lib/supabase', () => {
  const table = () => ({
    insert: (payload: unknown) => { calls.push({ op: 'insert', payload }); return Promise.resolve({ error: null }) },
    upsert: (payload: unknown) => { calls.push({ op: 'upsert', payload }); return Promise.resolve({ error: null }) },
    update: (payload: unknown) => { const c: { op: string; payload?: unknown; eq?: [string, string] } = { op: 'update', payload }; calls.push(c)
      return { eq: (k: string, v: string) => { c.eq = [k, v]; return { select: () => Promise.resolve({ data: updateRows, error: null }) } } } },
  })
  return { hasSupabase: true, supabase: { from: () => table() } }
})
import { remote } from '../lib/db'
import type { Order } from '../types'

const order: Order = { id: 'o1', orderNo: 'SO-1', accountId: 'a1', repId: 'r1', status: 'Confirmed', deliveryDate: '2026-12-01', notes: 'n', total: 10, createdAt: '', lines: [] }
beforeEach(() => { calls.length = 0; updateRows = [{ id: 'o1' }] })

describe('saving orders to Supabase', () => {
  it('a new order is an insert', async () => { await remote.saveOrder(order, 'new'); expect(calls.map(c => c.op)).toEqual(['insert']) })
  it('customer service sends an update of status and notes only', async () => {
    await remote.saveOrder(order, 'office')
    expect(calls).toEqual([{ op: 'update', payload: { status: 'Confirmed', notes: 'n' }, eq: ['id', 'o1'] }])
  })
  it('a rep edit is an update without the status', async () => {
    await remote.saveOrder(order, 'rep')
    expect(calls[0].op).toBe('update'); expect(calls[0].payload).not.toHaveProperty('status'); expect(calls[0].payload).toHaveProperty('lines')
  })
  it('management updates everything', async () => { await remote.saveOrder(order, 'admin'); expect(calls[0].payload).toMatchObject({ status: 'Confirmed', lines: [] }) })
  it('never uses an upsert', async () => { for (const s of ['new', 'office', 'rep', 'admin'] as const) await remote.saveOrder(order, s); expect(calls.some(c => c.op === 'upsert')).toBe(false) })
  it('says so when the security rules let zero rows through, instead of pretending it saved', async () => {
    updateRows = []; await expect(remote.saveOrder(order, 'office')).rejects.toThrow(/not allowed/)
  })
})
