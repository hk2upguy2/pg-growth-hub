import { sageKey } from './sales'
import { ACCOUNT_TYPES, ALL_VILLAGES, Account, AccountStatus, AccountType, PRIORITIES, Priority, SEGMENTS, STATUSES } from '../types'

export type ImportRow = Omit<Account, 'id' | 'accountNo' | 'createdAt' | 'isDemo'>

export interface FieldDef { key: string; label: string; aliases: string[]; required?: boolean }

export const FIELDS: FieldDef[] = [
  { key: 'name', label: 'Business name', required: true, aliases: ['business name', 'name', 'company', 'company name', 'customer', 'customer name', 'account name', 'account', 'business'] },
  { key: 'sageNo', label: 'Sage customer number', aliases: ['customer number', 'customer no', 'customer #', 'customerno', 'cust no', 'custno', 'sage customer', 'sage customer number', 'customer id', 'account number', 'account no'] },
  { key: 'type', label: 'Account type', aliases: ['account type', 'type', 'category', 'channel'] },
  { key: 'segment', label: 'Business segment', aliases: ['segment', 'business segment', 'sub category', 'subcategory', 'business type'] },
  { key: 'village', label: 'Village / location', aliases: ['village', 'location', 'city', 'area', 'municipality', 'town'] },
  { key: 'address', label: 'Physical address', aliases: ['address', 'physical address', 'street', 'street address'] },
  { key: 'contactName', label: 'Contact person', aliases: ['contact', 'contact person', 'contact name', 'owner', 'buyer'] },
  { key: 'contactPosition', label: 'Contact position', aliases: ['position', 'contact position', 'title', 'job title'] },
  { key: 'phone', label: 'Phone', aliases: ['phone', 'phone number', 'telephone', 'tel', 'mobile', 'contact number'] },
  { key: 'email', label: 'Email', aliases: ['email', 'e-mail', 'email address'] },
  { key: 'rep', label: 'Sales rep (name or email)', aliases: ['sales rep', 'rep', 'assigned rep', 'salesperson', 'sales person', 'assigned sales representative', 'representative', 'account manager'] },
  { key: 'priority', label: 'Priority (A+, A, B, C)', aliases: ['priority', 'account priority', 'rank'] },
  { key: 'status', label: 'Status', aliases: ['status', 'account status'] },
  { key: 'monthlyPotential', label: 'Est. monthly potential ($)', aliases: ['monthly potential', 'estimated monthly potential', 'potential', 'est monthly potential'] },
  { key: 'monthlySales', label: 'Actual monthly sales ($)', aliases: ['monthly sales', 'actual monthly sales', 'sales'] },
  { key: 'currentProducts', label: 'Products currently purchased', aliases: ['current products', 'products purchased', 'products currently purchased', 'products'] },
  { key: 'potentialProducts', label: 'Potential products', aliases: ['potential products', 'target products', 'opportunity'] },
  { key: 'competitor', label: 'Competitor / current supplier', aliases: ['competitor', 'current supplier', 'supplier', 'competitor supplier'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'comments', 'remarks'] },
]

export const TEMPLATE_HEADERS = [
  'Business Name', 'Account Type', 'Business Segment', 'Village', 'Address', 'Contact Person', 'Contact Position',
  'Phone', 'Email', 'Sales Rep', 'Priority', 'Status', 'Estimated Monthly Potential', 'Actual Monthly Sales',
  'Products Currently Purchased', 'Potential Products', 'Competitor / Current Supplier', 'Notes',
]

/** Reads CSV text (comma, semicolon or tab separated, quoted fields, Excel BOM). */
export function parseCSV(input: string): string[][] {
  let text = input
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const delim = [',', ';', '\t']
    .map(d => ({ d, n: first.split(d).length }))
    .sort((a, b) => b.n - a.n)[0].d
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false
      } else cell += c
    } else if (c === '"') quoted = true
    else if (c === delim) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(x => x.trim() !== ''))
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Guess which file column feeds each field. -1 = not mapped. */
export function autoMap(headers: string[], fields: FieldDef[] = FIELDS): Record<string, number> {
  const h = headers.map(norm)
  const used = new Set<number>()
  const map: Record<string, number> = {}
  for (const f of fields) {
    const aliases = f.aliases.map(norm)
    let idx = h.findIndex((x, i) => !used.has(i) && aliases.includes(x))
    if (idx < 0) idx = h.findIndex((x, i) => !used.has(i) && x.length > 2 && aliases.some(a => a.length > 3 && (x.includes(a) || a.includes(x))))
    map[f.key] = idx
    if (idx >= 0) used.add(idx)
  }
  return map
}

