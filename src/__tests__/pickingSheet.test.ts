import { describe, it, expect } from 'vitest'
import { pickingSheetHtml } from '../lib/pickingSheet'
import { buildSeed } from '../lib/seed'

const s = buildSeed()
const ctx = { accounts: s.accounts, stock: s.stock, repName: (id: string) => s.profiles.find(p => p.id === id)?.name ?? '', now: new Date(2026, 7, 22, 9, 6, 2) }

describe('picking sheet', () => {
  const o = s.orders[0]
  const html = pickingSheetHtml([o], ctx)
  it('has the Sage layout headings', () => {
    for (const t of ['Picking Sheet', 'Warehouse:', 'Order Number:', 'Customer Number:', 'Sold To:', 'Ship To:', 'Confirm To:', 'Customer P.O.', 'Ship VIA', 'F. O. B.', 'Terms', 'Ship Date', 'Location', 'Item Code', 'Quan on Hand', 'Lot Number:']) expect(html).toContain(t)
  })
  it('shows the order number, the customer and every line', () => {
    expect(html).toContain(o.orderNo)
    expect(html).toContain(s.accounts.find(a => a.id === o.accountId)!.name.replace(/&/g, '&amp;'))
    for (const l of o.lines) { expect(html).toContain(l.sku); expect(html).toContain('BRAND ' + l.brand.toUpperCase()) }
  })
  it('prints today\'s date and time in the Sage style', () => { expect(html).toContain('8/22/2026'); expect(html).toMatch(/9:06:02\s?AM/) })
  it('marks a changed order as REVISED', () => {
    expect(html).not.toContain('REVISED')
    expect(pickingSheetHtml([{ ...o, editedAt: '2026-08-23T10:00:00' }], ctx)).toContain('REVISED ORDER')
  })
  it('makes one page per order', () => expect((pickingSheetHtml(s.orders.slice(0, 3), ctx).match(/<section class="sheet">/g) ?? []).length).toBe(3))
  it('cannot be broken by odd characters in names or notes', () => {
    const evil = { ...o, notes: '<script>alert(1)</script> & "quotes"' }
    const h = pickingSheetHtml([evil], ctx)
    expect(h).not.toContain('<script>alert(1)')
    expect(h).toContain('&lt;script&gt;')
  })
})
