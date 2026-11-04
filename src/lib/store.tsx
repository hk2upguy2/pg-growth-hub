import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import {
  Account, Activity, CompetitorRecord, DB, Opportunity, Profile, Promotion, RoutePlan, RouteVisit,
} from '../types'
import { buildSeed } from './seed'
import { nowISO, uid, toDateStr, localDate } from './utils'

/**
 * DEMO-MODE DATA LAYER (localStorage).
 * Permissions are enforced HERE in the data layer (not just in the UI): every read is scoped by the
 * current user's role and every write is checked. In Supabase mode the same rules are enforced by
 * Postgres row-level security (see supabase/migrations). Swap this provider for a Supabase-backed one.
 */
const KEY = 'pg-growth-hub:db:v1'
const USER_KEY = 'pg-growth-hub:user:v1'

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DB
  } catch { /* fall through */ }
  const seed = buildSeed()
  try { localStorage.setItem(KEY, JSON.stringify(seed)) } catch { /* ignore */ }
  return seed
}

interface Ctx {
  user: Profile | null
  isAdmin: boolean
  login: (userId: string) => void
  logout: () => void
  // scoped (role-filtered) data
  profiles: Profile[]
  accounts: Account[]
  activities: Activity[]
  opportunities: Opportunity[]
  promotions: Promotion[]
  competitors: CompetitorRecord[]
  routePlans: RoutePlan[]
  routeVisits: RouteVisit[]
  repName: (id: string) => string
  accountName: (id: string) => string
  // mutations (throw on permission failure)
  saveAccount: (a: Partial<Account> & { name: string }) => Account
  deleteAccount: (id: string) => void
  saveActivity: (a: Partial<Activity> & { accountId: string }) => Activity
  deleteActivity: (id: string) => void
  completeFollowUp: (activityId: string) => void
  saveOpportunity: (o: Partial<Opportunity> & { accountId: string }) => Opportunity
  deleteOpportunity: (id: string) => void
  savePromotion: (p: Partial<Promotion> & { name: string }) => Promotion
  deletePromotion: (id: string) => void
  saveCompetitor: (c: Partial<CompetitorRecord> & { accountId: string }) => CompetitorRecord
  deleteCompetitor: (id: string) => void
  saveRoutePlan: (p: Partial<RoutePlan> & { date: string }, accountIds: string[]) => RoutePlan
  deleteRoutePlan: (id: string) => void
  addVisitToPlan: (planId: string, accountId: string) => void
  updateRouteVisit: (id: string, patch: Partial<RouteVisit>) => void
  removeRouteVisit: (id: string) => void
  saveProfile: (p: Partial<Profile> & { name: string; email: string }) => Profile
  resetDemo: () => void
  clearDemo: () => void
}

