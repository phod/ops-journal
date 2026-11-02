// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { tokenise, joinTokens, tokenStart, normaliseInput } from '../tokeniser'
import { CURL, DOCKER } from './fixtures/commands'

const targets = (s: string) => tokenise(s).filter(t => t.target).map(t => t.text)

describe('tokeniser', () => {
  it('round-trips any input', () => {
    for (const s of [CURL, DOCKER, 'a  b\n\tc']) expect(joinTokens(tokenise(s))).toBe(s)
  })

  it('splits a UUID out of a URL path', () => {
    expect(targets("'https://api.io/v2/customers/3fa85f64-5717-4562-b3fc-2c963f66afa6/orders'")).toEqual([
      'https', 'api.io', 'v2', 'customers', '3fa85f64-5717-4562-b3fc-2c963f66afa6', 'orders'
    ])
  })

  it('keeps a JWT, a hostname and user@host whole', () => {
    expect(targets('eyJa.eyJb.sig')).toEqual(['eyJa.eyJb.sig'])
    expect(targets('api.acme-platform.io')).toEqual(['api.acme-platform.io'])
    expect(targets('ops@db.internal')).toEqual(['ops@db.internal'])
  })

  it('gives flags and backslash continuations no hat', () => {
    const t = tokenise('curl -X POST --header x \\\n  -d y')
    expect(t.filter(x => x.flag).map(x => x.text)).toEqual(['-X', '--header', '-d'])
    expect(t.filter(x => x.flag).every(x => !x.target)).toBe(true)
    expect(t.find(x => x.text === '\\')!.target).toBe(false)
    expect(t.find(x => x.text === '\\')!.flag).toBe(false)
  })

  it('marks delimiter runs as kind delim and never target', () => {
    const delims = tokenise('a://b, c').filter(x => x.kind === 'delim')
    expect(delims.map(x => x.text)).toEqual(['://', ', '])
    expect(delims.every(x => !x.target && !x.flag)).toBe(true)
  })

  it('tokenStart returns the character offset', () => {
    const t = tokenise('ab cd')
    expect(tokenStart(t, 2)).toBe(3)
  })

  it('normaliseInput converts CRLF and strips trailing newlines', () => {
    expect(normaliseInput('a\r\nb\n\n')).toBe('a\nb')
  })
})
