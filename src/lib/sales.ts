import type { Account, SalesRecord } from '../types'
import type { FieldDef } from './importer'

/** Compare Sage customer numbers ignoring case, spaces and leading zeros (Excel often strips them). */
export const sageKey = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '').replace(/^0+(?=.)/, '')

export const SALES_FIELDS: FieldDef[] = [
  { key: 'customer', label: 'Sage customer number', required: true, aliases: ['customer number', 'customer no', 'customer #', 'customerno', 'cust no', 'custno', 'customer id', 'customer', 'account number', 'account no'] },
  { key: 'date', label: 'Month or invoice date', required: true, aliases: ['month', 'sales month', 'period', 'invoice date', 'date', 'transaction date'] },
  { key: 'brand', label: 'Brand (or item name)', aliases: ['brand', 'product line', 'productline', 'item description', 'description', 'item', 'item code', 'itemcode'] },
  { key: 'amount', label: 'Sales amount ($)', required: true, aliases: ['amount', 'sales amount', 'net sales', 'sales', 'extension', 'extended amount', 'revenue', 'total'] },
  { key: 'quantity', label: 'Quantity', aliases: ['quantity', 'qty', 'quantity shipped', 'qty shipped', 'units', 'cases'] },
]

const pad = (n: number) => String(n).padStart(2, '0')
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** Accepts 2026-10, 2026-10-31, 10/31/2026, 10/2026, Oct 2026 and Excel date serial numbers. */
export function parseMonth(raw: string): { month: string; date: string | null } | null {
  const s = raw.trim()
  if (!s) return null
  const ok = (y: number, mo: number, d?: number) =>
    y >= 2000 && y <= 2100 && mo >= 1 && mo <= 12 ? { month: `${y}-${pad(mo)}`, date: d ? `${y}-${pad(mo)}-${pad(d)}` : null } : null
  let m: RegExpMatchArray | null
  if ((m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/))) return ok(+m[1], +m[2], m[3] ? +m[3] : undefined)
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/))) { let y = +m[3]; if (y < 100) y += 2000; return ok(y, +m[1], +m[2]) }
  if ((m = s.match(/^(\d{1,2})\/(\d{4})$/))) return ok(+m[2], +m[1])
  if ((m = s.match(/^([A-Za-z]{3,9})\.?[\s\-,]*(\d{2,4})$/))) {
    const i = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()); let y = +m[2]; if (y < 100) y += 2000
    return i >= 0 ? ok(y, i + 1) : null
  }
  if (/^\d{5}$/.test(s)) { const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000); return ok(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) }
  return null
}

/** "$1,234.50", "(500)" and "500-" all parse; blank or text returns null. */
export function parseAmount(raw: string): number | null {
  let s = raw.trim()
  if (!s) return null
  let neg = false
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1) }
  if (/-\s*$/.test(s) || /^\s*-/.test(s)) neg = true
  const digits = s.replace(/[^0-9.]/g, '')
  if (!digits || !Number.isFinite(Number(digits))) return null
  return neg ? -Number(digits) : Number(digits)
}

const BRAND_WORDS: [string, string][] = [['agrosuper', 'Agrosuper'], ['hostess', 'Hostess'], ['kikkoman', 'Kikkoman'], ['oxking', 'OxKing'], ['ox king', 'OxKing'], ['pampeano', 'Pampeano'], ['orion', 'Orion'], ['choco pie', 'Orion']]
export function detectBrand(text: string): string | null {
  const t = text.toLowerCase()
  return BRAND_WORDS.find(([w]) => t.includes(w))?.[1] ?? null
}

export type NewSales = Omit<SalesRecord, 'id' | 'importedAt'>
export interface SalesPrepared {
  records: NewSales[]
  customersMatched: number
  unmatched: { sageNo: string; rows: number; amount: number }[]
  errors: { line: number; msg: string }[]
  months: string[]
  rowsUsed: number
  totalAmount: number
}

