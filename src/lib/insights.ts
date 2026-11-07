import type { Account, Promotion, SalesRecord } from '../types'
import { daysSince, lastMonths } from './utils'

/** The last n COMPLETE months (the current month is only part-way through, so it would drag every average down). */
export const fullMonths = (n: number) => lastMonths(n + 1).slice(0, n)
const median = (n: number[]) => { if (!n.length) return 0; const s = [...n].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const peerKey = (a: Account) => `${a.type}|${a.segment}`

/** Sum of sales per account+brand over the given months. */
function brandTotals(sales: SalesRecord[], months: string[]) {
  const set = new Set(months), m = new Map<string, Map<string, number>>()
  for (const s of sales) {
    if (!set.has(s.month) || s.amount <= 0) continue
    const byBrand = m.get(s.accountId) ?? new Map<string, number>()
    byBrand.set(s.brand, (byBrand.get(s.brand) ?? 0) + s.amount)
    m.set(s.accountId, byBrand)
  }
  return m
}

export interface Whitespace { account: Account; brand: string; peers: number; peerPct: number; estMonthly: number }
/**
 * For each buying account, brands it does NOT buy that at least 30% of similar accounts (same type and segment,
 * minimum 3 buying peers) do buy. Estimate = median monthly spend of those peers on the brand.
 */
export function whitespace(accounts: Account[], sales: SalesRecord[], months = 6, minPct = 30): Whitespace[] {
  const win = fullMonths(months)
  const tot = brandTotals(sales, win)
  const buyers = accounts.filter(a => tot.has(a.id))
  const groups = new Map<string, Account[]>()
  buyers.forEach(a => groups.set(peerKey(a), [...(groups.get(peerKey(a)) ?? []), a]))
  const out: Whitespace[] = []
  for (const group of groups.values()) {
    if (group.length < 4) continue
    const brands = new Set(group.flatMap(a => [...tot.get(a.id)!.keys()]))
    for (const brand of brands) {
      const have = group.filter(a => tot.get(a.id)!.has(brand))
      const pctHave = (have.length / group.length) * 100
      if (have.length < 3 || pctHave < minPct) continue
      const est = Math.round(median(have.map(a => tot.get(a.id)!.get(brand)! / win.length)))
      for (const a of group) if (!tot.get(a.id)!.has(brand)) out.push({ account: a, brand, peers: have.length, peerPct: Math.round(pctHave), estMonthly: est })
    }
  }
  return out.sort((a, b) => b.estMonthly - a.estMonthly)
}

export interface Reorder { account: Account; brand: string; monthsBought: number; avgMonthly: number; daysSince: number; late: boolean }
/**
 * Regular buyers (bought the brand in at least 4 of the last 6 months) whose latest purchase of that brand is 30+ days
 * old. 45+ days is "late". Sage data is monthly, so this is a rule of thumb, not an exact reorder date.
 */
export function reorders(accounts: Account[], sales: SalesRecord[]): Reorder[] {
  const win = new Set(fullMonths(6)), cur = lastMonths(1)[0], acc = new Map(accounts.map(a => [a.id, a]))
  const g = new Map<string, { months: Set<string>; amount: number; last: string }>()
  for (const s of sales) {
    // the current month counts only for "latest purchase", so a fresh order this week clears the flag
    if ((!win.has(s.month) && s.month !== cur) || s.amount <= 0 || !acc.has(s.accountId)) continue
    const k = `${s.accountId}|${s.brand}`
    const r = g.get(k) ?? { months: new Set(), amount: 0, last: '' }
    if (win.has(s.month)) { r.months.add(s.month); r.amount += s.amount }
    const d = s.lastDate ?? `${s.month}-01`; if (d > r.last) r.last = d
    g.set(k, r)
  }
  const out: Reorder[] = []
  for (const [k, r] of g) {
    const [id, brand] = k.split('|'), a = acc.get(id)!
    if (a.status === 'Inactive' || a.status === 'On Hold' || r.months.size < 4) continue
    const d = daysSince(r.last) ?? 0
    if (d < 30) continue
    out.push({ account: a, brand, monthsBought: r.months.size, avgMonthly: Math.round(r.amount / r.months.size), daysSince: d, late: d >= 45 })
  }
  return out.sort((a, b) => b.avgMonthly - a.avgMonthly)
}

export interface SupplierReport {
  brand: string
  months: { month: string; amount: number; buyers: number }[]
  total: number
  buyers: number
  eligible: number
  penetration: number
  top: { account: Account; amount: number }[]
  bySegment: { segment: string; amount: number; buyers: number }[]
  trendPct: number | null
}
export function supplierReport(brand: string, accounts: Account[], sales: SalesRecord[], months = 6): SupplierReport {
  const sorted = fullMonths(months)
  const acc = new Map(accounts.map(a => [a.id, a]))
  const rows = sales.filter(s => s.brand === brand && sorted.includes(s.month) && s.amount > 0 && acc.has(s.accountId))
  const perMonth = sorted.map(m => {
    const r = rows.filter(s => s.month === m)
    return { month: m, amount: Math.round(r.reduce((n, s) => n + s.amount, 0)), buyers: new Set(r.map(s => s.accountId)).size }
  })
  const per = new Map<string, number>()
  rows.forEach(s => per.set(s.accountId, (per.get(s.accountId) ?? 0) + s.amount))
  const seg = new Map<string, { amount: number; ids: Set<string> }>()
  rows.forEach(s => { const sg = acc.get(s.accountId)!.segment; const r = seg.get(sg) ?? { amount: 0, ids: new Set() }; r.amount += s.amount; r.ids.add(s.accountId); seg.set(sg, r) })
  const eligible = accounts.filter(a => a.status !== 'Prospect' || per.has(a.id)).length
  const half = Math.floor(perMonth.length / 2)
  const first = perMonth.slice(0, half).reduce((n, m) => n + m.amount, 0), last = perMonth.slice(-half).reduce((n, m) => n + m.amount, 0)
  return {
    brand, months: perMonth, total: Math.round([...per.values()].reduce((n, v) => n + v, 0)), buyers: per.size, eligible,
    penetration: eligible ? Math.round((per.size / eligible) * 100) : 0,
    top: [...per].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, amount]) => ({ account: acc.get(id)!, amount: Math.round(amount) })),
    bySegment: [...seg].map(([segment, v]) => ({ segment, amount: Math.round(v.amount), buyers: v.ids.size })).sort((a, b) => b.amount - a.amount),
    trendPct: first > 0 ? Math.round(((last - first) / first) * 100) : null,
  }
}