const StoreCtx = createContext<Ctx | null>(null)
export const useStore = () => {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('useStore outside provider')
  return c
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(load)
  const [userId, setUserId] = useState<string | null>(() => {
    try { return localStorage.getItem(USER_KEY) } catch { return null }
  })

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* quota */ }
  }, [db])

  const user = useMemo(() => db.profiles.find(p => p.id === userId && p.active) ?? null, [db.profiles, userId])
  const isAdmin = user?.role === 'admin'

  const login = useCallback((id: string) => {
    setUserId(id)
    try { localStorage.setItem(USER_KEY, id) } catch { /* ignore */ }
  }, [])
  const logout = useCallback(() => {
    setUserId(null)
    try { localStorage.removeItem(USER_KEY) } catch { /* ignore */ }
  }, [])

  // ---- scoped reads ----
  const scoped = useMemo(() => {
    if (!user) return { accounts: [], activities: [], opportunities: [], promotions: [], competitors: [], routePlans: [], routeVisits: [] } as Omit<DB, 'profiles'>
    if (isAdmin) return db
    const myAccounts = db.accounts.filter(a => a.repId === user.id)
    const ids = new Set(myAccounts.map(a => a.id))
    const myPlans = db.routePlans.filter(p => p.repId === user.id)
    const planIds = new Set(myPlans.map(p => p.id))
    return {
      accounts: myAccounts,
      activities: db.activities.filter(a => a.repId === user.id || ids.has(a.accountId)),
      opportunities: db.opportunities.filter(o => o.repId === user.id || ids.has(o.accountId)),
      promotions: db.promotions.filter(p => p.responsibleId === user.id || p.accountIds.some(i => ids.has(i))),
      competitors: db.competitors.filter(c => c.repId === user.id || ids.has(c.accountId)),
      routePlans: myPlans,
      routeVisits: db.routeVisits.filter(v => planIds.has(v.planId)),
    }
  }, [db, user, isAdmin])

  const profiles = useMemo(
    () => (isAdmin ? db.profiles : db.profiles.filter(p => p.id === user?.id || p.role === 'admin' || scoped.accounts.length >= 0)),
    [db.profiles, isAdmin, user, scoped.accounts.length],
  )
  const repName = useCallback((id: string) => db.profiles.find(p => p.id === id)?.name ?? 'Unassigned', [db.profiles])
  const accountName = useCallback((id: string) => db.accounts.find(a => a.id === id)?.name ?? 'Unknown account', [db.accounts])

  // ---- permission helpers ----
  const need = () => { if (!user) throw new Error('Not signed in') ; return user }
  const needAdmin = () => { const u = need(); if (u.role !== 'admin') throw new Error('Permission denied: management only'); return u }
  const canTouchAccount = (u: Profile, accountId: string) => {
    if (u.role === 'admin') return true
    const a = db.accounts.find(x => x.id === accountId)
    return !!a && a.repId === u.id
  }
  const assertAccount = (u: Profile, accountId: string) => {
    if (!canTouchAccount(u, accountId)) throw new Error('Permission denied: account is not assigned to you')
  }

  // ---- mutations ----
  const saveAccount: Ctx['saveAccount'] = a => {
    const u = need()
    const existing = a.id ? db.accounts.find(x => x.id === a.id) : undefined
    if (existing && u.role !== 'admin' && existing.repId !== u.id) throw new Error('Permission denied: account is not assigned to you')
    let repId = a.repId ?? existing?.repId ?? u.id
    // reps cannot reassign accounts or create accounts for others
    if (u.role !== 'admin') repId = existing ? existing.repId : u.id
    const maxNo = db.accounts.reduce((m, x) => Math.max(m, parseInt(x.accountNo.replace(/\D/g, '')) || 0), 1000)
    const full: Account = {
      id: existing?.id ?? uid(),
      accountNo: existing?.accountNo ?? `PG-${maxNo + 1}`,
      name: a.name.trim(),
      type: a.type ?? existing?.type ?? 'Retail',
      segment: a.segment ?? existing?.segment ?? 'Other',
      village: a.village ?? existing?.village ?? 'Tamuning',
      address: a.address ?? existing?.address ?? '',
      contactName: a.contactName ?? existing?.contactName ?? '',
      contactPosition: a.contactPosition ?? existing?.contactPosition ?? '',
      phone: a.phone ?? existing?.phone ?? '',
      email: a.email ?? existing?.email ?? '',
      repId,
      priority: a.priority ?? existing?.priority ?? 'B',
      status: a.status ?? existing?.status ?? 'Prospect',
      monthlyPotential: Number(a.monthlyPotential ?? existing?.monthlyPotential ?? 0),
      monthlySales: Number(a.monthlySales ?? existing?.monthlySales ?? 0),
      currentProducts: a.currentProducts ?? existing?.currentProducts ?? '',
      potentialProducts: a.potentialProducts ?? existing?.potentialProducts ?? '',
      competitor: a.competitor ?? existing?.competitor ?? '',
      lastVisit: a.lastVisit !== undefined ? a.lastVisit : existing?.lastVisit ?? null,
      nextFollowUp: a.nextFollowUp !== undefined ? a.nextFollowUp : existing?.nextFollowUp ?? null,
      notes: a.notes ?? existing?.notes ?? '',
      createdAt: existing?.createdAt ?? nowISO(),
      isDemo: existing?.isDemo,
    }
    setDb(d => ({ ...d, accounts: existing ? d.accounts.map(x => (x.id === full.id ? full : x)) : [...d.accounts, full] }))
    return full
  }
  const deleteAccount = (id: string) => {
    needAdmin()
    setDb(d => ({
      ...d,
      accounts: d.accounts.filter(a => a.id !== id),
      activities: d.activities.filter(a => a.accountId !== id),
      opportunities: d.opportunities.filter(o => o.accountId !== id),
      competitors: d.competitors.filter(c => c.accountId !== id),
      routeVisits: d.routeVisits.filter(v => v.accountId !== id),
      promotions: d.promotions.map(p => ({ ...p, accountIds: p.accountIds.filter(i => i !== id) })),
    }))
  }

  /** Keep account.lastVisit / nextFollowUp in sync with logged activity. */
  const syncAccountFromActivity = (accounts: Account[], act: Activity): Account[] =>
    accounts.map(a => {
      if (a.id !== act.accountId) return a
      const actDate = localDate(act.at)
      const isVisit = act.type === 'Customer Visit' || act.type === 'New Account Opening' || act.type === 'Product Presentation' || act.type === 'Product Sampling'
      return {
        ...a,
        lastVisit: isVisit && (!a.lastVisit || actDate > a.lastVisit) ? actDate : a.lastVisit,
        nextFollowUp: act.followUpDate && !act.followUpDone ? act.followUpDate : a.nextFollowUp,
      }
    })

  const saveActivity: Ctx['saveActivity'] = a => {
    const u = need()
    assertAccount(u, a.accountId)
    const existing = a.id ? db.activities.find(x => x.id === a.id) : undefined
    if (existing && u.role !== 'admin' && existing.repId !== u.id) throw new Error('Permission denied')
    const full: Activity = {
      id: existing?.id ?? uid(),
      at: a.at ?? existing?.at ?? nowISO(),
      accountId: a.accountId,
      repId: u.role === 'admin' ? a.repId ?? existing?.repId ?? u.id : existing?.repId ?? u.id,
      type: a.type ?? existing?.type ?? 'Customer Visit',
      summary: a.summary ?? existing?.summary ?? '',
      products: a.products ?? existing?.products ?? '',
      outcome: a.outcome ?? existing?.outcome ?? '',
      nextAction: a.nextAction ?? existing?.nextAction ?? '',
      followUpDate: a.followUpDate !== undefined ? a.followUpDate : existing?.followUpDate ?? null,
      followUpDone: a.followUpDone ?? existing?.followUpDone ?? false,
      createdAt: existing?.createdAt ?? nowISO(),
    }
    setDb(d => ({
      ...d,
      activities: existing ? d.activities.map(x => (x.id === full.id ? full : x)) : [full, ...d.activities],
      accounts: syncAccountFromActivity(d.accounts, full),
    }))
    return full
  }
  const deleteActivity = (id: string) => {
    const u = need()
    const ex = db.activities.find(a => a.id === id)
    if (!ex) return
    if (u.role !== 'admin' && ex.repId !== u.id) throw new Error('Permission denied')
    setDb(d => ({ ...d, activities: d.activities.filter(a => a.id !== id) }))
  }
  const completeFollowUp = (id: string) => {
    const u = need()
    const ex = db.activities.find(a => a.id === id)
    if (!ex) return
    assertAccount(u, ex.accountId)
    setDb(d => ({ ...d, activities: d.activities.map(a => (a.id === id ? { ...a, followUpDone: true } : a)) }))
  }

  const saveOpportunity: Ctx['saveOpportunity'] = o => {
    const u = need()
    assertAccount(u, o.accountId)
    const existing = o.id ? db.opportunities.find(x => x.id === o.id) : undefined
    if (existing && u.role !== 'admin' && existing.repId !== u.id && !canTouchAccount(u, existing.accountId)) throw new Error('Permission denied')
    const acct = db.accounts.find(a => a.id === o.accountId)
    const full: Opportunity = {
      id: existing?.id ?? uid(),
      accountId: o.accountId,
      brand: o.brand ?? existing?.brand ?? 'Agrosuper',
      product: o.product ?? existing?.product ?? '',
      monthlyValue: Number(o.monthlyValue ?? existing?.monthlyValue ?? 0),
      stage: o.stage ?? existing?.stage ?? 'Identified',
      probability: Number(o.probability ?? existing?.probability ?? 10),
      expectedClose: o.expectedClose ?? existing?.expectedClose ?? toDateStr(new Date()),
      repId: u.role === 'admin' ? o.repId ?? existing?.repId ?? acct?.repId ?? u.id : existing?.repId ?? u.id,
      nextAction: o.nextAction ?? existing?.nextAction ?? '',
      notes: o.notes ?? existing?.notes ?? '',
      lostReason: o.lostReason ?? existing?.lostReason,
      createdAt: existing?.createdAt ?? nowISO(),
      isDemo: existing?.isDemo,
    }
    setDb(d => ({ ...d, opportunities: existing ? d.opportunities.map(x => (x.id === full.id ? full : x)) : [full, ...d.opportunities] }))
    return full
  }
  const deleteOpportunity = (id: string) => {
    const u = need()
    const ex = db.opportunities.find(o => o.id === id)
    if (!ex) return
    assertAccount(u, ex.accountId)
    setDb(d => ({ ...d, opportunities: d.opportunities.filter(o => o.id !== id) }))
  }

  const savePromotion: Ctx['savePromotion'] = p => {
    const u = need()
    const existing = p.id ? db.promotions.find(x => x.id === p.id) : undefined
    if (existing && u.role !== 'admin' && existing.responsibleId !== u.id) throw new Error('Permission denied')
    const full: Promotion = {
      id: existing?.id ?? uid(),
      name: p.name.trim(),
      kind: p.kind ?? existing?.kind ?? 'Supplier Promotion',
      brand: p.brand ?? existing?.brand ?? 'Agrosuper',
      supplier: p.supplier ?? existing?.supplier ?? '',
      accountIds: (p.accountIds ?? existing?.accountIds ?? []).filter(id => canTouchAccount(u, id)),
      start: p.start ?? existing?.start ?? toDateStr(new Date()),
      end: p.end ?? existing?.end ?? toDateStr(new Date()),
      budget: Number(p.budget ?? existing?.budget ?? 0),
      expected: p.expected ?? existing?.expected ?? '',
      actual: p.actual ?? existing?.actual ?? '',
      status: p.status ?? existing?.status ?? 'Planned',
      responsibleId: u.role === 'admin' ? p.responsibleId ?? existing?.responsibleId ?? u.id : existing?.responsibleId ?? u.id,
      createdAt: existing?.createdAt ?? nowISO(),
    }
    setDb(d => ({ ...d, promotions: existing ? d.promotions.map(x => (x.id === full.id ? full : x)) : [full, ...d.promotions] }))
    return full
  }
  const deletePromotion = (id: string) => {
    const u = need()
    const ex = db.promotions.find(p => p.id === id)
    if (!ex) return
    if (u.role !== 'admin' && ex.responsibleId !== u.id) throw new Error('Permission denied')
    setDb(d => ({ ...d, promotions: d.promotions.filter(p => p.id !== id) }))
  }

  const saveCompetitor: Ctx['saveCompetitor'] = c => {
    const u = need()
    assertAccount(u, c.accountId)
    const existing = c.id ? db.competitors.find(x => x.id === c.id) : undefined
    if (existing && u.role !== 'admin' && existing.repId !== u.id) throw new Error('Permission denied')
    const full: CompetitorRecord = {
      id: existing?.id ?? uid(),
      competitor: c.competitor ?? existing?.competitor ?? '',
      accountId: c.accountId,
      products: c.products ?? existing?.products ?? '',
      price: c.price ?? existing?.price ?? '',
      promotions: c.promotions ?? existing?.promotions ?? '',
      currentSupplier: c.currentSupplier ?? existing?.currentSupplier ?? '',
      observations: c.observations ?? existing?.observations ?? '',
      recordedAt: c.recordedAt ?? existing?.recordedAt ?? toDateStr(new Date()),
      repId: existing?.repId ?? u.id,
      attachment: c.attachment !== undefined ? c.attachment : existing?.attachment,
      attachmentName: c.attachmentName !== undefined ? c.attachmentName : existing?.attachmentName,
      createdAt: existing?.createdAt ?? nowISO(),
    }
    setDb(d => ({ ...d, competitors: existing ? d.competitors.map(x => (x.id === full.id ? full : x)) : [full, ...d.competitors] }))
    return full
  }
  const deleteCompetitor = (id: string) => {
    const u = need()
    const ex = db.competitors.find(c => c.id === id)
    if (!ex) return
    if (u.role !== 'admin' && ex.repId !== u.id) throw new Error('Permission denied')
    setDb(d => ({ ...d, competitors: d.competitors.filter(c => c.id !== id) }))
  }

  const saveRoutePlan: Ctx['saveRoutePlan'] = (p, accountIds) => {
    const u = need()
    const existing = p.id ? db.routePlans.find(x => x.id === p.id) : undefined
    if (existing && u.role !== 'admin' && existing.repId !== u.id) throw new Error('Permission denied')
    const ids = accountIds.filter(id => canTouchAccount(u, id))
    const plan: RoutePlan = {
      id: existing?.id ?? uid(),
      date: p.date,
      repId: u.role === 'admin' ? p.repId ?? existing?.repId ?? u.id : u.id,
      territory: p.territory ?? existing?.territory ?? 'All',
      notes: p.notes ?? existing?.notes ?? '',
      createdAt: existing?.createdAt ?? nowISO(),
    }
    const visits: RouteVisit[] = ids.map(accountId => ({
      id: uid(), planId: plan.id, accountId, status: 'Planned', outcome: '', visitedAt: null, createdAt: nowISO(),
    }))
    setDb(d => ({
      ...d,
      routePlans: existing ? d.routePlans.map(x => (x.id === plan.id ? plan : x)) : [plan, ...d.routePlans],
      routeVisits: [...d.routeVisits, ...visits],
    }))
    return plan
  }
  const deleteRoutePlan = (id: string) => {
    const u = need()
    const ex = db.routePlans.find(p => p.id === id)
    if (!ex) return
    if (u.role !== 'admin' && ex.repId !== u.id) throw new Error('Permission denied')
    setDb(d => ({ ...d, routePlans: d.routePlans.filter(p => p.id !== id), routeVisits: d.routeVisits.filter(v => v.planId !== id) }))
  }
  const addVisitToPlan = (planId: string, accountId: string) => {
    const u = need()
    const plan = db.routePlans.find(p => p.id === planId)
    if (!plan || (u.role !== 'admin' && plan.repId !== u.id)) throw new Error('Permission denied')
    assertAccount(u, accountId)
    if (db.routeVisits.some(v => v.planId === planId && v.accountId === accountId)) return
    setDb(d => ({
      ...d,
      routeVisits: [...d.routeVisits, { id: uid(), planId, accountId, status: 'Planned', outcome: '', visitedAt: null, createdAt: nowISO() }],
    }))
  }
  const updateRouteVisit = (id: string, patch: Partial<RouteVisit>) => {
    const u = need()
    const v = db.routeVisits.find(x => x.id === id)
    if (!v) return
    const plan = db.routePlans.find(p => p.id === v.planId)
    if (!plan || (u.role !== 'admin' && plan.repId !== u.id)) throw new Error('Permission denied')
    const next: RouteVisit = { ...v, ...patch, id: v.id, planId: v.planId, accountId: v.accountId }
    setDb(d => {
      let accounts = d.accounts
      let activities = d.activities
      // Marking a visit as Visited records a real Customer Visit activity and updates the account.
      if (patch.status === 'Visited' && v.status !== 'Visited') {
        const at = nowISO()
        next.visitedAt = at
        const act: Activity = {
          id: uid(), at, accountId: v.accountId, repId: plan.repId, type: 'Customer Visit',
          summary: patch.outcome || next.outcome || 'Visit completed from route plan.', products: '', outcome: patch.outcome || next.outcome || 'Visited',
          nextAction: '', followUpDate: null, followUpDone: false, createdAt: at,
        }
        activities = [act, ...activities]
        accounts = syncAccountFromActivity(accounts, act)
      }
      return { ...d, accounts, activities, routeVisits: d.routeVisits.map(x => (x.id === id ? next : x)) }
    })
  }
  const removeRouteVisit = (id: string) => {
    const u = need()
    const v = db.routeVisits.find(x => x.id === id)
    if (!v) return
    const plan = db.routePlans.find(p => p.id === v.planId)
    if (!plan || (u.role !== 'admin' && plan.repId !== u.id)) throw new Error('Permission denied')
    setDb(d => ({ ...d, routeVisits: d.routeVisits.filter(x => x.id !== id) }))
  }

  const saveProfile: Ctx['saveProfile'] = p => {
    needAdmin()
    const existing = p.id ? db.profiles.find(x => x.id === p.id) : undefined
    const full: Profile = {
      id: existing?.id ?? uid(),
      name: p.name.trim(),
      email: p.email.trim(),
      role: p.role ?? existing?.role ?? 'rep',
      territory: p.territory ?? existing?.territory ?? 'All',
      active: p.active ?? existing?.active ?? true,
      createdAt: existing?.createdAt ?? nowISO(),
    }
    // never allow removing the last active admin
    if (existing && existing.role === 'admin' && (full.role !== 'admin' || !full.active)) {
      const otherAdmins = db.profiles.filter(x => x.role === 'admin' && x.active && x.id !== existing.id)
      if (!otherAdmins.length) throw new Error('At least one active administrator is required')
    }
    setDb(d => ({ ...d, profiles: existing ? d.profiles.map(x => (x.id === full.id ? full : x)) : [...d.profiles, full] }))
    return full
  }

  const resetDemo = () => {
    needAdmin()
    setDb(buildSeed())
  }
  const clearDemo = () => {
    needAdmin()
    setDb(d => ({
      ...d,
      accounts: d.accounts.filter(a => !a.isDemo),
      activities: d.activities.filter(a => d.accounts.find(x => x.id === a.accountId)?.isDemo === false),
      opportunities: d.opportunities.filter(o => !o.isDemo),
      competitors: d.competitors.filter(c => d.accounts.find(x => x.id === c.accountId)?.isDemo === false),
      promotions: d.promotions.filter(p => !p.name.endsWith('(demo)')),
      routePlans: [],
      routeVisits: [],
    }))
  }

  const value: Ctx = {
    user, isAdmin: !!isAdmin, login, logout,
    profiles, ...scoped, repName, accountName,
    saveAccount, deleteAccount, saveActivity, deleteActivity, completeFollowUp,
    saveOpportunity, deleteOpportunity, savePromotion, deletePromotion,
    saveCompetitor, deleteCompetitor, saveRoutePlan, deleteRoutePlan, addVisitToPlan,
    updateRouteVisit, removeRouteVisit, saveProfile, resetDemo, clearDemo,
  }
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}
