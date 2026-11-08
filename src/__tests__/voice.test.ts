import { describe, it, expect } from 'vitest'
import { parseOrder } from '../lib/voiceOrder'
import { mergeResults } from '../components/VoiceButton'
import type { PriceItem } from '../types'

const item = (id: string, brand: PriceItem['brand'], product: string): PriceItem => ({ id, brand, product, sku: id.toUpperCase(), unit: 'case', price: 50, active: true, updatedAt: '' })
const items = [item('pw', 'Agrosuper', 'Party Wings'), item('dm', 'Agrosuper', 'Drummettes'), item('tw', 'Hostess', 'Twinkies'), item('ss', 'Kikkoman', 'Soy Sauce'), item('cc', 'Hostess', 'Cupcakes')]
const pick = (text: string) => parseOrder(text, items).map(l => ({ qty: l.qty, id: l.matches[0]?.item.id, status: l.status }))

describe('say-your-order', () => {
  it('reads a quantity and a product', () => expect(pick('10 cases of party wings')).toEqual([{ qty: 10, id: 'pw', status: 'ok' }]))
  it('reads number words', () => expect(pick('ten cases of party wings')[0]).toMatchObject({ qty: 10, id: 'pw' }))
  it('reads several lines in one go', () => {
    const l = pick('ten cases of party wings, five twinkies and two soy sauce')
    expect(l.map(x => [x.qty, x.id])).toEqual([[10, 'pw'], [5, 'tw'], [2, 'ss']])
  })
  it('understands "a dozen"', () => expect(pick('a dozen twinkies')[0]).toMatchObject({ qty: 12, id: 'tw' }))
  it('forgives a slightly wrong word', () => expect(pick('5 party wing')[0]).toMatchObject({ qty: 5, id: 'pw' }))
  it('joins split words ("cup cakes")', () => expect(pick('3 cup cakes')[0]).toMatchObject({ qty: 3, id: 'cc' }))
  it('marks an unknown product so the rep must check it', () => expect(pick('4 unicorn dust')[0].status).toBe('none'))
  it('uses a taught correction', () => {
    const l = parseOrder('2 wingz', items, { wingz: 'pw' })
    expect(l[0].matches[0].item.id).toBe('pw')
  })
})

describe('phone transcript merging (the duplicate-text bug)', () => {
  it('collapses growing partial phrases into one', () => {
    const heard = ['10', '10 cas', '10 cases', '10 cases of', '10 cases of party', '10 cases of party w', '10 cases of party wings']
    expect(mergeResults(heard)).toBe('10 cases of party wings')
  })
  it('ignores punctuation differences', () => expect(mergeResults(['Ten cases.', 'Ten cases of party.', 'Ten cases of party wings.'])).toBe('Ten cases of party wings.'))
  it('keeps separate sentences', () => expect(mergeResults(['ten cases of party wings', 'five twinkies'])).toBe('Ten cases of party wings five twinkies'))
  it('returns empty text for no speech', () => expect(mergeResults(['', '  '])).toBe(''))
})