export interface PromoResult {
  promo: Promotion; stores: number; before: number; during: number; liftPct: number | null; controlPct: number | null; netPct: number | null; note: string
}
/**
 * Monthly average brand sales in the promotion's stores: up to 2 months before the start month vs the promotion months.
 * Compared with all other accounts of the same type buying that brand (control), so a general trend is not credited to the promo.
 */
export function promoResults(promos: Promotion[], accounts: Account[], sales: SalesRecord[]): PromoResult[] {
  const monthsBetween = (a: string, b: string) => { const out: string[] = []; let [y, m] = a.split('-').map(Number); const [ey, em] = b.split('-').map(Number); while (y < ey || (y === ey && m <= em)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++ } } return out }
  const shift = (key: string, n: number) => { const [y, m] = key.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
  const acc = new Map(accounts.map(a => [a.id, a]))
  const cur = lastMonths(1)[0]
  const monthsWithData = new Set(sales.map(s => s.month).filter(m => m < cur))   // complete months only
  return promos.filter(p => p.accountIds.length).map(p => {
    const sm = p.start.slice(0, 7), em = p.end.slice(0, 7)
    const during = monthsBetween(sm, em).filter(m => monthsWithData.has(m))
    const before = [shift(sm, -2), shift(sm, -1)].filter(m => monthsWithData.has(m))
    const base = { promo: p, stores: p.accountIds.length, before: 0, during: 0, liftPct: null, controlPct: null, netPct: null }
    if (!during.length || !before.length) return { ...base, note: !before.length ? 'No sales data before the promotion' : 'Needs a full month of results: check back after the month ends' }
    const part = new Set(p.accountIds)
    const avg = (ids: (a: string) => boolean, ms: string[]) => sales.filter(s => s.brand === p.brand && ms.includes(s.month) && ids(s.accountId)).reduce((n, s) => n + s.amount, 0) / ms.length
    const pb = avg(i => part.has(i), before), pd = avg(i => part.has(i), during)
    const types = new Set(p.accountIds.map(i => acc.get(i)?.type))
    const ctl = (i: string) => !part.has(i) && types.has(acc.get(i)?.type)
    const cb = avg(ctl, before), cd = avg(ctl, during)
    const lift = pb > 0 ? Math.round(((pd - pb) / pb) * 100) : null, control = cb > 0 ? Math.round(((cd - cb) / cb) * 100) : null
    return { ...base, before: Math.round(pb), during: Math.round(pd), liftPct: lift, controlPct: control, netPct: lift !== null && control !== null ? lift - control : lift,
      note: pb === 0 ? 'Stores did not buy this brand before' : '' }
  })
}
