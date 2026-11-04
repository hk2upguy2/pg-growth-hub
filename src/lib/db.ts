import { supabase } from './supabase'
import {
  Account, Activity, CompetitorRecord, DB, Opportunity, Profile, Promotion, RoutePlan, RouteVisit,
} from '../types'

/**
 * Supabase persistence layer: maps the app's camelCase types to the snake_case tables in
 * supabase/migrations/001_schema.sql. Row-level security (002_rls.sql) decides what each user can
 * read or write; these helpers only move data.
 */
const sb = () => {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}
const fail = (where: string, error: { message: string } | null) => {
  if (error) throw new Error(`${where}: ${error.message}`)
}
export const emitSyncError = (msg: string) => window.dispatchEvent(new CustomEvent('pg-sync-error', { detail: msg }))

let brandIds: Record<string, string> = {}
let brandNames: Record<string, string> = {}

async function fetchAll<T>(table: string, order = 'created_at'): Promise<T[]> {
  const out: T[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await sb().from(table).select('*').order(order, { ascending: true }).range(from, from + page - 1)
    fail(`load ${table}`, error)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < page) break
  }
  return out
}

/* ---------- row <-> app mappers ---------- */
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const num = (v: unknown) => Number(v ?? 0)

const profileFrom = (r: Row): Profile => ({
  id: r.id, name: r.full_name, email: r.email, role: r.role, territory: r.territory, active: r.active, createdAt: r.created_at,
})
const accountFrom = (r: Row): Account => ({
  id: r.id, accountNo: r.account_no, name: r.name, type: r.type, segment: r.segment ?? 'Other', village: r.village,
  address: r.address ?? '', contactName: r.contact_name ?? '', contactPosition: r.contact_position ?? '', phone: r.phone ?? '',
  email: r.email ?? '', repId: r.assigned_rep_id ?? '', priority: r.priority, status: r.status,
  monthlyPotential: num(r.monthly_potential), monthlySales: num(r.monthly_sales),
  currentProducts: r.current_products ?? '', potentialProducts: r.potential_products ?? '', competitor: r.competitor ?? '',
  lastVisit: r.last_visit, nextFollowUp: r.next_follow_up, notes: r.notes ?? '', createdAt: r.created_at, isDemo: r.is_demo,
})
const accountTo = (a: Account): Row => ({
  id: a.id, name: a.name, type: a.type, segment: a.segment, village: a.village, address: a.address,
  contact_name: a.contactName, contact_position: a.contactPosition, phone: a.phone, email: a.email,
  assigned_rep_id: a.repId || null, priority: a.priority, status: a.status,
  monthly_potential: a.monthlyPotential, monthly_sales: a.monthlySales, current_products: a.currentProducts,
  potential_products: a.potentialProducts, competitor: a.competitor, last_visit: a.lastVisit, next_follow_up: a.nextFollowUp,
  notes: a.notes, is_demo: !!a.isDemo,
})
const activityFrom = (r: Row): Activity => ({
  id: r.id, at: r.occurred_at, accountId: r.account_id, repId: r.rep_id, type: r.activity_type, summary: r.summary ?? '',
  products: r.products ?? '', outcome: r.outcome ?? '', nextAction: r.next_action ?? '', followUpDate: r.follow_up_date,
  followUpDone: r.follow_up_done, createdAt: r.created_at,
})
const activityTo = (a: Activity): Row => ({
  id: a.id, account_id: a.accountId, rep_id: a.repId, activity_type: a.type, occurred_at: a.at, summary: a.summary,
  products: a.products, outcome: a.outcome, next_action: a.nextAction, follow_up_date: a.followUpDate, follow_up_done: a.followUpDone,
})
const oppFrom = (r: Row): Opportunity => ({
  id: r.id, accountId: r.account_id, brand: (brandNames[r.brand_id] ?? 'Agrosuper') as Opportunity['brand'], product: r.product_name,
  monthlyValue: num(r.monthly_value), stage: r.stage, probability: Number(r.probability), expectedClose: r.expected_close ?? '',
  repId: r.rep_id, nextAction: r.next_action ?? '', notes: r.notes ?? '', lostReason: r.lost_reason ?? undefined,
  createdAt: r.created_at, isDemo: r.is_demo,
})
const oppTo = (o: Opportunity): Row => ({
  id: o.id, account_id: o.accountId, brand_id: brandIds[o.brand], product_name: o.product, monthly_value: o.monthlyValue,
  stage: o.stage, probability: o.probability, expected_close: o.expectedClose || null, rep_id: o.repId,
  next_action: o.nextAction, notes: o.notes, lost_reason: o.lostReason ?? null, is_demo: !!o.isDemo,
})
const promoFrom = (r: Row, links: Row[]): Promotion => ({
  id: r.id, name: r.name, kind: r.kind, brand: (brandNames[r.brand_id] ?? 'Agrosuper') as Promotion['brand'], supplier: r.supplier ?? '',
  accountIds: links.filter(l => l.promotion_id === r.id).map(l => l.account_id), start: r.start_date, end: r.end_date,
  budget: num(r.budget), expected: r.expected_results ?? '', actual: r.actual_results ?? '', status: r.status,
  responsibleId: r.responsible_id ?? '', createdAt: r.created_at,
})
const promoTo = (p: Promotion): Row => ({
  id: p.id, name: p.name, kind: p.kind, brand_id: brandIds[p.brand], supplier: p.supplier, start_date: p.start, end_date: p.end,
  budget: p.budget, expected_results: p.expected, actual_results: p.actual, status: p.status, responsible_id: p.responsibleId || null,
})
const compFrom = (r: Row, urls: Record<string, string>): CompetitorRecord => ({
  id: r.id, competitor: r.competitor_name, accountId: r.account_id, products: r.products ?? '', price: r.selling_price ?? '',
  promotions: r.promotions ?? '', currentSupplier: r.current_supplier ?? '', observations: r.observations ?? '',
  recordedAt: r.recorded_on, repId: r.rep_id, attachment: r.attachment_path ? urls[r.attachment_path] : undefined,
  attachmentName: r.attachment_path ? String(r.attachment_path).split('/').pop()?.replace(/^[0-9a-f-]{36}-/, '') : undefined,
  createdAt: r.created_at,
})
const planFrom = (r: Row): RoutePlan => ({ id: r.id, date: r.plan_date, repId: r.rep_id, territory: r.territory, notes: r.notes ?? '', createdAt: r.created_at })
const visitFrom = (r: Row): RouteVisit => ({
  id: r.id, planId: r.plan_id, accountId: r.account_id, status: r.status, outcome: r.outcome ?? '', visitedAt: r.visited_at, createdAt: r.created_at,
})

