export type Role = 'rep' | 'admin'
export type AccountType = 'Retail' | 'Foodservice' | 'Hotel' | 'Institutional'
export type Priority = 'A+' | 'A' | 'B' | 'C'
export type AccountStatus = 'Prospect' | 'Active' | 'Inactive' | 'On Hold'
export type Territory = 'North' | 'Central' | 'South'
export type BrandName = 'Agrosuper' | 'Hostess' | 'Kikkoman'

export const ACCOUNT_TYPES: AccountType[] = ['Retail', 'Foodservice', 'Hotel', 'Institutional']
export const PRIORITIES: Priority[] = ['A+', 'A', 'B', 'C']
export const STATUSES: AccountStatus[] = ['Prospect', 'Active', 'Inactive', 'On Hold']
export const BRANDS: BrandName[] = ['Agrosuper', 'Hostess', 'Kikkoman']

export const SEGMENTS = [
  'Resort Hotel', 'Supermarket', 'Convenience Store', 'Warehouse Club', 'Bar', 'Restaurant',
  'Korean Restaurant', 'Japanese Restaurant', 'Asian Restaurant', 'Chicken Restaurant',
  'BBQ Restaurant', 'Coffee Shop / Diner', 'Catering', 'Institutional', 'Other',
]

export const VILLAGES: Record<Territory, string[]> = {
  North: ['Yigo', 'Dededo', 'Harmon'],
  Central: ['Tamuning', 'Tumon', 'Barrigada', 'Maite', 'Mangilao', 'Chalan Pago'],
  South: ['Agat', 'Santa Rita', 'Other Southern Village'],
}
export const ALL_VILLAGES = Object.values(VILLAGES).flat()
export function territoryOf(village: string): Territory {
  for (const t of Object.keys(VILLAGES) as Territory[]) if (VILLAGES[t].includes(village)) return t
  return 'South'
}

export const PRODUCTS: Record<BrandName, string[]> = {
  Agrosuper: ['Party Wings', 'Drummettes', 'Chicken Breast', 'Leg Quarters', 'Thighs', 'Whole Chicken'],
  Hostess: ['Product Placement', 'New SKU', 'Shelf Display', 'Endcap', 'Promotional Campaign'],
  Kikkoman: ['Soy Sauce', 'Teriyaki Sauce', 'Foodservice Soy Sauce', 'Panko', 'Other Kikkoman'],
}
export const SUPPLIERS: Record<BrandName, string> = {
  Agrosuper: 'Agrosuper', Hostess: 'Hostess Brands', Kikkoman: 'Kikkoman',
}

export const STAGES = [
  'Identified', 'Contacted', 'Sample Delivered', 'Quotation Submitted', 'Negotiation', 'Won', 'Lost',
] as const
export type Stage = (typeof STAGES)[number]
export const STAGE_DEFAULT_PROB: Record<Stage, number> = {
  Identified: 10, Contacted: 25, 'Sample Delivered': 40, 'Quotation Submitted': 55, Negotiation: 75, Won: 100, Lost: 0,
}

export const ACTIVITY_TYPES = [
  'Customer Visit', 'Phone Call', 'Email', 'Product Presentation', 'Product Sampling',
  'Quotation', 'Negotiation', 'Follow-up', 'New Account Opening',
] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
  territory?: Territory | 'All'
  active: boolean
  createdAt: string
}

export interface Account {
  id: string
  accountNo: string
  name: string
  type: AccountType
  segment: string
  village: string
  address: string
  contactName: string
  contactPosition: string
  phone: string
  email: string
  repId: string
  priority: Priority
  status: AccountStatus
  monthlyPotential: number
  monthlySales: number
  currentProducts: string
  potentialProducts: string
  competitor: string
  lastVisit: string | null
  nextFollowUp: string | null
  notes: string
  createdAt: string
  isDemo?: boolean
}

export interface Activity {
  id: string
  at: string // ISO datetime
  accountId: string
  repId: string
  type: ActivityType
  summary: string
  products: string
  outcome: string
  nextAction: string
  followUpDate: string | null
  followUpDone: boolean
  createdAt: string
}

export interface Opportunity {
  id: string
  accountId: string
  brand: BrandName
  product: string
  monthlyValue: number
  stage: Stage
  probability: number
  expectedClose: string
  repId: string
  nextAction: string
  notes: string
  lostReason?: string
  createdAt: string
  isDemo?: boolean
}

export type PromoStatus = 'Planned' | 'Active' | 'Completed' | 'Cancelled'
export const PROMO_STATUSES: PromoStatus[] = ['Planned', 'Active', 'Completed', 'Cancelled']
export const PROMO_KINDS = [
  'Supplier Promotion', 'Retail Promotion', 'In-store Sampling', 'Product Launch',
  'Seasonal Campaign', 'Giveaway', 'Supplier-funded Marketing',
]
export interface Promotion {
  id: string
  name: string
  kind: string
  brand: BrandName
  supplier: string
  accountIds: string[]
  start: string
  end: string
  budget: number
  expected: string
  actual: string
  status: PromoStatus
  responsibleId: string
  createdAt: string
}

export interface CompetitorRecord {
  id: string
  competitor: string
  accountId: string
  products: string
  price: string
  promotions: string
  currentSupplier: string
  observations: string
  recordedAt: string
  repId: string
  attachment?: string // data URL (demo mode)
  attachmentName?: string
  createdAt: string
}

export interface RoutePlan {
  id: string
  date: string
  repId: string
  territory: Territory | 'All'
  notes: string
  createdAt: string
}
export interface RouteVisit {
  id: string
  planId: string
  accountId: string
  status: 'Planned' | 'Visited' | 'Skipped'
  outcome: string
  visitedAt: string | null
  createdAt: string
}

export interface DB {
  profiles: Profile[]
  accounts: Account[]
  activities: Activity[]
  opportunities: Opportunity[]
  promotions: Promotion[]
  competitors: CompetitorRecord[]
  routePlans: RoutePlan[]
  routeVisits: RouteVisit[]
}
