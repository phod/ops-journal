// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { tokenise } from '../tokeniser'
import { scoreToken, assignHats, hatMatch, hatLookup, PAIR_FIRST } from '../hats'
import { DOCKER } from './fixtures/commands'

describe('hats', () => {
  it('scores by the spec table', () => {
    expect(scoreToken('3fa85f64-5717-4562-b3fc-2c963f66afa6')).toBe(100)
    expect(scoreToken('eyJhbGci.x.y')).toBe(90)
    expect(scoreToken('x'.repeat(33))).toBe(90)
    expect(scoreToken('8080')).toBe(80)
    expect(scoreToken('2.14.3')).toBe(80)
    expect(scoreToken('true')).toBe(70)
    expect(scoreToken('null')).toBe(70)
    expect(scoreToken('DATABASE_URL')).toBe(20)
    expect(scoreToken('GET')).toBe(20)
    expect(scoreToken('curl')).toBe(5)
    expect(scoreToken('json')).toBe(5)
    expect(scoreToken('orders')).toBe(46)
    expect(scoreToken('a'.repeat(30))).toBe(60)
  })

  it('uses single letters a..z in document order for 26 or fewer targets', () => {
    const t = tokenise('one two three')
    expect(assignHats(t).filter(Boolean)).toEqual(['a', 'b', 'c'])
  })

  it('above 26 targets: top 19 scores get SINGLE_HATS, rest are two letters from PAIR_FIRST', () => {
    const t = tokenise(Array.from({ length: 30 }, (_, i) => i < 5 ? `id-${i}`.padEnd(40, 'x') : `w${i}`).join(' '))
    const all = assignHats(t)
    const hats = all.filter((h): h is string => h !== null)
    expect(hats).toHaveLength(30)
    expect(hats.filter(h => h.length === 1)).toHaveLength(19)
    expect(hats.filter(h => h.length === 2).every(h => PAIR_FIRST.includes(h[0]))).toBe(true)
    const longOnes = t.map((tok, i) => tok.text.length === 40 ? all[i] : null).filter(Boolean)
    expect(longOnes).toHaveLength(5)
    expect(longOnes.every(h => h!.length === 1)).toBe(true)
  })

  it('is prefix-free', () => {
    const hats = assignHats(tokenise(DOCKER)).filter(Boolean) as string[]
    expect(hats.length).toBeGreaterThan(26)
    for (const a of hats) for (const b of hats) if (a !== b) expect(b.startsWith(a)).toBe(false)
  })

  it('assigns null past HAT_CAPACITY targets and never three letters', () => {
    const t = tokenise(Array.from({ length: 210 }, (_, i) => `w${i}`).join(' '))
    const hats = assignHats(t)
    expect(hats.filter(Boolean)).toHaveLength(201)
    expect(hats.every(h => h === null || h.length <= 2)).toBe(true)
  })

  it('hatMatch distinguishes exact, prefix and miss', () => {
    const hats = ['a', null, 'zb', null, 'zc']
    expect(hatMatch(hats, 'a')).toEqual({ exact: 0, hasPrefix: false })
    expect(hatMatch(hats, 'z')).toEqual({ exact: null, hasPrefix: true })
    expect(hatMatch(hats, 'zb')).toEqual({ exact: 2, hasPrefix: false })
    expect(hatMatch(hats, 'q')).toEqual({ exact: null, hasPrefix: false })
  })

  it('hatLookup maps hat to token index', () => {
    expect([...hatLookup(['a', null, 'zb'])]).toEqual([['a', 0], ['zb', 2]])
  })
})
