import { describe, it, expect } from 'vitest'
import { buildSeed } from '../lib/seed'
import { fullMonths } from '../lib/insights'
import { lastMonths } from '../lib/utils'

describe('demo data', () => {
  const s = buildSeed()
  it('has a manager, a customer service user and reps', () => {
    const roles = new Set(s.profiles.map(p => p.role))
    expect(roles.has('admin') && roles.has('service') && roles.has('rep')).toBe(true)
  })
  it('every order belongs to a real account and a real rep, with lines', () => {
    for (const o of s.orders) {
      expect(s.accounts.some(a => a.id === o.accountId)).toBe(true)
      expect(s.profiles.some(p => p.id === o.repId)).toBe(true)
      expect(o.lines.length).toBeGreaterThan(0)
    }
  })
  it('order totals match their lines', () => {
    for (const o of s.orders) expect(o.total).toBeCloseTo(o.lines.reduce((n, l) => n + l.qty * l.price * (1 - l.discountPct / 100), 0), 1)
  })
  it('no two profiles share an id or email', () => {
    expect(new Set(s.profiles.map(p => p.id)).size).toBe(s.profiles.length)
    expect(new Set(s.profiles.map(p => p.email)).size).toBe(s.profiles.length)
  })
})

describe('sales insights months', () => {
  it('uses complete months only (never the month in progress)', () => {
    const current = lastMonths(1)[0]
    expect(fullMonths(6)).toHaveLength(6)
    expect(fullMonths(6)).not.toContain(current)
  })
})
