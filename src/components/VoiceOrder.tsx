import { useEffect, useState } from 'react'
import { Check, Mic } from 'lucide-react'
import { VoiceButton } from './VoiceButton'
import { HeardLine, parseOrder } from '../lib/voiceOrder'
import { QuoteLine, PriceItem } from '../types'
import { money } from '../lib/utils'

const LEARN_KEY = 'pg-growth-hub:voice-aliases:v1'
const readLearned = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(LEARN_KEY) ?? '{}') } catch { return {} } }
const writeLearned = (m: Record<string, string>) => { try { localStorage.setItem(LEARN_KEY, JSON.stringify(m)) } catch { /* storage full or blocked: it just will not remember */ } }
const keyOf = (heard: string) => heard.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * "Say your order": speak or type, check what was understood, then add the lines to the order.
 * Self-contained: to remove the feature, delete this file and its one <VoiceOrder/> line in OrderForm.tsx.
 */
export function VoiceOrder({ items, onAdd }: { items: PriceItem[]; onAdd: (lines: QuoteLine[]) => void }) {
  const [text, setText] = useState('')
  const [heard, setHeard] = useState<(HeardLine & { pick: string; q: number; on: boolean })[] | null>(null)
  const [learned, setLearned] = useState<Record<string, string>>(readLearned)
  useEffect(() => { writeLearned(learned) }, [learned])
  const active = items.filter(i => i.active)
  /** When the phone offers several guesses, keep the one that matches the price list best. */
  const bestGuess = (alts: string[]) => {
    const quality = (t: string) => parseOrder(t, active, learned).reduce((n, l) => n + (l.matches[0]?.score ?? -0.3) * (l.status === 'ok' ? 1 : 0.6), 0)
    return alts.reduce((best, a) => (quality(a) > quality(best) ? a : best), alts[0])
  }

  const read = () => {
    const lines = parseOrder(text, active, learned)
    setHeard(lines.map(l => ({ ...l, pick: l.status === 'none' ? '' : l.matches[0].item.id, q: l.qty, on: l.status !== 'none' })))
  }
  const add = () => {
    const out: QuoteLine[] = []
    for (const h of heard ?? []) {
      const it = items.find(i => i.id === h.pick)
      if (h.on && it && h.q > 0) out.push({ brand: it.brand, product: it.product, sku: it.sku, unit: it.unit, qty: h.q, price: it.price, discountPct: 0 })
    }
    // teach it: when the rep chose a different product than the first guess, remember what they said for next time
    const teach: Record<string, string> = {}
    for (const h of heard ?? []) if (h.on && h.pick && h.heard && h.pick !== h.matches[0]?.item.id) teach[keyOf(h.heard)] = h.pick
    if (Object.keys(teach).length) setLearned(l => ({ ...l, ...teach }))
    if (out.length) { onAdd(out); setText(''); setHeard(null) }
  }
  const upd = (i: number, patch: Partial<{ pick: string; q: number; on: boolean }>) => setHeard(h => h && h.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const ready = (heard ?? []).filter(h => h.on && h.pick && h.q > 0).length

  return (
    <div className="rounded-xl border border-navy-200 bg-navy-50/50 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-navy-900 flex items-center gap-1.5"><Mic size={16} /> Say your order</div>
        <VoiceButton onText={(t, alts) => { const best = alts && alts.length > 1 ? bestGuess(alts) : t; setText(x => (x ? x + ' ' : '') + best); setHeard(null) }} />
      </div>
      <textarea rows={2} className="input" value={text} onChange={e => { setText(e.target.value); setHeard(null) }}
        placeholder="e.g. ten cases of party wings, five twinkies, two kikkoman soy sauce" />
      <div className="flex items-center justify-between gap-2"><div className="text-xs text-slate-500">Wrong word? Fix it in the box, then tap Read. It remembers your corrections.</div><button type="button" className="btn-secondary shrink-0" disabled={!text.trim()} onClick={read}>Read my order</button></div>

      {Object.keys(learned).length > 0 && <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setLearned({})}>Forget the {Object.keys(learned).length} word{Object.keys(learned).length > 1 ? 's' : ''} it learned on this phone</button>}
      {heard && (
        <div className="space-y-2">
          {heard.length === 0 && <div className="text-sm text-slate-600">I could not find any products or quantities. Say it like “ten cases of party wings”.</div>}
          {heard.map((h, i) => (
            <div key={i} className={`rounded-lg border p-2.5 bg-white ${h.status === 'ok' ? 'border-emerald-300' : h.status === 'check' ? 'border-amber-300' : 'border-red-300'}`}>
              <div className="text-xs text-slate-500 mb-1">I heard: “{h.heard}”{h.taught && <span className="text-emerald-700 font-semibold"> · learned from you</span>}{h.status === 'check' && <span className="text-amber-700 font-semibold"> · check this one</span>}{h.status === 'none' && <span className="text-red-600 font-semibold"> · no match, choose a product</span>}{h.qtyGuessed && <span className="text-amber-700"> · no quantity said, check it</span>}</div>
              <div className="flex flex-wrap gap-2 items-center">
                <input type="checkbox" className="h-5 w-5 shrink-0" checked={h.on} onChange={e => upd(i, { on: e.target.checked })} aria-label="Include this line" />
                <input type="number" min="1" className="input !w-20 shrink-0" value={h.q} onChange={e => upd(i, { q: Number(e.target.value) })} aria-label="Quantity" />
                <select className="input basis-full sm:basis-0 sm:flex-1 min-w-0" value={h.pick} onChange={e => upd(i, { pick: e.target.value, on: !!e.target.value })} aria-label="Product">
                  <option value="">Choose a product…</option>
                  {[...new Map([...h.matches.map(m => m.item), ...items.filter(x => x.active)].map(x => [x.id, x])).values()].map(x => <option key={x.id} value={x.id}>{x.brand} · {x.product} ({money(x.price)}/{x.unit})</option>)}
                </select>
              </div>
            </div>))}
          {heard.length > 0 && <div className="flex justify-end"><button type="button" className="btn-primary" disabled={!ready} onClick={add}><Check size={16} /> Add {ready} line{ready === 1 ? '' : 's'} to the order</button></div>}
        </div>)}
    </div>
  )
}
