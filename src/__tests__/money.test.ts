import { describe, it, expect } from 'vitest'
import { lineTotal, quoteTotal, channelAllows, MAX_REP_DISCOUNT, QuoteLine } from '../types'

const line = (o: Partial<QuoteLine> = {}): QuoteLine => ({ brand: 'Agrosuper', product: 'Party Wings', sku: 'AG-PW', unit: 'case', qty: 10, price: 50, discountPct: 0, ...o })

describe('order and quote totals', () => {
  it('multiplies quantity by price', () => expect(lineTotal(line())).toBe(500))
  it('applies a discount', () => expect(lineTotal(line({ discountPct: 10 }))).toBe(450))
  it('rounds to cents', () => expect(lineTotal(line({ qty: 3, price: 3.33, discountPct: 7 }))).toBe(9.29))
  it('adds up all lines', () => expect(quoteTotal([line(), line({ qty: 2, price: 52 })])).toBe(604))
  it('an empty order is zero', () => expect(quoteTotal([])).toBe(0))
  it('reps may discount up to 10%', () => expect(MAX_REP_DISCOUNT).toBe(10))
})

describe('sales channels', () => {
  it('a Retail rep only works Retail', () => {
    expect(channelAllows('Retail', 'Retail')).toBe(true)
    expect(channelAllows('Retail', 'Hotel')).toBe(false)
    expect(channelAllows('Retail', 'Foodservice')).toBe(false)
  })
  it('a Hospitality rep works Hotel and Foodservice but not Retail', () => {
    expect(channelAllows('Hospitality', 'Hotel')).toBe(true)
    expect(channelAllows('Hospitality', 'Foodservice')).toBe(true)
    expect(channelAllows('Hospitality', 'Retail')).toBe(false)
  })
  it('an All rep, or no channel, works everything', () => {
    expect(channelAllows('All', 'Retail')).toBe(true)
    expect(channelAllows(undefined, 'Hotel')).toBe(true)
  })
})
