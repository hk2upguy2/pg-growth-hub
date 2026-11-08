// Performance tests: the calculations must stay fast with a much bigger business than today's (3,000 customers, 100,000 sales rows).
import { describe, it, expect } from 'vitest'
import { buildSeed } from '../lib/seed'
import { dashboard, lapsedAccounts, staleAccounts } from '../lib/analytics'
import { whitespace, reorders, supplierReport } from '../lib/insights'
import { parseOrder } from '../lib/voiceOrder'
import { lastMonths } from '../lib/utils'
import type { Account, SalesRecord, PriceItem } from '../types'

const seed = buildSeed()
const base = seed.accounts
const months = lastMonths(13)
const brands = ['Agrosuper', 'Hostess', 'Kikkoman', 'OxKing', 'Pampeano', 'Orion']
const N = 3000
const accounts: Account[] = Array.from({ length: N }, (_, i) => ({ ...base[i % base.length], id: `big-${i}`, name: `Customer ${i}` }))
let n = 0
const sales: SalesRecord[] = []
for (const a of accounts) for (const m of months) for (let b = 0; b < 3; b++) sales.push({ id: `s${n++}`, accountId: a.id, month: m, brand: brands[(b + n) % 6], amount: 500 + (n % 700), quantity: null, lastDate: null, importedAt: '' })

const time = (fn: () => unknown) => { const t = performance.now(); fn(); return performance.now() - t }
// Generous limits (about 10x what a normal laptop needs) so a slow CI machine does not cause false alarms; a real slowdown still trips them.
const LIMIT = { dashboard: 500, insights: 3000, small: 300 }

describe(`with ${N} customers and ${sales.length.toLocaleString()} sales rows`, () => {
  it('the dashboard calculates quickly', () => expect(time(() => dashboard(accounts, seed.activities, seed.opportunities, seed.profiles))).toBeLessThan(LIMIT.dashboard))
  it('lapsed and stale lists are quick', () => expect(time(() => { lapsedAccounts(accounts); staleAccounts(accounts) })).toBeLessThan(LIMIT.small))
  it('whitespace analysis is quick', () => expect(time(() => whitespace(accounts, sales))).toBeLessThan(LIMIT.insights))
  it('reorder prediction is quick', () => expect(time(() => reorders(accounts, sales))).toBeLessThan(LIMIT.insights))
  it('a supplier report is quick', () => expect(time(() => supplierReport('Hostess', accounts, sales))).toBeLessThan(LIMIT.insights))
})

describe('say-your-order speed', () => {
  const items: PriceItem[] = Array.from({ length: 500 }, (_, i) => ({ id: `p${i}`, brand: 'Agrosuper', product: `Product ${i} ${['Wings', 'Soy', 'Cake', 'Rice'][i % 4]}`, sku: `P${i}`, unit: 'case', price: 10, active: true, updatedAt: '' }))
  it('a 10-line spoken order against a 500-product price list reads in under 300 ms', () => {
    const text = Array.from({ length: 10 }, (_, i) => `${i + 2} cases of product ${i * 7} wings`).join(', ')
    expect(time(() => parseOrder(text, items))).toBeLessThan(300)
  })
})