/* ---------- load ---------- */
export async function loadAll(): Promise<DB> {
  const { data: brands, error: be } = await sb().from('brands').select('id,name')
  fail('load brands', be)
  brandIds = Object.fromEntries((brands ?? []).map(b => [b.name, b.id]))
  brandNames = Object.fromEntries((brands ?? []).map(b => [b.id, b.name]))

  const [profiles, accounts, activities, opps, promos, links, comps, plans, visits] = await Promise.all([
    fetchAll<Row>('profiles'), fetchAll<Row>('accounts'), fetchAll<Row>('sales_activities', 'occurred_at'), fetchAll<Row>('opportunities'),
    fetchAll<Row>('promotions'), fetchAll<Row>('promotion_accounts', 'promotion_id'), fetchAll<Row>('competitor_tracking'),
    fetchAll<Row>('route_plans'), fetchAll<Row>('route_visits'),
  ])

  const paths = comps.map(c => c.attachment_path).filter(Boolean) as string[]
  const urls: Record<string, string> = {}
  if (paths.length) {
    const { data } = await sb().storage.from('competitor-attachments').createSignedUrls(paths, 3600)
    ;(data ?? []).forEach(d => { if (d.path && d.signedUrl) urls[d.path] = d.signedUrl })
  }

  return {
    profiles: profiles.map(profileFrom), accounts: accounts.map(accountFrom), activities: activities.map(activityFrom),
    opportunities: opps.map(oppFrom), promotions: promos.map(p => promoFrom(p, links)), competitors: comps.map(c => compFrom(c, urls)),
    routePlans: plans.map(planFrom), routeVisits: visits.map(visitFrom),
  }
}