export function prepareSales(rows: string[][], mapping: Record<string, number>, fallbackBrand: string, accounts: Pick<Account, 'id' | 'sageNo'>[]): SalesPrepared {
  const bySage = new Map<string, string>()
  accounts.forEach(a => { if (a.sageNo) bySage.set(sageKey(a.sageNo), a.id) })
  const get = (r: string[], k: string) => (mapping[k] >= 0 ? (r[mapping[k]] ?? '').trim() : '')

  const agg = new Map<string, NewSales>()
  const unmatched = new Map<string, { sageNo: string; rows: number; amount: number }>()
  const errors: { line: number; msg: string }[] = []
  let rowsUsed = 0
  let totalAmount = 0

  rows.forEach((r, i) => {
    const line = i + 2
    const sage = get(r, 'customer')
    if (!sage) { errors.push({ line, msg: 'Customer number is empty' }); return }
    const when = parseMonth(get(r, 'date'))
    if (!when) { errors.push({ line, msg: `Cannot read the date “${get(r, 'date')}”` }); return }
    const amount = parseAmount(get(r, 'amount'))
    if (amount === null) { errors.push({ line, msg: `Cannot read the amount “${get(r, 'amount')}”` }); return }
    const qtyRaw = get(r, 'quantity')
    const qty = qtyRaw ? parseAmount(qtyRaw) : null

    const accountId = bySage.get(sageKey(sage))
    if (!accountId) {
      const u = unmatched.get(sageKey(sage)) ?? { sageNo: sage, rows: 0, amount: 0 }
      u.rows++; u.amount += amount
      unmatched.set(sageKey(sage), u)
      return
    }
    const brandText = get(r, 'brand')
    const brand = mapping.brand >= 0 ? (detectBrand(brandText) ?? (brandText ? 'Other' : fallbackBrand)) : fallbackBrand
    const key = `${accountId}|${when.month}|${brand}`
    const cur = agg.get(key) ?? { accountId, month: when.month, brand, amount: 0, quantity: null, lastDate: null }
    cur.amount += amount
    if (qty !== null) cur.quantity = (cur.quantity ?? 0) + qty
    if (when.date && amount > 0 && (!cur.lastDate || when.date > cur.lastDate)) cur.lastDate = when.date
    agg.set(key, cur)
    rowsUsed++
    totalAmount += amount
  })

  const records = [...agg.values()].map(x => ({ ...x, amount: Math.round(x.amount * 100) / 100 }))
  return {
    records,
    customersMatched: new Set(records.map(x => x.accountId)).size,
    unmatched: [...unmatched.values()].sort((a, b) => b.amount - a.amount),
    errors,
    months: [...new Set(records.map(x => x.month))].sort(),
    rowsUsed,
    totalAmount,
  }
}

const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + by, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/**
 * Turns Sage sales into account fields.
 * Actual monthly sales = average over the 3 newest months present in the data (a new customer is not diluted
 * by months that were never loaded). Last order = newest date with a positive sale. A Prospect that has bought
 * becomes Active. Other statuses are never changed.
 */
export function deriveAccountUpdates(accounts: Account[], sales: SalesRecord[]): { updated: Account[]; activated: number } {
  const months = [...new Set(sales.map(s => s.month))].sort()
  if (!months.length) return { updated: [], activated: 0 }
  const newest = months[months.length - 1]
  const win = [newest, shiftMonth(newest, -1), shiftMonth(newest, -2)]
  const divisor = win.filter(m => months.includes(m)).length || 1

  const byAccount = new Map<string, SalesRecord[]>()
  sales.forEach(s => byAccount.set(s.accountId, [...(byAccount.get(s.accountId) ?? []), s]))

  const updated: Account[] = []
  let activated = 0
  for (const a of accounts) {
    const recs = byAccount.get(a.id)
    if (!recs) continue
    const inWin = recs.filter(s => win.includes(s.month))
    const total = inWin.reduce((t, s) => t + s.amount, 0)
    const monthlySales = Math.max(0, Math.round(total / divisor))
    const lastOrder = recs.filter(s => s.amount > 0).map(s => s.lastDate ?? `${s.month}-01`).sort().pop() ?? null
    const becomesActive = a.status === 'Prospect' && total > 0
    if (monthlySales !== a.monthlySales || lastOrder !== (a.lastOrderDate ?? null) || becomesActive) {
      if (becomesActive) activated++
      updated.push({ ...a, monthlySales, lastOrderDate: lastOrder, status: becomesActive ? 'Active' : a.status })
    }
  }
  return { updated, activated }
}
