import type { PriceItem } from '../types'

/**
 * Turns a spoken or typed order ("ten cases of party wings, five twinkies and two kikkoman soy sauce") into order lines
 * by matching words against the price list. It never submits anything: the rep reviews every line first.
 */

const ONES: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 }
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const SIZE_UNITS = new Set(['lb', 'lbs', 'pound', 'pounds', 'oz', 'ounce', 'ounces', 'ml', 'l', 'liter', 'litre', 'liters', 'litres', 'gallon', 'gallons', 'gal', 'ct', 'count', 'g', 'kg', 'gram', 'grams'])
const FILLER = new Set(['of', 'the', 'a', 'an', 'and', 'plus', 'then', 'also', 'with', 'some', 'please', 'case', 'cases', 'box', 'boxes', 'carton', 'cartons', 'ctn', 'pack', 'packs', 'x', 'for', 'order', 'to', 'add', 'get', 'me', 'need', 'want', 'i', 'more', 'another', 'unit', 'units'])

export interface Match { item: PriceItem; score: number }
export interface HeardLine { heard: string; qty: number; qtyGuessed: boolean; matches: Match[]; status: 'ok' | 'check' | 'none' }

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
const stem = (w: string) => (w.length > 4 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)

/** Reads a number starting at tokens[i]. Returns [value, wordsUsed] or null. Handles "twenty five", "a dozen", "half dozen". */
function readNumber(t: string[], i: number): [number, number] | null {
  const w = t[i]
  if (/^\d+$/.test(w)) return [parseInt(w, 10), 1]
  if (w === 'a' && t[i + 1] === 'dozen') return [12, 2]
  if (w === 'half' && t[i + 1] === 'dozen') return [6, 2]
  if (w === 'dozen') return [12, 1]
  if (w === 'couple' || (w === 'a' && t[i + 1] === 'couple')) return [2, w === 'a' ? 3 : 1]
  if (w in TENS) { const nx = t[i + 1]; return nx && nx in ONES && ONES[nx] > 0 && ONES[nx] < 10 ? [TENS[w] + ONES[nx], 2] : [TENS[w], 1] }
  if (w in ONES) return [ONES[w], 1]
  return null
}
/** "a" alone is not a quantity unless it is "a dozen" / "a couple". */
const isQty = (t: string[], i: number) => {
  const n = readNumber(t, i)
  if (!n) return null
  if (SIZE_UNITS.has(t[i + n[1]] ?? '')) return null          // "40 pound": part of the product name, not a quantity
  return n
}

const words = (s: string) => norm(s).split(' ').filter(Boolean).map(stem).filter(w => !FILLER.has(w) && w.length > 1 && !/^\d+$/.test(w))
const near = (a: string, b: string) => a === b || (a.length >= 5 && b.length >= 5 && (a.startsWith(b) || b.startsWith(a) || lev1(a, b)))
function lev1(a: string, b: string) {   // one edit apart (speech recognition often drops or swaps a letter)
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++ }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/** "cup cakes" -> "cupcake": join two spoken words when together they form a word from the price list. */
function joinSplitWords(said: string[], items: PriceItem[]) {
  const vocab = new Set(items.flatMap(i => words(`${i.brand} ${i.product}`)))
  const out: string[] = []
  for (let i = 0; i < said.length; i++) {
    const j = said[i + 1] ? stem(said[i] + said[i + 1]) : ''
    if (j && vocab.has(j) && !(vocab.has(said[i]) && vocab.has(said[i + 1]))) { out.push(j); i++ } else out.push(said[i])
  }
  return out
}

export function matchItems(phrase: string, items: PriceItem[]): Match[] {
  const said = joinSplitWords(words(phrase), items)
  if (!said.length) return []
  const out: Match[] = []
  for (const item of items) {
    const brand = words(item.brand), prod = words(item.product), sku = norm(item.sku).replace(/ /g, '')
    const itemWords = [...new Set([...prod, ...brand])]
    if (!itemWords.length) continue
    let hit = 0, brandHit = 0
    for (const w of said) {
      if (prod.some(p => near(p, w))) hit += 2
      else if (brand.some(b => near(b, w))) { hit += 1; brandHit++ }
      else if (sku && sku === w) hit += 4
    }
    if (!hit) continue
    const coverage = (said.filter(w => itemWords.some(p => near(p, w))).length) / said.length     // how much of what they said is explained
    const completeness = prod.filter(p => said.some(w => near(p, w))).length / (prod.length || 1) // how much of the product name they said
    out.push({ item, score: Math.round((coverage * 0.55 + completeness * 0.45 + brandHit * 0.05) * 100) / 100 })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 4)
}

export function parseOrder(text: string, items: PriceItem[]): HeardLine[] {
  const t = norm(text).split(' ').filter(Boolean)
  // find quantity positions
  const qs: { at: number; len: number; value: number }[] = []
  for (let i = 0; i < t.length; i++) { const n = isQty(t, i); if (n) { qs.push({ at: i, len: n[1], value: n[0] }); i += n[1] - 1 } }
  const segs: { qty: number; guessed: boolean; text: string }[] = []
  const slice = (a: number, b: number) => t.slice(a, b).join(' ')
  if (qs.length && qs[0].at === 0 || (qs.length && slice(0, qs[0].at).split(' ').every(w => FILLER.has(w) || !w))) {
    // quantity first: "ten cases of party wings, five twinkies"
    qs.forEach((q, k) => segs.push({ qty: q.value, guessed: false, text: slice(q.at + q.len, k + 1 < qs.length ? qs[k + 1].at : t.length) }))
  } else if (qs.length) {
    // product first: "party wings ten, twinkies five"
    let from = 0
    qs.forEach(q => { segs.push({ qty: q.value, guessed: false, text: slice(from, q.at) }); from = q.at + q.len })
    if (from < t.length) segs.push({ qty: 1, guessed: true, text: slice(from, t.length) })
  } else if (t.length) segs.push({ qty: 1, guessed: true, text: slice(0, t.length) })   // no number said: assume one

  return segs.filter(s => words(s.text).length).map(s => {
    const matches = matchItems(s.text, items)
    const best = matches[0], second = matches[1]
    const clear = !!best && best.score >= 0.7 && !(second && second.score >= best.score - 0.2)
    const ws = s.text.split(' ')
    while (ws.length && FILLER.has(ws[0])) ws.shift()
    while (ws.length && FILLER.has(ws[ws.length - 1])) ws.pop()
    const cleaned = ws.join(' ')
    return { heard: cleaned || s.text, qty: Math.max(1, s.qty), qtyGuessed: s.guessed, matches, status: !best || best.score < 0.4 ? 'none' : clear ? 'ok' : 'check' } as HeardLine
  })
}
