export type Role = 'rep' | 'admin' | 'service'
export type AccountType = 'Retail' | 'Foodservice' | 'Hotel' | 'Institutional'
export type Priority = 'A+' | 'A' | 'B' | 'C'
export type AccountStatus = 'Prospect' | 'Active' | 'Inactive' | 'On Hold'
export type Territory = 'North' | 'Central' | 'South'
export type BrandName = 'Agrosuper' | 'Hostess' | 'Kikkoman' | 'OxKing' | 'Pampeano' | 'Orion'

/** Sales channel of a rep: Retail reps work Retail accounts; Hospitality reps work Hotel, Foodservice and Institutional accounts. */
export type Channel = 'All' | 'Retail' | 'Hospitality'
export const CHANNELS: Channel[] = ['All', 'Retail', 'Hospitality']
export const channelOfType = (t: AccountType): 'Retail' | 'Hospitality' => (t === 'Retail' ? 'Retail' : 'Hospitality')
export const channelAllows = (channel: Channel | undefined, t: AccountType): boolean => !channel || channel === 'All' || channel === channelOfType(t)

/** Where the customer is. Guam accounts use villages and routes; commissary and other-island customers are worked by phone, visit trips and shipments. */
export type Market = 'Guam' | 'Military' | 'Other Island'
export const MARKETS: Market[] = ['Guam', 'Military', 'Other Island']
export const ISLANDS = ['Saipan', 'Tinian', 'Rota', 'Palau', 'Yap', 'Chuuk', 'Pohnpei', 'Kosrae', 'Marshall Islands', 'Other'] as const
export const marketOf = (a: { market?: Market }): Market => a.market ?? 'Guam'

export const ACCOUNT_TYPES: AccountType[] = ['Retail', 'Foodservice', 'Hotel', 'Institutional']
export const PRIORITIES: Priority[] = ['A+', 'A', 'B', 'C']
export const STATUSES: AccountStatus[] = ['Prospect', 'Active', 'Inactive', 'On Hold']
export const BRANDS: BrandName[] = ['Agrosuper', 'Hostess', 'Kikkoman', 'OxKing', 'Pampeano', 'Orion']

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
  OxKing: ['Corned Beef', 'Other OxKing'],
  Pampeano: ['Corned Beef', 'Other Pampeano'],
  Orion: ['Choco Pie', 'Other Orion'],
}
export const SUPPLIERS: Record<BrandName, string> = {
  Agrosuper: 'Agrosuper', Hostess: 'Hostess Brands', Kikkoman: 'Kikkoman', OxKing: 'OxKing', Pampeano: 'Pampeano', Orion: 'Orion',
}

export const STAGES = [
  'Identified', 'Contacted', 'Sample Delivered', 'Quotation Submitted', 'Negotiation', 'Won', 'Lost',
] as const
export type Stage = (typeof STAGES)[number]
export const STAGE_DEFAULT_PROB: Record<Stage, number> = {
  Identified: 10, Contacted: 25, 'Sample Delivered': 40, 'Quotation Submitted': 55, Negotiation: 75, Won: 100, Lost: 0,
}

/** Written definitions so every rep and manager uses the stages the same way. */
export const STAGE_DEFINITIONS: Record<Stage, string> = {
  Identified: 'A target we believe could buy. No conversation yet.',
  Contacted: 'We have spoken to the decision maker and they agreed to hear more.',
  'Sample Delivered': 'Samples or a product presentation were given and feedback is pending.',
  'Quotation Submitted': 'A written price or quotation is with the customer.',
  Negotiation: 'Price, terms or delivery are being agreed. A first order is likely.',
  Won: 'The customer placed an order for this product.',
  Lost: 'The customer will not buy now. A reason is required.',
}
export const LOST_REASONS = ['Price', 'Existing supplier contract', 'Quality concerns', 'Retailer imports direct', 'No demand', 'Stock availability', 'Other'] as const

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
  channel?: Channel
  active: boolean
  createdAt: string
  lastSeen?: string | null
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
  sageNo?: string
  lastOrderDate?: string | null
  market?: Market
  island?: string
  balanceUpdated?: string | null
  balanceDue?: number
  overdueBalance?: number
  creditLimit?: number // 0 or missing = no limit set
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

