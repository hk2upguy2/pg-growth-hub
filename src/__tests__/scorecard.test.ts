import { describe, it, expect } from 'vitest'
import { incentive } from '../pages/Scorecard'

const r = (o: object) => ({ salesAct: 0, salesT: 0, visits: 0, visitsT: 0, newAcc: 0, newT: 0, ...o })

describe('scorecard score', () => {
  it('hitting every target is 100 and Gold', () => expect(incentive(r({ salesAct: 100, salesT: 100, visits: 20, visitsT: 20, newAcc: 2, newT: 2 }))).toEqual({ score: 100, tier: 'Gold' }))
  it('half of every target is 50, no tier', () => expect(incentive(r({ salesAct: 50, salesT: 100, visits: 10, visitsT: 20, newAcc: 1, newT: 2 }))).toEqual({ score: 50, tier: '' }))
  it('weights sales 60, visits 20, new accounts 20', () => expect(incentive(r({ salesAct: 100, salesT: 100, visits: 0, visitsT: 20, newAcc: 0, newT: 2 })).score).toBe(60))
  it('caps one measure at 120% so it cannot hide the others', () => expect(incentive(r({ salesAct: 500, salesT: 100, visits: 0, visitsT: 20, newAcc: 0, newT: 2 })).score).toBe(72))
  it('measures without a target are ignored', () => expect(incentive(r({ salesAct: 90, salesT: 100 })).score).toBe(90))
  it('no targets at all means no score', () => expect(incentive(r({ salesAct: 90 }))).toEqual({ score: null, tier: '' }))
  it('tier cut-offs: 70 Bronze, 85 Silver, 100 Gold', () => {
    expect(incentive(r({ salesAct: 70, salesT: 100 })).tier).toBe('Bronze')
    expect(incentive(r({ salesAct: 85, salesT: 100 })).tier).toBe('Silver')
    expect(incentive(r({ salesAct: 69, salesT: 100 })).tier).toBe('')
  })
})
