import { Account, Activity, Opportunity, Profile, STAGES, Stage } from '../types'
import { daysSince, lastMonths, monthKey, monthLabel, todayStr } from './utils'
import { PRIORITY_ORDER } from './seed'

export const isOpen = (o: Opportunity) => o.stage !== 'Won' && o.stage !== 'Lost'
export const weighted = (o: Opportunity) => (isOpen(o) ? (o.monthlyValue * o.probability) / 100 : 0)

export function pipelineTotals(opps: Opportunity[]) {
  const open = opps.filter(isOpen)
  return {
    openCount: open.length,
    gross: open.reduce((s, o) => s + o.monthlyValue, 0),
    weighted: open.reduce((s, o) => s + weighted(o), 0),
    won: opps.filter(o => o.stage === 'Won').reduce((s, o) => s + o.monthlyValue, 0),
    lost: opps.filter(o => o.stage === 'Lost').reduce((s, o) => s + o.monthlyValue, 0),
    wonCount: opps.filter(o => o.stage === 'Won').length,
    lostCount: opps.filter(o => o.stage === 'Lost').length,
  }
}

export function pipelineByStage(opps: Opportunity[]) {
  return STAGES.map(stage => {
    const list = opps.filter(o => o.stage === stage)
    return {
      stage: stage as Stage,
      count: list.length,
      value: list.reduce((s, o) => s + o.monthlyValue, 0),
      weighted: list.reduce((s, o) => s + weighted(o), 0),
    }
  })
}

export function isOverdue(a: Activity) {
  return !!a.followUpDate && !a.followUpDone && a.followUpDate < todayStr()
}
export function isDueSoon(a: Activity) {
  return !!a.followUpDate && !a.followUpDone && a.followUpDate >= todayStr()
}
export function followUpsDue(acts: Activity[]) {
  const t = todayStr()
  return acts.filter(a => a.followUpDate && !a.followUpDone && a.followUpDate <= t)
}

export function dashboard(accounts: Account[], activities: Activity[], opps: Opportunity[], profiles: Profile[]) {
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const byType = (t: Account['type']) => accounts.filter(a => a.type === t).length
  const visitedThisMonth = new Set(
    activities.filter(a => monthKey(a.at) === thisMonth && (a.type === 'Customer Visit' || a.type === 'New Account Opening'))
      .map(a => a.accountId),
  ).size
  const newAccountsThisMonth = accounts.filter(a => monthKey(a.createdAt) === thisMonth).length
  const pt = pipelineTotals(opps)

  const months = lastMonths(6)
  const monthly = months.map(m => ({
    month: monthLabel(m),
    Activities: activities.filter(a => monthKey(a.at) === m).length,
    Visits: activities.filter(a => monthKey(a.at) === m && a.type === 'Customer Visit').length,
  }))

  const distribution = (['Retail', 'Foodservice', 'Hotel', 'Institutional'] as const)
    .map(t => ({ name: t, value: byType(t) }))

  const priorityScore = (a: Account) => {
    const d = daysSince(a.lastVisit)
    return PRIORITY_ORDER[a.priority] * 1_000_000 - a.monthlyPotential - (d === null ? 999 : d)
  }
  const top10 = [...accounts]
    .filter(a => a.status !== 'Inactive')
    .sort((a, b) => priorityScore(a) - priorityScore(b))
    .slice(0, 10)

  const leaderboard = profiles.filter(p => p.role === 'rep' && p.active).map(p => {
    const myActs = activities.filter(a => a.repId === p.id && monthKey(a.at) === thisMonth)
    const myOpps = opps.filter(o => o.repId === p.id)
    const t = pipelineTotals(myOpps)
    return {
      id: p.id, name: p.name,
      accounts: accounts.filter(a => a.repId === p.id).length,
      activities: myActs.length,
      visits: myActs.filter(a => a.type === 'Customer Visit').length,
      opportunities: myOpps.length,
      pipeline: t.gross, weighted: t.weighted, won: t.wonCount,
    }
  }).sort((a, b) => b.weighted - a.weighted || b.activities - a.activities)

  return {
    totalAccounts: accounts.length,
    activeCustomers: accounts.filter(a => a.status === 'Active').length,
    prospects: accounts.filter(a => a.status === 'Prospect').length,
    retail: byType('Retail'), foodservice: byType('Foodservice'), hotel: byType('Hotel'),
    monthlyPotential: accounts.reduce((s, a) => s + a.monthlyPotential, 0),
    actualMonthlySales: accounts.reduce((s, a) => s + a.monthlySales, 0),
    pipeline: pt,
    visitedThisMonth,
    followUpsDue: followUpsDue(activities).length,
    newAccountsThisMonth,
    monthly, distribution, top10, leaderboard,
  }
}

/** Accounts not visited in N days (or never), highest priority/potential first. */
export function staleAccounts(accounts: Account[], days = 30) {
  return accounts
    .filter(a => a.status !== 'Inactive')
    .filter(a => { const d = daysSince(a.lastVisit); return d === null || d >= days })
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.monthlyPotential - a.monthlyPotential)
}

/** Visit-first ranking: priority, potential, staleness, overdue follow-up. */
export function visitFirst(accounts: Account[]) {
  const t = todayStr()
  return accounts
    .filter(a => a.status !== 'Inactive')
    .map(a => {
      const d = daysSince(a.lastVisit)
      const overdue = !!a.nextFollowUp && a.nextFollowUp <= t
      const score =
        (3 - PRIORITY_ORDER[a.priority]) * 40 +
        Math.min(a.monthlyPotential / 500, 40) +
        Math.min(d === null ? 60 : d, 60) * 0.6 +
        (overdue ? 25 : 0)
      return { account: a, score, daysSinceVisit: d, overdue }
    })
    .sort((a, b) => b.score - a.score)
}

/** Customers who used to buy but have not ordered in N days. Needs sales data from Sage (last order date). */
export function lapsedAccounts(accounts: Account[], days = 30) {
  return accounts
    .filter(a => a.status === 'Active' || a.monthlySales > 0)
    .map(a => ({ account: a, since: daysSince(a.lastOrderDate ?? null) }))
    .filter(x => x.since !== null && x.since >= days)
    .sort((x, y) => y.account.monthlySales - x.account.monthlySales)
}

/** Unread messages for a user: sent to them, or broadcast by someone else, with no read receipt. */
export function unreadMessages<M extends { id: string; recipientId: string | null; senderId: string }>(
  userId: string | undefined, messages: M[], reads: { messageId: string; userId: string }[],
) {
  if (!userId) return []
  const read = new Set(reads.filter(r => r.userId === userId).map(r => r.messageId))
  return messages.filter(m => !read.has(m.id) && (m.recipientId === userId || (m.recipientId === null && m.senderId !== userId)))
}