export interface SalesRecord {
  id: string
  accountId: string
  month: string // YYYY-MM
  brand: string
  amount: number
  quantity: number | null
  lastDate: string | null
  importedAt: string
}

export interface Message {
  id: string
  senderId: string
  recipientId: string | null // null = all sales reps
  parentId?: string | null    // set on replies: the message this answers
  subject: string
  body: string
  urgent: boolean
  createdAt: string
}
export interface AuditEntry {
  id: string
  at: string
  actorId: string | null
  actorName: string
  action: 'INSERT' | 'UPDATE' | 'DELETE' | string
  entity: string
  recordId: string
  label: string
  changes?: Record<string, [unknown, unknown]> | null
}

export interface RepTarget {
  id: string
  repId: string
  month: string // YYYY-MM
  salesTarget: number
  visitsTarget: number
  newAccountsTarget: number
}
export interface PriceItem { id: string; brand: BrandName; product: string; sku: string; unit: string; price: number; active: boolean; updatedAt: string }
export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined'
export const QUOTE_STATUSES: QuoteStatus[] = ['Draft', 'Sent', 'Accepted', 'Declined']
export interface QuoteLine { brand: BrandName; product: string; sku: string; unit: string; qty: number; price: number; discountPct: number }
export const lineTotal = (l: QuoteLine) => Math.round(l.qty * l.price * (1 - l.discountPct / 100) * 100) / 100
export const quoteTotal = (lines: QuoteLine[]) => Math.round(lines.reduce((n, l) => n + lineTotal(l), 0) * 100) / 100
/** Reps may discount up to this much; anything higher needs management. */
export const MAX_REP_DISCOUNT = 10
export interface Quote {
  id: string; quoteNo: string; accountId: string; repId: string; status: QuoteStatus; validUntil: string; notes: string
  lines: QuoteLine[]; total: number; activityId?: string | null; opportunityId?: string | null; createdAt: string
}
export type OrderStatus = 'Submitted' | 'Confirmed' | 'Delivered' | 'Cancelled'
export const ORDER_STATUSES: OrderStatus[] = ['Submitted', 'Confirmed', 'Delivered', 'Cancelled']
export interface Order {
  id: string; orderNo: string; accountId: string; repId: string; status: OrderStatus; deliveryDate: string; notes: string
  lines: QuoteLine[]; total: number; quoteId?: string | null; createdAt: string
  /** set when the rep changed the order after submitting it, so the office re-checks it */
  editedAt?: string | null
  /** when the office exported it to Sage (so it is not keyed twice) */
  sageExportedAt?: string | null
  /** when the status last changed; reps are told about it */
  statusChangedAt?: string | null
  /** from Sage's Invoice Listing / Open Sales Order Listing (matched on the CRM order number in the PO field) */
  invoiceNo?: string | null
  invoicedAt?: string | null
  invoiceTotal?: number | null
  sageOrderNo?: string | null
}
/** One line of warehouse stock. expiryDate is the soonest expiry among the units on hand. */
export interface StockItem {
  id: string; brand: BrandName; product: string; sku: string; unit: string
  onHand: number; incoming: number; incomingDate: string | null; expiryDate: string | null; updatedAt: string
}
export const PHOTO_TAGS = ['Shelf survey', 'Display check', 'Competitor', 'Delivery / stock', 'Other'] as const
export type PhotoTag = (typeof PHOTO_TAGS)[number]
export interface Photo {
  id: string
  accountId: string
  activityId?: string | null
  repId: string
  tag: PhotoTag
  brand?: BrandName | null
  caption: string
  takenAt: string
  url: string   // data URL in demo mode, short-lived signed URL with Supabase
  path?: string // storage path (Supabase)
}
export interface MessageRead { messageId: string; userId: string; readAt: string }

export interface DB {
  messages: Message[]
  messageReads: MessageRead[]
  targets: RepTarget[]
  priceItems: PriceItem[]
  quotes: Quote[]
  photos: Photo[]
  audit: AuditEntry[]
  profiles: Profile[]
  sales: SalesRecord[]
  accounts: Account[]
  activities: Activity[]
  opportunities: Opportunity[]
  promotions: Promotion[]
  competitors: CompetitorRecord[]
  routePlans: RoutePlan[]
  routeVisits: RouteVisit[]
  orders: Order[]
  stock: StockItem[]
}