const has = (s: string, ...words: string[]) => words.some(w => s.includes(w))

function normType(raw: string): AccountType | null {
  const s = raw.toLowerCase().trim()
  if (!s) return null
  const exact = ACCOUNT_TYPES.find(t => t.toLowerCase() === s)
  if (exact) return exact
  if (has(s, 'hotel', 'resort', 'hospitality')) return 'Hotel'
  if (has(s, 'institution', 'school', 'hospital', 'government', 'military', 'church', 'prison', 'university')) return 'Institutional'
  if (has(s, 'retail', 'grocery', 'supermarket', 'store', 'market', 'convenience', 'warehouse', 'mart')) return 'Retail'
  if (has(s, 'food', 'restaurant', 'bar', 'cafe', 'coffee', 'cater', 'diner', 'grill', 'bbq', 'kitchen')) return 'Foodservice'
  return null
}

function normSegment(raw: string): string | null {
  const s = raw.toLowerCase().trim()
  if (!s) return null
  const exact = SEGMENTS.find(x => x.toLowerCase() === s)
  if (exact) return exact
  if (has(s, 'resort', 'hotel')) return 'Resort Hotel'
  if (has(s, 'korean')) return 'Korean Restaurant'
  if (has(s, 'japan', 'sushi', 'ramen')) return 'Japanese Restaurant'
  if (has(s, 'bbq', 'barbecue', 'barbeque')) return 'BBQ Restaurant'
  if (has(s, 'chicken', 'wings')) return 'Chicken Restaurant'
  if (has(s, 'asian', 'chinese', 'thai', 'filipino', 'vietnam')) return 'Asian Restaurant'
  if (has(s, 'cater')) return 'Catering'
  if (has(s, 'coffee', 'cafe', 'diner', 'bakery')) return 'Coffee Shop / Diner'
  if (has(s, 'restaurant', 'grill', 'kitchen', 'eatery')) return 'Restaurant'
  if (/\bbars?\b/.test(s) || has(s, 'pub', 'lounge', 'nightclub', 'tavern')) return 'Bar'
  if (has(s, 'warehouse', 'club')) return 'Warehouse Club'
  if (has(s, 'convenience', 'gas', 'mini mart', 'minimart')) return 'Convenience Store'
  if (has(s, 'supermarket', 'grocery', 'market')) return 'Supermarket'
  if (has(s, 'institution', 'school', 'hospital', 'government', 'military')) return 'Institutional'
  return null
}

function typeFromSegment(seg: string): AccountType | null {
  if (['Supermarket', 'Convenience Store', 'Warehouse Club'].includes(seg)) return 'Retail'
  if (seg === 'Resort Hotel') return 'Hotel'
  if (seg === 'Institutional') return 'Institutional'
  if (seg === 'Other') return null
  return 'Foodservice'
}

function normVillage(raw: string): string | null {
  const s = norm(raw)
  if (!s) return null
  const hit = ALL_VILLAGES.find(v => norm(v) === s)
  if (hit) return hit
  const alias: Record<string, string> = { agana: '', hagatna: '', chalanpago: 'Chalan Pago', ordot: '', mongmongtotomaite: 'Maite', maitemongmong: 'Maite', santarita: 'Santa Rita', sntarita: 'Santa Rita' }
  if (alias[s]) return alias[s]
  const partial = ALL_VILLAGES.find(v => v !== 'Other Southern Village' && s.includes(norm(v)))
  return partial ?? null
}

