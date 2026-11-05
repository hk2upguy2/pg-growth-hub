import {
  Account, Activity, ActivityType, BrandName, CompetitorRecord, DB, Opportunity, Priority, Profile,
  Promotion, RoutePlan, RouteVisit, Stage, STAGE_DEFAULT_PROB,
} from '../types'
import { daysAgoStr, daysFromNowStr, addDays, toDateStr } from './utils'

/**
 * ILLUSTRATIVE DEMO DATA ONLY.
 * Business names are used as example records. They are NOT confirmed Pacific Grocers customers,
 * contact details are not verified, and every dollar figure is an illustrative estimate.
 * No actual sales are represented (monthlySales is 0 on every record).
 */
const DEMO_NOTE = 'ILLUSTRATIVE DEMO RECORD – not a confirmed Pacific Grocers customer. Figures are illustrative estimates.'

export function buildSeed(): DB {
  const created = new Date(Date.now() - 100 * 86400000).toISOString()
  const profiles: Profile[] = [
    { id: 'u-admin', name: 'Demo Manager', email: 'manager@demo.pg-growth-hub', role: 'admin', territory: 'All', active: true, createdAt: created },
    { id: 'u-rep1', name: 'Demo Rep A (North)', email: 'rep.a@demo.pg-growth-hub', role: 'rep', territory: 'North', active: true, createdAt: created },
    { id: 'u-rep2', name: 'Demo Rep B (Central)', email: 'rep.b@demo.pg-growth-hub', role: 'rep', territory: 'Central', active: true, createdAt: created },
    { id: 'u-rep3', name: 'Demo Rep C (Hospitality)', email: 'rep.c@demo.pg-growth-hub', role: 'rep', territory: 'Central', active: true, createdAt: created },
  ]

  type A = Omit<Account, 'id' | 'accountNo' | 'createdAt' | 'notes' | 'isDemo' | 'monthlySales' | 'lastVisit' | 'nextFollowUp'> & {
    lastVisitDaysAgo: number | null
    followUpIn: number | null
  }
  const defs: A[] = [
    { name: 'Hyatt Regency Guam', type: 'Hotel', segment: 'Resort Hotel', village: 'Tumon', address: 'Illustrative – address not verified', contactName: 'Demo Contact (F&B Purchasing)', contactPosition: 'Purchasing Manager', phone: '', email: '', repId: 'u-rep3', priority: 'A+', status: 'Prospect', monthlyPotential: 18000, currentProducts: '', potentialProducts: 'Party Wings, Chicken Breast, Kikkoman Foodservice Soy Sauce', competitor: 'Unknown – to verify', lastVisitDaysAgo: 9, followUpIn: 3 } as never,
    { name: 'Dusit Thani Guam Resort', type: 'Hotel', segment: 'Resort Hotel', village: 'Tumon', address: 'Illustrative – address not verified', contactName: 'Demo Contact (Executive Chef)', contactPosition: 'Executive Chef', phone: '', email: '', repId: 'u-rep3', priority: 'A+', status: 'Prospect', monthlyPotential: 15000, currentProducts: '', potentialProducts: 'Chicken Breast, Thighs, Kikkoman Soy Sauce', competitor: 'Unknown – to verify', lastVisitDaysAgo: 21, followUpIn: -2 } as never,
    { name: 'Hilton Guam Resort & Spa', type: 'Hotel', segment: 'Resort Hotel', village: 'Tumon', address: 'Illustrative – address not verified', contactName: 'Demo Contact (Purchasing)', contactPosition: 'Director of Purchasing', phone: '', email: '', repId: 'u-rep3', priority: 'A', status: 'Prospect', monthlyPotential: 14000, currentProducts: '', potentialProducts: 'Whole Chicken, Leg Quarters, Hostess pastry for banquets', competitor: 'Unknown – to verify', lastVisitDaysAgo: 38, followUpIn: 5 } as never,
    { name: 'Pay-Less Supermarkets', type: 'Retail', segment: 'Supermarket', village: 'Tamuning', address: 'Illustrative – address not verified', contactName: 'Demo Contact (Category Buyer)', contactPosition: 'Grocery Buyer', phone: '', email: '', repId: 'u-rep2', priority: 'A+', status: 'Prospect', monthlyPotential: 22000, currentProducts: '', potentialProducts: 'Hostess endcap + new SKUs, Party Wings, Kikkoman range', competitor: 'Unknown – to verify', lastVisitDaysAgo: 6, followUpIn: 1 } as never,
    { name: 'Don Don Donki', type: 'Retail', segment: 'Supermarket', village: 'Tamuning', address: 'Illustrative – address not verified', contactName: 'Demo Contact (Buyer)', contactPosition: 'Merchandising', phone: '', email: '', repId: 'u-rep2', priority: 'A', status: 'On Hold', monthlyPotential: 12000, currentProducts: '', potentialProducts: 'Kikkoman range, Hostess snacks', competitor: 'Direct import (to verify)', lastVisitDaysAgo: 52, followUpIn: -10 } as never,
    { name: 'HappyMart', type: 'Retail', segment: 'Convenience Store', village: 'Dededo', address: 'Illustrative – address not verified', contactName: 'Demo Contact (Owner)', contactPosition: 'Owner / Buyer', phone: '', email: '', repId: 'u-rep1', priority: 'B', status: 'Prospect', monthlyPotential: 4500, currentProducts: '', potentialProducts: 'Hostess product placement, shelf display', competitor: 'Unknown – to verify', lastVisitDaysAgo: 14, followUpIn: 7 } as never,
    { name: 'Cost-U-Less', type: 'Retail', segment: 'Warehouse Club', village: 'Tamuning', address: 'Illustrative – address not verified', contactName: 'Demo Contact (Buyer)', contactPosition: 'Grocery Buyer', phone: '', email: '', repId: 'u-rep2', priority: 'A', status: 'Prospect', monthlyPotential: 16000, currentProducts: '', potentialProducts: 'Whole Chicken, Leg Quarters, Hostess multipacks', competitor: 'Unknown – to verify', lastVisitDaysAgo: 29, followUpIn: 2 } as never,
    { name: 'Jamaican Grill', type: 'Foodservice', segment: 'Chicken Restaurant', village: 'Dededo', address: 'Illustrative – address not verified', contactName: 'Demo Contact (Owner)', contactPosition: 'Owner', phone: '', email: '', repId: 'u-rep1', priority: 'A', status: 'Prospect', monthlyPotential: 6500, currentProducts: '', potentialProducts: 'Party Wings, Drummettes, Leg Quarters, Thighs', competitor: 'Unknown – to verify', lastVisitDaysAgo: 4, followUpIn: 4 } as never,
    { name: "King's Restaurant", type: 'Foodservice', segment: 'Restaurant', village: 'Tamuning', address: 'Illustrative – address not verified', contactName: 'Demo Contact (Manager)', contactPosition: 'Kitchen Manager', phone: '', email: '', repId: 'u-rep2', priority: 'B', status: 'Prospect', monthlyPotential: 5000, currentProducts: '', potentialProducts: 'Chicken Breast, Thighs, Kikkoman soy sauce', competitor: 'Unknown – to verify', lastVisitDaysAgo: 45, followUpIn: null } as never,
    { name: "Shirley's Coffee Shop", type: 'Foodservice', segment: 'Coffee Shop / Diner', village: 'Tamuning', address: 'Illustrative – address not verified', contactName: 'Demo Contact (Manager)', contactPosition: 'Manager', phone: '', email: '', repId: 'u-rep2', priority: 'C', status: 'Inactive', monthlyPotential: 3000, currentProducts: '', potentialProducts: 'Whole Chicken, Hostess pastry', competitor: 'Unknown – to verify', lastVisitDaysAgo: 70, followUpIn: null } as never,
    { name: "Mosa's Joint", type: 'Foodservice', segment: 'Bar', village: 'Dededo', address: 'Illustrative – address not verified', contactName: 'Demo Contact (Owner)', contactPosition: 'Owner', phone: '', email: '', repId: 'u-rep1', priority: 'A', status: 'Prospect', monthlyPotential: 5500, currentProducts: '', potentialProducts: 'Party Wings, Drummettes', competitor: 'Unknown – to verify', lastVisitDaysAgo: 11, followUpIn: 0 } as never,
    { name: 'Pasak Chicken', type: 'Foodservice', segment: 'Korean Restaurant', village: 'Tamuning', address: 'Illustrative – address not verified', contactName: 'Demo Contact (Owner)', contactPosition: 'Owner', phone: '', email: '', repId: 'u-rep2', priority: 'A+', status: 'Prospect', monthlyPotential: 9000, currentProducts: '', potentialProducts: 'Party Wings, Drummettes, Kikkoman soy sauce', competitor: 'Unknown – to verify', lastVisitDaysAgo: 3, followUpIn: 6 } as never,
  ]

  const accounts: Account[] = defs.map((d, i) => {
    const { lastVisitDaysAgo, followUpIn, ...rest } = d as unknown as A & { status2?: unknown }
    delete (rest as { status2?: unknown }).status2
    return {
      ...(rest as Omit<Account, 'id' | 'accountNo' | 'createdAt' | 'notes' | 'isDemo' | 'monthlySales' | 'lastVisit' | 'nextFollowUp'>),
      id: `a-${i + 1}`,
      accountNo: `PG-${String(1001 + i)}`,
      monthlySales: 0,
      lastVisit: lastVisitDaysAgo === null ? null : daysAgoStr(lastVisitDaysAgo),
      nextFollowUp: followUpIn === null ? null : daysFromNowStr(followUpIn),
      notes: DEMO_NOTE,
      createdAt: new Date(Date.now() - (95 - i * 7) * 86400000).toISOString(),
      isDemo: true,
    }
  })
  const byName = (n: string) => accounts.find(a => a.name.startsWith(n))!.id

  const opp = (n: number, account: string, brand: BrandName, product: string, value: number, stage: Stage, rep: string, closeIn: number, next: string, prob?: number, lostReason?: string): Opportunity => ({
    id: `o-${n}`, accountId: byName(account), brand, product, monthlyValue: value, stage,
    probability: prob ?? STAGE_DEFAULT_PROB[stage], expectedClose: daysFromNowStr(closeIn), repId: rep,
    nextAction: next, notes: 'Illustrative estimate – demo record.', lostReason,
    createdAt: new Date(Date.now() - (60 - n * 3) * 86400000).toISOString(), isDemo: true,
  })
  const opportunities: Opportunity[] = [
    opp(1, 'Pasak', 'Agrosuper', 'Party Wings', 4500, 'Sample Delivered', 'u-rep2', 21, 'Collect sample feedback and quote'),
    opp(2, 'Pasak', 'Kikkoman', 'Soy Sauce', 900, 'Contacted', 'u-rep2', 35, 'Send price list'),
    opp(3, "Mosa's", 'Agrosuper', 'Drummettes', 2800, 'Quotation Submitted', 'u-rep1', 14, 'Follow up on quotation'),
    opp(4, 'Jamaican', 'Agrosuper', 'Leg Quarters', 3200, 'Negotiation', 'u-rep1', 10, 'Agree on delivery schedule'),
    opp(5, 'Jamaican', 'Agrosuper', 'Party Wings', 2600, 'Contacted', 'u-rep1', 30, 'Book sampling visit'),
    opp(6, 'Hyatt', 'Agrosuper', 'Party Wings', 7500, 'Sample Delivered', 'u-rep3', 28, 'Chef tasting session'),
    opp(7, 'Hyatt', 'Kikkoman', 'Foodservice Soy Sauce', 2200, 'Identified', 'u-rep3', 60, 'Request current usage'),
    opp(8, 'Dusit', 'Agrosuper', 'Chicken Breast', 5200, 'Quotation Submitted', 'u-rep3', 18, 'Chase quotation response'),
    opp(9, 'Hilton', 'Agrosuper', 'Whole Chicken', 4000, 'Contacted', 'u-rep3', 40, 'Schedule meeting with purchasing'),
    opp(10, 'Pay-Less', 'Hostess', 'Endcap', 6500, 'Negotiation', 'u-rep2', 12, 'Confirm endcap placement dates'),
    opp(11, 'Pay-Less', 'Hostess', 'New SKU', 3500, 'Quotation Submitted', 'u-rep2', 25, 'Present new SKU range'),
    opp(12, 'HappyMart', 'Hostess', 'Product Placement', 1800, 'Won', 'u-rep1', -5, 'Monitor shelf compliance', 100),
    opp(13, 'Cost-U-Less', 'Hostess', 'Promotional Campaign', 5000, 'Contacted', 'u-rep2', 45, 'Propose holiday multipack'),
    opp(14, 'Don Don', 'Kikkoman', 'Teriyaki Sauce', 2400, 'Lost', 'u-rep2', -15, 'Revisit in 6 months', 0, 'Retailer imports direct'),
    opp(15, "King's", 'Kikkoman', 'Soy Sauce', 1200, 'Identified', 'u-rep2', 50, 'Introductory call'),
  ]

  const A: [string, string, ActivityType, number, string, string, string, string, number | null][] = [
    // [account, rep, type, daysAgo, summary, products, outcome, nextAction, followUpIn]
    ['Pasak', 'u-rep2', 'Customer Visit', 3, 'Met owner; discussed wing volumes for weekend trade.', 'Party Wings', 'Interested – agreed to sample', 'Deliver wing samples', 6],
    ['Pasak', 'u-rep2', 'Product Sampling', 12, 'Dropped Party Wings samples for kitchen trial.', 'Party Wings, Drummettes', 'Positive first reaction', 'Collect feedback', null],
    ['Jamaican', 'u-rep1', 'Customer Visit', 4, 'Reviewed current chicken purchasing and pricing.', 'Leg Quarters, Party Wings', 'Open to switching supplier', 'Send updated quotation', 4],
    ['Jamaican', 'u-rep1', 'Quotation', 16, 'Submitted quotation for leg quarters.', 'Leg Quarters', 'Awaiting decision', 'Negotiate delivery terms', null],
    ['Mosa', 'u-rep1', 'Phone Call', 11, 'Called owner about drummettes pricing.', 'Drummettes', 'Requested quotation', 'Submit quotation', 0],
    ['Mosa', 'u-rep1', 'Quotation', 24, 'Sent drummette price sheet.', 'Drummettes', 'Under review', 'Follow up', null],
    ['Hyatt', 'u-rep3', 'Product Presentation', 9, 'Presented Agrosuper range to F&B team.', 'Party Wings, Chicken Breast', 'Requested sample for chef', 'Arrange chef tasting', 3],
    ['Hyatt', 'u-rep3', 'Email', 30, 'Sent introduction and product sheets.', 'Kikkoman, Agrosuper', 'Reply received', 'Book meeting', null],
    ['Dusit', 'u-rep3', 'Quotation', 21, 'Submitted chicken breast quotation.', 'Chicken Breast', 'Awaiting response', 'Chase response', -2],
    ['Dusit', 'u-rep3', 'Customer Visit', 40, 'Introductory visit with executive chef.', 'Chicken Breast, Thighs', 'Positive', 'Prepare quotation', null],
    ['Hilton', 'u-rep3', 'Phone Call', 38, 'Intro call with purchasing office.', 'Whole Chicken', 'Agreed to meet', 'Schedule visit', 5],
    ['Pay-Less', 'u-rep2', 'Negotiation', 6, 'Discussed endcap dates and promo funding.', 'Hostess endcap', 'Positive – pending dates', 'Confirm dates in writing', 1],
    ['Pay-Less', 'u-rep2', 'Product Presentation', 20, 'Presented new Hostess SKUs.', 'Hostess new SKUs', 'Buyer interested', 'Send quotation', null],
    ['Pay-Less', 'u-rep2', 'Customer Visit', 35, 'Shelf audit of snack aisle.', 'Hostess', 'Gaps identified', 'Prepare placement proposal', null],
    ['HappyMart', 'u-rep1', 'New Account Opening', 14, 'Completed placement agreement for Hostess shelf space.', 'Hostess', 'Placement agreed', 'Check shelf compliance', 7],
    ['HappyMart', 'u-rep1', 'Customer Visit', 50, 'Introductory visit.', 'Hostess', 'Interested', 'Propose placement', null],
    ['Cost-U-Less', 'u-rep2', 'Phone Call', 29, 'Spoke with buyer about holiday multipacks.', 'Hostess multipacks', 'Needs proposal', 'Send proposal', 2],
    ['Don Don', 'u-rep2', 'Customer Visit', 52, 'Buyer said Kikkoman is imported direct.', 'Kikkoman', 'No opportunity currently', 'Revisit later', -10],
    ["King's", 'u-rep2', 'Customer Visit', 45, 'Spoke with kitchen manager about chicken cuts.', 'Chicken Breast, Thighs', 'Maybe', 'Call back', null],
    ['Shirley', 'u-rep2', 'Phone Call', 70, 'Owner not purchasing currently.', 'Whole Chicken', 'Not interested now', 'Mark inactive', null],
    ['Pasak', 'u-rep2', 'Email', 60, 'Introduction email with price list.', 'Party Wings', 'Reply received', 'Arrange visit', null],
    ['Jamaican', 'u-rep1', 'Product Sampling', 33, 'Left wing sample.', 'Party Wings', 'Feedback pending', 'Phone follow-up', null],
    ['Hyatt', 'u-rep3', 'Follow-up', 15, 'Followed up on sample request.', 'Party Wings', 'Scheduled tasting', 'Tasting session', null],
    ['Pay-Less', 'u-rep2', 'Phone Call', 55, 'Initial call with category buyer.', 'Hostess', 'Meeting booked', 'Visit store', null],
  ]
  const activities: Activity[] = A.map((r, i) => {
    const d = addDays(new Date(), -r[3]); d.setHours(9 + (i % 7), (i * 13) % 60, 0, 0)
    return {
      id: `act-${i + 1}`, at: d.toISOString(), accountId: byName(r[0]), repId: r[1], type: r[2],
      summary: r[4], products: r[5], outcome: r[6], nextAction: r[7],
      followUpDate: r[8] === null ? null : daysFromNowStr(r[8]), followUpDone: false, createdAt: d.toISOString(),
    }
  })

  const competitors: CompetitorRecord[] = [
    { id: 'c-1', competitor: 'Illustrative Competitor A', accountId: byName('Jamaican'), products: 'Chicken leg quarters', price: '$1.05/lb (illustrative)', promotions: 'Volume discount over 500 lb', currentSupplier: 'Illustrative Competitor A', observations: 'Demo observation: customer reports inconsistent delivery windows.', recordedAt: daysAgoStr(4), repId: 'u-rep1', createdAt: new Date().toISOString() },
    { id: 'c-2', competitor: 'Illustrative Competitor B', accountId: byName('Pasak'), products: 'Chicken wings', price: '$1.60/lb (illustrative)', promotions: 'None observed', currentSupplier: 'Illustrative Competitor B', observations: 'Demo observation: price-sensitive; quality complaints on size.', recordedAt: daysAgoStr(8), repId: 'u-rep2', createdAt: new Date().toISOString() },
    { id: 'c-3', competitor: 'Illustrative Competitor C', accountId: byName('Pay-Less'), products: 'Snack cakes', price: '$3.99 (illustrative)', promotions: 'Buy 2 get 1 free', currentSupplier: 'Illustrative Competitor C', observations: 'Demo observation: competing display near checkout.', recordedAt: daysAgoStr(6), repId: 'u-rep2', createdAt: new Date().toISOString() },
    { id: 'c-4', competitor: 'Direct import', accountId: byName('Don Don'), products: 'Soy sauce range', price: 'n/a', promotions: 'None', currentSupplier: 'Direct import', observations: 'Demo observation: retailer imports Japanese brands directly.', recordedAt: daysAgoStr(52), repId: 'u-rep2', createdAt: new Date().toISOString() },
    { id: 'c-5', competitor: 'Illustrative Competitor A', accountId: byName("Mosa's"), products: 'Drummettes', price: '$1.85/lb (illustrative)', promotions: 'Free delivery', currentSupplier: 'Illustrative Competitor A', observations: 'Demo observation: owner values free delivery.', recordedAt: daysAgoStr(11), repId: 'u-rep1', createdAt: new Date().toISOString() },
  ]

  const promotions: Promotion[] = [
    { id: 'pr-1', name: 'Hostess Holiday Endcap (demo)', kind: 'Retail Promotion', brand: 'Hostess', supplier: 'Hostess Brands', accountIds: [byName('Pay-Less'), byName('Cost-U-Less')], start: daysFromNowStr(14), end: daysFromNowStr(60), budget: 5000, expected: 'Illustrative: +15% velocity on featured SKUs', actual: '', status: 'Planned', responsibleId: 'u-rep2', createdAt: new Date().toISOString() },
    { id: 'pr-2', name: 'Agrosuper Wing Sampling Week (demo)', kind: 'In-store Sampling', brand: 'Agrosuper', supplier: 'Agrosuper', accountIds: [byName('Pasak'), byName("Mosa's"), byName('Jamaican')], start: daysAgoStr(2), end: daysFromNowStr(5), budget: 1500, expected: 'Illustrative: 3 new quotations', actual: '1 quotation so far', status: 'Active', responsibleId: 'u-rep1', createdAt: new Date().toISOString() },
    { id: 'pr-3', name: 'Kikkoman Chef Demo (demo)', kind: 'Supplier-funded Marketing', brand: 'Kikkoman', supplier: 'Kikkoman', accountIds: [byName('Hyatt'), byName('Dusit')], start: daysFromNowStr(30), end: daysFromNowStr(31), budget: 2500, expected: 'Illustrative: introduce foodservice range to hotel chefs', actual: '', status: 'Planned', responsibleId: 'u-rep3', createdAt: new Date().toISOString() },
    { id: 'pr-4', name: 'Hostess Giveaway (demo)', kind: 'Giveaway', brand: 'Hostess', supplier: 'Hostess Brands', accountIds: [byName('HappyMart')], start: daysAgoStr(40), end: daysAgoStr(25), budget: 800, expected: 'Illustrative: trial and awareness', actual: 'Completed – results not recorded', status: 'Completed', responsibleId: 'u-rep1', createdAt: new Date().toISOString() },
  ]

  const planId = 'rp-1'
  const routePlans: RoutePlan[] = [
    { id: planId, date: toDateStr(new Date()), repId: 'u-rep2', territory: 'Central', notes: 'Demo plan for today.', createdAt: new Date().toISOString() },
  ]
  const routeVisits: RouteVisit[] = [
    { id: 'rv-1', planId, accountId: byName('Pay-Less'), status: 'Visited', outcome: 'Demo: confirmed dates verbally.', visitedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
    { id: 'rv-2', planId, accountId: byName('Pasak'), status: 'Planned', outcome: '', visitedAt: null, createdAt: new Date().toISOString() },
    { id: 'rv-3', planId, accountId: byName('Cost-U-Less'), status: 'Planned', outcome: '', visitedAt: null, createdAt: new Date().toISOString() },
  ]

  return { profiles, sales: [], accounts, activities, opportunities, promotions, competitors, routePlans, routeVisits }
}

export const PRIORITY_ORDER: Record<Priority, number> = { 'A+': 0, A: 1, B: 2, C: 3 }
