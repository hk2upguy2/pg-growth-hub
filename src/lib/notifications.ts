import { useMemo } from 'react'
import { useStore } from './store'
import { lapsedAccounts, unreadMessages } from './analytics'
import { todayStr, daysSince, localDate } from './utils'

export interface Notice { id: string; tone: 'red' | 'amber' | 'blue'; title: string; detail: string; to: string }
/** Wins at or above this monthly value are announced to management. */
export const BIG_WIN_VALUE = 2000

/** What needs attention right now, worked out from the data already loaded. Nothing is stored or sent. */
export function useNotices(): Notice[] {
  const { user, isAdmin, messages, messageReads, activities, accounts, opportunities, quotes, orders, stock, accountName } = useStore()
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
    const waiting = orders.filter(o => o.status === 'Submitted')
    if (waiting.length && isAdmin) out.push({ id: 'orders', tone: 'amber', title: `${waiting.length} order${waiting.length > 1 ? 's' : ''} waiting for the office`, detail: `${waiting[0].orderNo} · ${accountName(waiting[0].accountId)}`, to: '/orders' })
    const soon = stock.filter(s => s.expiryDate && (daysSince(s.expiryDate) ?? 0) >= -60)
    if (soon.length) out.push({ id: 'expiry', tone: 'amber', title: `${soon.length} product${soon.length > 1 ? 's' : ''} near expiry`, detail: `${soon[0].product}: push this week`, to: '/stock' })
    return out
  }, [user, isAdmin, messages, messageReads, activities, accounts, opportunities, quotes, orders, stock, accountName])
}