const normPriority = (raw: string): Priority | null => {
  const s = raw.toUpperCase().replace(/\s+/g, '').replace('PLUS', '+')
  return (PRIORITIES as string[]).includes(s) ? (s as Priority) : null
}
function normStatus(raw: string): AccountStatus | null {
  const s = raw.toLowerCase().trim()
  if (!s) return null
  const exact = STATUSES.find(x => x.toLowerCase() === s)
  if (exact) return exact
  if (has(s, 'inactive', 'closed', 'lost', 'dormant')) return 'Inactive'
  if (has(s, 'hold', 'pause')) return 'On Hold'
  if (has(s, 'active', 'customer', 'current')) return 'Active'
  if (has(s, 'prospect', 'lead', 'new', 'target')) return 'Prospect'
  return null
}
const money = (v: string) => {
  const n = Number(v.replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export interface ImportSettings {
  defaultType: AccountType
  defaultStatus: AccountStatus
  defaultRepId: string // '' = leave unassigned
}
export interface Prepared {
  line: number // line number in the file (header = 1)
  data: ImportRow | null
  errors: string[]
  warnings: string[]
  duplicate: boolean
}

export const dupeKey = (name: string, village: string, address: string) => `${norm(name)}|${norm(village)}|${norm(address)}`

export function prepare(
  rows: string[][], mapping: Record<string, number>, settings: ImportSettings,
  reps: { id: string; name: string; email: string }[], existing: (Pick<Account, 'name' | 'village' | 'address'> & { sageNo?: string })[],
): Prepared[] {
  const seen = new Set(existing.map(a => dupeKey(a.name, a.village, a.address)))
  const seenSage = new Set(existing.filter(a => a.sageNo).map(a => sageKey(a.sageNo!)))
  const repByName = new Map(reps.map(r => [norm(r.name), r.id]))
  const repByEmail = new Map(reps.map(r => [r.email.toLowerCase(), r.id]))

  return rows.map((r, i) => {
    const get = (k: string) => (mapping[k] >= 0 ? (r[mapping[k]] ?? '').trim() : '')
    const errors: string[] = []
    const warnings: string[] = []
    const name = get('name')
    if (!name) errors.push('Business name is empty')

    let notes = get('notes')
    const addNote = (t: string) => { notes = notes ? `${notes}\n${t}` : t }

    // segment and type
    const segRaw = get('segment')
    let segment = normSegment(segRaw)
    if (segRaw && !segment) { segment = 'Other'; addNote(`Segment (as imported): ${segRaw}`); warnings.push(`Segment “${segRaw}” not recognised, set to Other`) }
    const typeRaw = get('type')
    let type = normType(typeRaw)
    if (!type && segment) type = typeFromSegment(segment)
    if (!type) { type = settings.defaultType; warnings.push(typeRaw ? `Type “${typeRaw}” not recognised, used ${type}` : `No type, used ${type}`) }

    // village
    const villRaw = get('village')
    let village = normVillage(villRaw)
    if (!village) {
      village = 'Other Southern Village'
      if (villRaw) { addNote(`Village (as imported): ${villRaw}`); warnings.push(`Village “${villRaw}” not in the Guam list, set to Other Southern Village`) }
      else warnings.push('No village, set to Other Southern Village')
    }

    // rep
    const repRaw = get('rep')
    let repId = settings.defaultRepId
    if (repRaw) {
      const found = repByEmail.get(repRaw.toLowerCase()) ?? repByName.get(norm(repRaw))
        ?? reps.find(x => norm(x.name).includes(norm(repRaw)) && norm(repRaw).length > 2)?.id
      if (found) repId = found
      else warnings.push(`Rep “${repRaw}” not found, ${settings.defaultRepId ? 'used default rep' : 'left unassigned'}`)
    }

    const prRaw = get('priority')
    const priority = normPriority(prRaw) ?? 'B'
    if (prRaw && !normPriority(prRaw)) warnings.push(`Priority “${prRaw}” not recognised, set to B`)
    const stRaw = get('status')
    const status = normStatus(stRaw) ?? settings.defaultStatus
    if (stRaw && !normStatus(stRaw)) warnings.push(`Status “${stRaw}” not recognised, used ${status}`)

    const address = get('address')
    const key = dupeKey(name, village, address)
    const sageNo = get('sageNo')
    let duplicate = false
    if (name) {
      const sk = sageNo ? sageKey(sageNo) : ''
      if ((sk && seenSage.has(sk)) || seen.has(key)) duplicate = true
      else { seen.add(key); if (sk) seenSage.add(sk) }
    }

    const data: ImportRow | null = errors.length ? null : {
      name, sageNo, type, segment: segment ?? 'Other', village, address,
      contactName: get('contactName'), contactPosition: get('contactPosition'), phone: get('phone'), email: get('email'),
      repId, priority, status,
      monthlyPotential: money(get('monthlyPotential')), monthlySales: money(get('monthlySales')),
      currentProducts: get('currentProducts'), potentialProducts: get('potentialProducts'), competitor: get('competitor'),
      lastVisit: null, nextFollowUp: null, notes,
    }
    return { line: i + 2, data, errors, warnings, duplicate }
  })
}