/* ---------- writes ---------- */
export const remote = {
  async saveAccount(a: Account) { const { error } = await sb().from('accounts').upsert(accountTo(a)); fail('save account', error) },
  async deleteAccount(id: string) { const { error } = await sb().from('accounts').delete().eq('id', id); fail('delete account', error) },
  async saveActivity(a: Activity) { const { error } = await sb().from('sales_activities').upsert(activityTo(a)); fail('save activity', error) },
  async deleteActivity(id: string) { const { error } = await sb().from('sales_activities').delete().eq('id', id); fail('delete activity', error) },
  async saveOpportunity(o: Opportunity) { const { error } = await sb().from('opportunities').upsert(oppTo(o)); fail('save opportunity', error) },
  async deleteOpportunity(id: string) { const { error } = await sb().from('opportunities').delete().eq('id', id); fail('delete opportunity', error) },
  async savePromotion(p: Promotion) {
    const { error } = await sb().from('promotions').upsert(promoTo(p)); fail('save promotion', error)
    const del = await sb().from('promotion_accounts').delete().eq('promotion_id', p.id); fail('save promotion accounts', del.error)
    if (p.accountIds.length) {
      const ins = await sb().from('promotion_accounts').insert(p.accountIds.map(account_id => ({ promotion_id: p.id, account_id })))
      fail('save promotion accounts', ins.error)
    }
  },
  async deletePromotion(id: string) { const { error } = await sb().from('promotions').delete().eq('id', id); fail('delete promotion', error) },
  async saveCompetitor(c: CompetitorRecord, userId: string) {
    let path: string | null = null
    if (c.attachment && c.attachment.startsWith('data:') && c.attachmentName) {
      const blob = await (await fetch(c.attachment)).blob()
      path = `${userId}/${c.id}-${c.attachmentName}`
      const up = await sb().storage.from('competitor-attachments').upload(path, blob, { upsert: true, contentType: blob.type })
      fail('upload attachment', up.error)
    } else if (c.attachment && c.attachmentName) {
      path = `${userId}/${c.id}-${c.attachmentName}` // unchanged existing attachment
    }
    const { error } = await sb().from('competitor_tracking').upsert({
      id: c.id, account_id: c.accountId, rep_id: c.repId, competitor_name: c.competitor, products: c.products, selling_price: c.price,
      promotions: c.promotions, current_supplier: c.currentSupplier, observations: c.observations, recorded_on: c.recordedAt,
      ...(path ? { attachment_path: path } : {}),
    })
    fail('save competitor record', error)
  },
  async deleteCompetitor(id: string) { const { error } = await sb().from('competitor_tracking').delete().eq('id', id); fail('delete competitor record', error) },
  async saveRoutePlan(p: RoutePlan, visits: RouteVisit[]) {
    const { error } = await sb().from('route_plans').upsert({ id: p.id, plan_date: p.date, rep_id: p.repId, territory: p.territory, notes: p.notes })
    fail('save route plan', error)
    if (visits.length) await remote.saveVisits(visits)
  },
  async deleteRoutePlan(id: string) { const { error } = await sb().from('route_plans').delete().eq('id', id); fail('delete route plan', error) },
  async saveVisits(v: RouteVisit[]) {
    const { error } = await sb().from('route_visits').upsert(
      v.map(x => ({ id: x.id, plan_id: x.planId, account_id: x.accountId, status: x.status, outcome: x.outcome, visited_at: x.visitedAt })),
      { onConflict: 'plan_id,account_id' },
    )
    fail('save route visits', error)
  },
  async deleteVisit(id: string) { const { error } = await sb().from('route_visits').delete().eq('id', id); fail('delete route visit', error) },
  async saveProfile(p: Profile) {
    const { error } = await sb().from('profiles').update({ full_name: p.name, role: p.role, territory: p.territory ?? 'All', active: p.active }).eq('id', p.id)
    fail('save user', error)
  },
}

/** Fire a remote write; on failure, tell the user and re-sync from the server so the screen matches reality. */
export function persist(job: () => Promise<void>, resync: () => void) {
  job().catch(e => {
    emitSyncError(e instanceof Error ? e.message : 'Could not save to the server')
    resync()
  })
}
