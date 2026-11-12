import { useEffect, useMemo, useState } from 'react'
import type { Order } from '../types'
import { useStore } from './store'
import { lapsedAccounts, unreadMessages } from './analytics'
import { todayStr, daysSince, localDate } from './utils'

export interface Notice { id: string; tone: 'red' | 'amber' | 'blue'; title: string; detail: string; to: string }
/** Wins at or above this monthly value are announced to management. */
export const BIG_WIN_VALUE = 2000

/** Which order statuses a rep has already been told about (kept on their own device). */
const seenKey = (uid: string) => `pg-growth-hub:seen-orders:${uid}`
const readSeen = (uid: string): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(seenKey(uid)) ?? '[]')) } catch { return new Set() } }
export function markOrdersSeen(uid: string, orders: Order[]) {
  try {
    const seen = readSeen(uid); let changed = false
    for (const o of orders) if (o.repId === uid && o.status !== 'Submitted' && !seen.has(`${o.id}|${o.status}`)) { seen.add(`${o.id}|${o.status}`); changed = true }
    if (changed) { localStorage.setItem(seenKey(uid), JSON.stringify([...seen].slice(-500))); window.dispatchEvent(new Event('pg:orders-seen')) }
  } catch { /* private mode: the bell just shows the notice again */ }
}
/** Orders of this rep that the office confirmed, delivered or cancelled in the last 14 days and that the rep has not looked at yet. */
export function orderUpdatesFor(uid: string, orders: Order[], seen: Set<string> = readSeen(uid), now = Date.now()): Order[] {
  return orders.filter(o => o.repId === uid && o.status !== 'Submitted' && !seen.has(`${o.id}|${o.status}`)
    && o.statusChangedAt && now - new Date(o.statusChangedAt).getTime() < 14 * 86400000)
}

/** What needs attention right now, worked out from the data already loaded. Nothing is stored or sent. */
export function useNotices(): Notice[] {
  const { user, isAdmin, isService, messages, messageReads, activities, accounts, opportunities, quotes, orders, stock, accountName } = useStore()
  const [tick, setTick] = useState(0)
  useEffect(() => { const f = () => setTick(t => t + 1); window.addEventListener('pg:orders-seen', f); return () => window.removeEventListener('pg:orders-seen', f) }, [])
  return useMemo(() => {
    if (!user) return []
    const out: Notice[] = []
    const today = todayStr()
    const unread = unreadMessages(user.id, messages, messageReads)
    if (unread.length) {
      const urgent = unread.filter(m => m.urgent)
      out.push({ id: 'msg', tone: urgent.length ? 'red' : 'blue', title: `${unread.length} unread message${unread.length > 1 ? 's' : ''}${urgent.length ? ` (${urgent.length} urgent)` : ''}`, detail: unread[0].subject || 'Open Messages', to: '/messages' })
    }
    const mine = activities.filter(a => (isAdmin ? true : a.repId === user.id) && a.followUpDate && !a.followUpDone)
    const overdue = mine.filter(a => a.followUpDate! < today), dueToday = mine.filter(a => a.followUpDate === today)
    if (overdue.length) out.push({ id: 'fu-over', tone: 'red', title: `${overdue.length} overdue follow-up${overdue.length > 1 ? 's' : ''}`, detail: `${accountName(overdue[0].accountId)}${overdue.length > 1 ? ` and ${overdue.length - 1} more` : ''}`, to: '/activities' })
    if (dueToday.length) out.push({ id: 'fu-today', tone: 'amber', title: `${dueToday.length} follow-up${dueToday.length > 1 ? 's' : ''} due today`, detail: accountName(dueToday[0].accountId), to: '/activities' })
    const lapsed = lapsedAccounts(accounts, 30)
    if (lapsed.length) out.push({ id: 'lapsed', tone: 'amber', title: `${lapsed.length} customer${lapsed.length > 1 ? 's' : ''} stopped ordering`, detail: `${lapsed[0].account.name}: ${lapsed[0].since} days since last order`, to: '/accounts?lapsed=1' })
    const owing = accounts.filter(a => (a.overdueBalance ?? 0) > 0)
    if (owing.length) out.push({ id: 'ar', tone: 'red', title: `${owing.length} account${owing.length > 1 ? 's' : ''} with overdue balances`, detail: 'Check before taking new orders', to: '/accounts?overdue=1' })
    const recentWins = opportunities.filter(o => o.stage === 'Won' && o.monthlyValue >= BIG_WIN_VALUE && (daysSince(localDate(o.createdAt)) ?? 99) <= 7)
    if (recentWins.length && isAdmin) out.push({ id: 'wins', tone: 'blue', title: `${recentWins.length} big win${recentWins.length > 1 ? 's' : ''} this week`, detail: `${accountName(recentWins[0].accountId)}: ${recentWins[0].brand}`, to: '/opportunities' })
    const accepted = quotes.filter(q => q.status === 'Accepted' && (daysSince(localDate(q.createdAt)) ?? 99) <= 7)
    if (accepted.length) out.push({ id: 'quotes', tone: 'blue', title: `${accepted.length} quote${accepted.length > 1 ? 's' : ''} accepted this week`, detail: `${accepted[0].quoteNo} · ${accountName(accepted[0].accountId)}`, to: '/quotes' })
    if (!isAdmin && !isService) {
      for (const o of orderUpdatesFor(user.id, orders).slice(0, 5)) {
        out.push({ id: `ord-${o.id}-${o.status}`, tone: o.status === 'Cancelled' ? 'red' : o.status === 'Delivered' ? 'blue' : 'amber',
          title: `Order ${o.orderNo} ${o.status.toLowerCase()}`, detail: `${accountName(o.accountId)}${o.status === 'Confirmed' ? ': the office is preparing it. It can no longer be edited.' : o.status === 'Cancelled' ? ': ask the office why' : ''}`, to: '/orders' })
      }
    }
    const waiting = orders.filter(o => o.status === 'Submitted')
    if (waiting.length && (isAdmin || isService)) out.push({ id: 'orders', tone: 'amber', title: `${waiting.length} order${waiting.length > 1 ? 's' : ''} waiting for the office`, detail: `${waiting[0].orderNo} · ${accountName(waiting[0].accountId)}`, to: '/orders' })
    const soon = stock.filter(s => s.expiryDate && (daysSince(s.expiryDate) ?? 0) >= -60)
    if (soon.length) out.push({ id: 'expiry', tone: 'amber', title: `${soon.length} product${soon.length > 1 ? 's' : ''} near expiry`, detail: `${soon[0].product}: push this week`, to: '/stock' })
    return out
  }, [tick, user, isAdmin, isService, messages, messageReads, activities, accounts, opportunities, quotes, orders, stock, accountName])
}
