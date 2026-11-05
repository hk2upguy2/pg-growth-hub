import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import {
  Account, Activity, channelAllows, CompetitorRecord, DB, Message, MessageRead, Opportunity, Profile, Promotion, RoutePlan, RouteVisit, SalesRecord,
} from '../types'
import { buildSeed } from './seed'
import { hasSupabase, supabase } from './supabase'
import { emitSyncError, loadAll, persist, remote } from './db'
import { nowISO, uid, toDateStr, localDate } from './utils'
import type { ImportRow } from './importer'
import { NewSales, deriveAccountUpdates, sageKey } from './sales'

/**
 * DEMO-MODE DATA LAYER (localStorage).
 * Permissions are enforced HERE in the data layer (not just in the UI): every read is scoped by the
 * current user's role and every write is checked. In Supabase mode the same rules are enforced by
 * Postgres row-level security (see supabase/migrations). Swap this provider for a Supabase-backed one.
 */
const EMPTY: DB = { messages: [], messageReads: [], profiles: [], sales: [], accounts: [], activities: [], opportunities: [], promotions: [], competitors: [], routePlans: [], routeVisits: [] }
const KEY = 'pg-growth-hub:db:v2'
const USER_KEY = 'pg-growth-hub:user:v1'

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as DB) }
  } catch { /* fall through */ }
  const seed = buildSeed()
  try { localStorage.setItem(KEY, JSON.stringify(seed)) } catch { /* ignore */ }
  return seed
}

