export const uid = (): string =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)

export const nowISO = () => new Date().toISOString()
export const todayStr = () => toDateStr(new Date())
export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export function addDays(base: Date, n: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}
export function daysAgoStr(n: number) { return toDateStr(addDays(new Date(), -n)) }
export function daysFromNowStr(n: number) { return toDateStr(addDays(new Date(), n)) }
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  return `${toDateStr(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)
export const moneyShort = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (a >= 1_000) return `$${(n / 1_000).toFixed(a >= 10_000 ? 0 : 1)}K`
  return `$${Math.round(n)}`
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s.length === 10 ? s + 'T00:00:00' : s)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
export function fmtDateTime(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
export function daysSince(s: string | null | undefined): number | null {
  if (!s) return null
  const d = new Date(s.length === 10 ? s + 'T00:00:00' : s)
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}
/** Local calendar date (YYYY-MM-DD) for an ISO datetime or date string. */
export function localDate(s: string): string {
  if (s.length <= 10) return s
  const d = new Date(s)
  return isNaN(d.getTime()) ? s.slice(0, 10) : toDateStr(d)
}
export function monthKey(s: string): string { return localDate(s).slice(0, 7) }
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}
export function lastMonths(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

/** CSV with BOM so Excel opens UTF-8 correctly. */
export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\r\n')
}
export function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function exportCSV(name: string, rows: Record<string, unknown>[]) {
  downloadFile(`${name}.csv`, '﻿' + toCSV(rows), 'text/csv;charset=utf-8')
}
/** Excel-compatible: an HTML table saved as .xls opens natively in Excel. */
export function exportXLS(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) { downloadFile(`${name}.xls`, '', 'application/vnd.ms-excel'); return }
  const headers = Object.keys(rows[0])
  const e = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${
    headers.map(h => `<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${
    rows.map(r => `<tr>${headers.map(h => `<td>${e(r[h])}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`
  downloadFile(`${name}.xls`, html, 'application/vnd.ms-excel')
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
