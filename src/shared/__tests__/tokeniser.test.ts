// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { tokenise, joinTokens, tokenStart, normaliseInput, applyTokenEdit, markEditedTokens } from '../tokeniser'
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

describe('applyTokenEdit', () => {
  it('replaces the token text and records the edited range', () => {
    const t = tokenise('curl POST x'); const r = applyTokenEdit(t, 2, 'GET', [])
    expect(r.text).toBe('curl GET x'); expect(r.editedRanges).toEqual([{ start: 5, end: 8 }]); expect(r.start).toBe(5); expect(r.end).toBe(8)
  })
  it('shifts later ranges by the length delta', () => {
    const t = tokenise('a b c'); const r = applyTokenEdit(t, 0, 'aaaa', [{ start: 4, end: 5 }])
    expect(r.editedRanges).toEqual([{ start: 7, end: 8 }, { start: 0, end: 4 }])
  })
  it('an unchanged value adds no range', () => { const t = tokenise('a b'); expect(applyTokenEdit(t, 0, 'a', []).editedRanges).toEqual([]) })
  it('emptying a token between two plain space runs removes the following run', () => {
    expect(applyTokenEdit(tokenise('curl -X POST https://x'), 4, '', []).text).toBe('curl -X https://x')
  })
  it('collapses before a backslash continuation when both neighbours are plain spaces', () => {
    expect(applyTokenEdit(tokenise('a POST \\\n  b'), 2, '', []).text).toBe('a \\\n  b')
  })
  it('does not collapse across a newline', () => {
    expect(applyTokenEdit(tokenise('a POST\n  b'), 2, '', []).text).toBe('a \n  b')
  })
  it('does not collapse when a non-space delimiter is adjacent', () => {
    expect(applyTokenEdit(tokenise('a/POST/b'), 2, '', []).text).toBe('a//b')
  })
  it('does not collapse at the start or end of the text', () => {
    expect(applyTokenEdit(tokenise('POST b'), 0, '', []).text).toBe(' b')
  })
  it('emptying a previously edited token drops its range', () => {
    const t = tokenise('a POST b'); const first = applyTokenEdit(t, 2, 'GET', [])
    const second = applyTokenEdit(tokenise(first.text), 2, '', first.editedRanges)
    expect(second.editedRanges).toEqual([])
    expect(markEditedTokens(tokenise(second.text), second.editedRanges)).not.toContain(true)
  })
  it('re-editing an edited token replaces its range', () => {
    const first = applyTokenEdit(tokenise('a POST b'), 2, 'GET', [])
    const second = applyTokenEdit(tokenise(first.text), 2, 'PATCHED', first.editedRanges)
    expect(second.editedRanges).toEqual([{ start: 2, end: 9 }])
  })
  it('a range spanning the edited token is clipped on both sides', () => {
    const r = applyTokenEdit(tokenise('ab cd ef'), 2, 'X', [{ start: 0, end: 8 }])
    expect(r.editedRanges).toEqual([{ start: 0, end: 3 }, { start: 4, end: 7 }, { start: 3, end: 4 }])
  })
  it('range shifting after whitespace collapse', () => {
    const r = applyTokenEdit(tokenise('a POST b c'), 2, '', [{ start: 9, end: 10 }])
    expect(r.text).toBe('a b c'); expect(r.editedRanges).toEqual([{ start: 4, end: 5 }])
  })
})
describe('markEditedTokens', () => {
  it('marks every target overlapping a range and no delimiters', () => {
    const t = tokenise('a --verbose 3'); expect(markEditedTokens(t, [{ start: 0, end: 13 }])).toEqual([true, false, false, false, true])
  })
})