interface Ctx {
  user: Profile | null
  isAdmin: boolean
  loading: boolean
  login: (userId: string) => void
  logout: () => void
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, name: string) => Promise<string | null>
  // scoped (role-filtered) data
  profiles: Profile[]
  accounts: Account[]
  activities: Activity[]
  opportunities: Opportunity[]
  promotions: Promotion[]
  competitors: CompetitorRecord[]
  routePlans: RoutePlan[]
  routeVisits: RouteVisit[]
  messages: Message[]
  messageReads: MessageRead[]
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
  sales: SalesRecord[]
  importSales: (recs: NewSales[]) => Promise<{ saved: number; updated: number; activated: number; error?: string }>
  importAccounts: (rows: ImportRow[]) => Promise<{ added: number; failed: number; error?: string }>
  assignAccounts: (ids: string[], repId: string) => { assigned: number; skipped: number }
  sendMessage: (to: string[] | 'all', subject: string, body: string, urgent: boolean) => number
  deleteMessage: (id: string) => void
  markMessagesRead: (ids: string[]) => void
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
  const [db, setDb] = useState<DB>(hasSupabase ? EMPTY : load)
  const [userId, setUserId] = useState<string | null>(() => {
    if (hasSupabase) return null
    try { return localStorage.getItem(USER_KEY) } catch { return null }
  })
  const [loading, setLoading] = useState(hasSupabase)

  useEffect(() => {
    if (hasSupabase) return
    try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* quota */ }
  }, [db])

  /** Supabase mode: reload everything this user is allowed to see (row-level security does the filtering). */
  const refresh = useCallback(async () => {
    try { setDb(await loadAll()) } catch (e) { emitSyncError(e instanceof Error ? e.message : 'Could not load data') }
  }, [])

  useEffect(() => {
    if (!supabase) return
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return
      setUserId(session?.user.id ?? null)
      // never call supabase inside this callback directly (can deadlock) - defer
      if (session) setTimeout(() => { refresh().finally(() => setLoading(false)) }, 0)
      else { setDb(EMPTY); setLoading(false) }
    })
    return () => sub.subscription.unsubscribe()
  }, [refresh])

  // keep reps in sync with each other: refresh when the app comes back to the foreground
  useEffect(() => {
    if (!supabase) return
    let last = Date.now()
    const onVis = () => {
      if (document.visibilityState === 'visible' && Date.now() - last > 20000) { last = Date.now(); void refresh() }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refresh])

  const user = useMemo(() => db.profiles.find(p => p.id === userId && p.active) ?? null, [db.profiles, userId])
  const isAdmin = user?.role === 'admin'

  const login = useCallback((id: string) => {
    setUserId(id)
    try { localStorage.setItem(USER_KEY, id) } catch { /* ignore */ }
  }, [])
  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return 'Supabase is not configured'
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    return error ? error.message : null
  }, [])
  const signUp = useCallback(async (email: string, password: string, name: string) => {
    if (!supabase) return 'Supabase is not configured'
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } })
    if (error) return error.message
    if (!data.session) return 'Check your email to confirm your address, then sign in.'
    return null
  }, [])
  const logout = useCallback(() => {
    if (supabase) { void supabase.auth.signOut(); return }
    setUserId(null)
    try { localStorage.removeItem(USER_KEY) } catch { /* ignore */ }
  }, [])

  // ---- scoped reads ----
  const scoped = useMemo(() => {
    if (!user) return { sales: [], accounts: [], activities: [], opportunities: [], promotions: [], competitors: [], routePlans: [], routeVisits: [], messages: [], messageReads: [] } as Omit<DB, 'profiles'>
    if (isAdmin) return db
    const myAccounts = db.accounts.filter(a => a.repId === user.id && channelAllows(user.channel, a.type))
    const ids = new Set(myAccounts.map(a => a.id))
    const typeOk = (accountId: string) => { const a = db.accounts.find(x => x.id === accountId); return !a || channelAllows(user.channel, a.type) }
    const mine = (repId: string, accountId: string) => ids.has(accountId) || (repId === user.id && typeOk(accountId))
    const myPlans = db.routePlans.filter(p => p.repId === user.id)
    const planIds = new Set(myPlans.map(p => p.id))
    return {
      sales: db.sales.filter(s => ids.has(s.accountId)),
      accounts: myAccounts,
      activities: db.activities.filter(a => mine(a.repId, a.accountId)),
      opportunities: db.opportunities.filter(o => mine(o.repId, o.accountId)),
      promotions: db.promotions.filter(p => p.responsibleId === user.id || p.accountIds.some(i => ids.has(i))),
      competitors: db.competitors.filter(c => mine(c.repId, c.accountId)),
      routePlans: myPlans,
      routeVisits: db.routeVisits.filter(v => planIds.has(v.planId) && ids.has(v.accountId)),
      messages: db.messages.filter(m => m.recipientId === null || m.recipientId === user.id),
      messageReads: db.messageReads.filter(r => r.userId === user.id),
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
    const sageNo = u.role === 'admin' && a.sageNo !== undefined ? a.sageNo.trim() : existing?.sageNo ?? ''
    if (sageNo) {
      const clash = db.accounts.find(x => x.id !== existing?.id && x.sageNo && sageKey(x.sageNo) === sageKey(sageNo))
      if (clash) throw new Error(`Sage customer number ${sageNo} is already used by ${clash.name}`)
    }
    let repId = a.repId ?? existing?.repId ?? u.id
    // reps cannot reassign accounts or create accounts for others
    if (u.role !== 'admin') repId = existing ? existing.repId : u.id
    const finalType = a.type ?? existing?.type ?? 'Retail'
    if (u.role !== 'admin' && !channelAllows(u.channel, finalType)) throw new Error(`Your sales channel is ${u.channel}: you can only work ${u.channel === 'Retail' ? 'Retail' : 'Hotel, Foodservice and Institutional'} accounts`)
    const owner = repId ? db.profiles.find(p => p.id === repId) : undefined
    if (owner && owner.role !== 'admin' && !channelAllows(owner.channel, finalType)) throw new Error(`${owner.name} is a ${owner.channel} rep and cannot be given a ${finalType} account`)
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
      sageNo,
      lastOrderDate: existing?.lastOrderDate ?? null,
    }
    setDb(d => ({ ...d, accounts: existing ? d.accounts.map(x => (x.id === full.id ? full : x)) : [...d.accounts, full] }))
    if (hasSupabase) persist(() => remote.saveAccount(full), refresh)
    return full
  }
  const deleteAccount = (id: string) => {
    needAdmin()
    if (hasSupabase) persist(() => remote.deleteAccount(id), refresh)
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
    if (hasSupabase) persist(() => remote.saveActivity(full), refresh)
    return full
  }
  const deleteActivity = (id: string) => {
    const u = need()
    const ex = db.activities.find(a => a.id === id)
    if (!ex) return
    if (u.role !== 'admin' && ex.repId !== u.id) throw new Error('Permission denied')
    setDb(d => ({ ...d, activities: d.activities.filter(a => a.id !== id) }))
    if (hasSupabase) persist(() => remote.deleteActivity(id), refresh)
  }
  const completeFollowUp = (id: string) => {
    const u = need()
    const ex = db.activities.find(a => a.id === id)
    if (!ex) return
    assertAccount(u, ex.accountId)
    setDb(d => ({ ...d, activities: d.activities.map(a => (a.id === id ? { ...a, followUpDone: true } : a)) }))
    if (hasSupabase) persist(() => remote.saveActivity({ ...ex, followUpDone: true }), refresh)
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
    if (hasSupabase) persist(() => remote.saveOpportunity(full), refresh)
    return full
  }
  const deleteOpportunity = (id: string) => {
    const u = need()
    const ex = db.opportunities.find(o => o.id === id)
    if (!ex) return
    assertAccount(u, ex.accountId)
    setDb(d => ({ ...d, opportunities: d.opportunities.filter(o => o.id !== id) }))
    if (hasSupabase) persist(() => remote.deleteOpportunity(id), refresh)
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
    if (hasSupabase) persist(() => remote.savePromotion(full), refresh)
    return full
  }
  const deletePromotion = (id: string) => {
    const u = need()
    const ex = db.promotions.find(p => p.id === id)
    if (!ex) return
    if (u.role !== 'admin' && ex.responsibleId !== u.id) throw new Error('Permission denied')
    setDb(d => ({ ...d, promotions: d.promotions.filter(p => p.id !== id) }))
    if (hasSupabase) persist(() => remote.deletePromotion(id), refresh)
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
    if (hasSupabase) persist(() => remote.saveCompetitor(full, u.id), refresh)
    return full
  }
  const deleteCompetitor = (id: string) => {
    const u = need()
    const ex = db.competitors.find(c => c.id === id)
    if (!ex) return
    if (u.role !== 'admin' && ex.repId !== u.id) throw new Error('Permission denied')
    setDb(d => ({ ...d, competitors: d.competitors.filter(c => c.id !== id) }))
    if (hasSupabase) persist(() => remote.deleteCompetitor(id), refresh)
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
    if (hasSupabase) persist(() => remote.saveRoutePlan(plan, visits), refresh)
    return plan
  }
  const deleteRoutePlan = (id: string) => {
    const u = need()
    const ex = db.routePlans.find(p => p.id === id)
    if (!ex) return
    if (u.role !== 'admin' && ex.repId !== u.id) throw new Error('Permission denied')
    setDb(d => ({ ...d, routePlans: d.routePlans.filter(p => p.id !== id), routeVisits: d.routeVisits.filter(v => v.planId !== id) }))
    if (hasSupabase) persist(() => remote.deleteRoutePlan(id), refresh)
  }
  const addVisitToPlan = (planId: string, accountId: string) => {
    const u = need()
    const plan = db.routePlans.find(p => p.id === planId)
    if (!plan || (u.role !== 'admin' && plan.repId !== u.id)) throw new Error('Permission denied')
    assertAccount(u, accountId)
    if (db.routeVisits.some(v => v.planId === planId && v.accountId === accountId)) return
    const visit: RouteVisit = { id: uid(), planId, accountId, status: 'Planned', outcome: '', visitedAt: null, createdAt: nowISO() }
    setDb(d => ({ ...d, routeVisits: [...d.routeVisits, visit] }))
    if (hasSupabase) persist(() => remote.saveVisits([visit]), refresh)
  }
  const updateRouteVisit = (id: string, patch: Partial<RouteVisit>) => {
    const u = need()
    const v = db.routeVisits.find(x => x.id === id)
    if (!v) return
    const plan = db.routePlans.find(p => p.id === v.planId)
    if (!plan || (u.role !== 'admin' && plan.repId !== u.id)) throw new Error('Permission denied')
    const next: RouteVisit = { ...v, ...patch, id: v.id, planId: v.planId, accountId: v.accountId }
    let act: Activity | null = null
    // Marking a visit as Visited records a real Customer Visit activity and updates the account.
    if (patch.status === 'Visited' && v.status !== 'Visited') {
      const at = nowISO()
      next.visitedAt = at
      const outcome = patch.outcome || next.outcome || 'Visited'
      act = {
        id: uid(), at, accountId: v.accountId, repId: plan.repId, type: 'Customer Visit',
        summary: patch.outcome || next.outcome || 'Visit completed from route plan.', products: '', outcome,
        nextAction: '', followUpDate: null, followUpDone: false, createdAt: at,
      }
    }
    setDb(d => ({
      ...d,
      accounts: act ? syncAccountFromActivity(d.accounts, act) : d.accounts,
      activities: act ? [act, ...d.activities] : d.activities,
      routeVisits: d.routeVisits.map(x => (x.id === id ? next : x)),
    }))
    if (hasSupabase) persist(async () => { await remote.saveVisits([next]); if (act) await remote.saveActivity(act) }, refresh)
  }
  const removeRouteVisit = (id: string) => {
    const u = need()
    const v = db.routeVisits.find(x => x.id === id)
    if (!v) return
    const plan = db.routePlans.find(p => p.id === v.planId)
    if (!plan || (u.role !== 'admin' && plan.repId !== u.id)) throw new Error('Permission denied')
    setDb(d => ({ ...d, routeVisits: d.routeVisits.filter(x => x.id !== id) }))
    if (hasSupabase) persist(() => remote.deleteVisit(id), refresh)
  }

  const importAccounts: Ctx['importAccounts'] = async rows => {
    needAdmin()
    const maxNo = db.accounts.reduce((m, x) => Math.max(m, parseInt(x.accountNo.replace(/\D/g, '')) || 0), 1000)
    const stamp = nowISO()
    const created: Account[] = rows.map((r, i) => {
      const owner = r.repId ? db.profiles.find(p => p.id === r.repId) : undefined
      const repId = owner && owner.role !== 'admin' && !channelAllows(owner.channel, r.type) ? '' : r.repId   // wrong channel: leave unassigned
      return { ...r, repId, id: uid(), accountNo: `PG-${maxNo + 1 + i}`, createdAt: stamp, isDemo: false }
    })
    if (!hasSupabase) {
      setDb(d => ({ ...d, accounts: [...d.accounts, ...created] }))
      return { added: created.length, failed: 0 }
    }
    let added = 0
    try {
      for (let i = 0; i < created.length; i += 100) {
        const chunk = created.slice(i, i + 100)
        await remote.insertAccounts(chunk)
        added += chunk.length
      }
    } catch (e) {
      await refresh()
      return { added, failed: created.length - added, error: e instanceof Error ? e.message : 'Import failed' }
    }
    await refresh()
    return { added, failed: 0 }
  }
  const importSales: Ctx['importSales'] = async recs => {
    needAdmin()
    const stamp = nowISO()
    const key = (r: { accountId: string; month: string; brand: string }) => `${r.accountId}|${r.month}|${r.brand}`
    const incoming = new Map<string, SalesRecord>(recs.map(r => [key(r), { ...r, id: uid(), importedAt: stamp }]))
    // re-importing a month replaces that customer's figure for that month and brand instead of adding to it
    const merged = [...db.sales.filter(s => !incoming.has(key(s))), ...incoming.values()]
    const { updated, activated } = deriveAccountUpdates(db.accounts, merged)
    if (!hasSupabase) {
      const byId = new Map(updated.map(a => [a.id, a]))
      setDb(d => ({ ...d, sales: merged, accounts: d.accounts.map(a => byId.get(a.id) ?? a) }))
      return { saved: incoming.size, updated: updated.length, activated }
    }
    try {
      await remote.saveSales(recs)
      await remote.upsertAccounts(updated)
    } catch (e) {
      await refresh()
      return { saved: 0, updated: 0, activated: 0, error: e instanceof Error ? e.message : 'Could not save sales' }
    }
    await refresh()
    return { saved: incoming.size, updated: updated.length, activated }
  }
  const assignAccounts: Ctx['assignAccounts'] = (ids, repId) => {
    needAdmin()
    const rep = repId ? db.profiles.find(p => p.id === repId) : undefined
    if (repId && !rep) throw new Error('Choose a sales rep')
    const okIds = ids.filter(id => {
      const a = db.accounts.find(x => x.id === id)
      return !!a && (!rep || rep.role === 'admin' || channelAllows(rep.channel, a.type))
    })
    const set = new Set(okIds)
    if (okIds.length) {
      setDb(d => ({ ...d, accounts: d.accounts.map(a => (set.has(a.id) ? { ...a, repId } : a)) }))
      if (hasSupabase) persist(() => remote.assignAccounts(okIds, repId), refresh)
    }
    return { assigned: okIds.length, skipped: ids.length - okIds.length }
  }

  const saveProfile: Ctx['saveProfile'] = p => {
    needAdmin()
    if (hasSupabase && !p.id) throw new Error('New users create their own login on the sign-in screen (or are invited from Supabase → Authentication). They appear here after first sign-in.')
    const existing = p.id ? db.profiles.find(x => x.id === p.id) : undefined
    const full: Profile = {
      id: existing?.id ?? uid(),
      name: p.name.trim(),
      email: p.email.trim(),
      role: p.role ?? existing?.role ?? 'rep',
      territory: p.territory ?? existing?.territory ?? 'All',
      channel: p.channel ?? existing?.channel ?? 'All',
      active: p.active ?? existing?.active ?? true,
      createdAt: existing?.createdAt ?? nowISO(),
    }
    // never allow removing the last active admin
    if (existing && existing.role === 'admin' && (full.role !== 'admin' || !full.active)) {
      const otherAdmins = db.profiles.filter(x => x.role === 'admin' && x.active && x.id !== existing.id)
      if (!otherAdmins.length) throw new Error('At least one active administrator is required')
    }
    setDb(d => ({ ...d, profiles: existing ? d.profiles.map(x => (x.id === full.id ? full : x)) : [...d.profiles, full] }))
    if (hasSupabase) persist(() => remote.saveProfile(full), refresh)
    return full
  }

  const sendMessage: Ctx['sendMessage'] = (to, subject, body, urgent) => {
    const u = needAdmin()
    if (!body.trim()) throw new Error('Write a message first')
    const reps = db.profiles.filter(p => p.role !== 'admin' && p.active)
    const targets: (string | null)[] = to === 'all' ? [null] : [...new Set(to)].filter(id => reps.some(r => r.id === id))
    if (!targets.length) throw new Error('Choose who to send this to')
    const now = nowISO()
    const list: Message[] = targets.map(t => ({ id: uid(), senderId: u.id, recipientId: t, subject: subject.trim(), body: body.trim(), urgent, createdAt: now }))
    setDb(d => ({ ...d, messages: [...list, ...d.messages] }))
    if (hasSupabase) persist(() => remote.sendMessages(list), refresh)
    return to === 'all' ? reps.length : list.length
  }
  const deleteMessage: Ctx['deleteMessage'] = id => {
    needAdmin()
    setDb(d => ({ ...d, messages: d.messages.filter(m => m.id !== id), messageReads: d.messageReads.filter(r => r.messageId !== id) }))
    if (hasSupabase) persist(() => remote.deleteMessage(id), refresh)
  }
  const markMessagesRead: Ctx['markMessagesRead'] = ids => {
    const u = need()
    const have = new Set(db.messageReads.filter(r => r.userId === u.id).map(r => r.messageId))
    const rows: MessageRead[] = ids.filter(id => !have.has(id) && db.messages.some(m => m.id === id && (m.recipientId === null || m.recipientId === u.id)))
      .map(id => ({ messageId: id, userId: u.id, readAt: nowISO() }))
    if (!rows.length) return
    setDb(d => ({ ...d, messageReads: [...d.messageReads, ...rows] }))
    if (hasSupabase) persist(() => remote.markRead(rows), refresh)
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
    user, isAdmin: !!isAdmin, loading, login, logout, signIn, signUp,
    profiles, ...scoped, repName, accountName,
    saveAccount, deleteAccount, saveActivity, deleteActivity, completeFollowUp,
    saveOpportunity, deleteOpportunity, savePromotion, deletePromotion,
    importAccounts, importSales, assignAccounts, saveCompetitor, deleteCompetitor, saveRoutePlan, deleteRoutePlan, addVisitToPlan,
    updateRouteVisit, removeRouteVisit, sendMessage, deleteMessage, markMessagesRead, saveProfile, resetDemo, clearDemo,
  }
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}
