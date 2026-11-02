// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { reduce, initialState, currentText } from '../state'
import { PAIR_FIRST } from '../../../shared/hats'

const loaded = reduce(initialState, { type: 'load', text: 'curl -X POST https://api.io/x \r\n' })

describe('tokeniser state reducer', () => {
  it('load tokenises, assigns hats, enters hats mode and notices the target count', () => {
    expect(loaded.mode).toBe('hats')
    expect(loaded.targetCount).toBe(5)
    expect(loaded.hats.filter(Boolean)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(loaded.notice).toMatch(/5 targets/)
  })

  it('load with empty or whitespace text stays empty', () => {
    const s = reduce(initialState, { type: 'load', text: '  \n' })
    expect(s.mode).toBe('empty')
    expect(s.notice).toBe('Clipboard is empty')
  })

  it('load with empty text in hats mode keeps the current tokens and notices', () => {
    const edited = reduce(reduce(loaded, { type: 'beginEdit', index: 4 }), { type: 'commitEdit', value: 'PUT' })
    const s = reduce(edited, { type: 'load', text: '' })
    expect(s.mode).toBe('hats')
    expect(s.tokens).toBe(edited.tokens)
    expect(s.hats).toBe(edited.hats)
    expect(s.edited).toBe(edited.edited)
    expect(s.editedRanges).toBe(edited.editedRanges)
    expect(s.notice).toBe('Clipboard is empty')
  })

  it('load with empty text in empty mode stays empty and notices', () => {
    const s = reduce(initialState, { type: 'load', text: '' })
    expect(s).toEqual({ ...initialState, notice: 'Clipboard is empty' })
  })

  it('load with text that has no targets enters hats mode with zero hats and notices', () => {
    const s = reduce(loaded, { type: 'load', text: '--verbose / -v' })
    expect(s.mode).toBe('hats')
    expect(currentText(s)).toBe('--verbose / -v')
    expect(s.tokens.length).toBeGreaterThan(0)
    expect(s.tokens.every(t => !t.target)).toBe(true)
    expect(s.targetCount).toBe(0)
    expect(s.hattedCount).toBe(0)
    expect(s.hats.every(h => h === null)).toBe(true)
    expect(s.edited.every(e => e === false)).toBe(true)
    expect(s.notice).toBe('No editable tokens · Tab for text mode')
  })

  it('load is ignored in text mode', () => {
    const t = reduce(loaded, { type: 'enterText', selection: null })
    expect(reduce(t, { type: 'load', text: 'echo hi' })).toBe(t)
    const editing = reduce(loaded, { type: 'beginEdit', index: 0 })
    expect(reduce(editing, { type: 'load', text: 'echo hi' })).toBe(editing)
  })

  it('hatKey with an exact hat enters editing for that token', () => {
    const s = reduce(loaded, { type: 'hatKey', key: 'c' })
    expect(s.mode).toBe('editing')
    expect(s.tokens[s.editingIndex!].text).toBe('https')
  })

  it('hatKey with a prefix sets hatBuf; a second key resolves it', () => {
    const text = Array.from({ length: 30 }, (_, i) => `w${i}`).join(' ')
    const s0 = reduce(initialState, { type: 'load', text })
    const pair = s0.hats.find(h => h && h.length === 2)!
    expect(pair[0]).toBe(PAIR_FIRST[0])
    const s1 = reduce(s0, { type: 'hatKey', key: pair[0] })
    expect(s1.hatBuf).toBe(pair[0])
    expect(s1.mode).toBe('hats')
    const s2 = reduce(s1, { type: 'hatKey', key: pair[1] })
    expect(s2.mode).toBe('editing')
    expect(s2.hatBuf).toBe('')
    expect(s2.hats[s2.editingIndex!]).toBe(pair)
  })

  it('hatKey with no match clears hatBuf and notices', () => {
    const s = reduce(loaded, { type: 'hatKey', key: 'q' })
    expect(s.hatBuf).toBe('')
    expect(s.notice).toMatch(/No hat "q"/)
  })

  it('ignores uppercase, digits and punctuation', () => {
    for (const k of ['A', '1', '-', ' ']) expect(reduce(loaded, { type: 'hatKey', key: k })).toBe(loaded)
  })

  it('beginEdit ignores non-targets and non-hats modes', () => {
    expect(reduce(loaded, { type: 'beginEdit', index: 1 })).toBe(loaded)
    expect(reduce(initialState, { type: 'beginEdit', index: 0 })).toBe(initialState)
  })

  it('commitEdit rescans: added words get hats and the notice reports the delta', () => {
    const s = reduce(reduce(loaded, { type: 'beginEdit', index: 4 }), { type: 'commitEdit', value: 'POST --retry 3' })
    expect(s.mode).toBe('hats')
    expect(s.targetCount).toBe(6)
    expect(s.notice).toMatch(/\+1/)
    expect(s.edited.filter(Boolean)).toHaveLength(2)
    expect(s.flashRange).toEqual({ start: 8, end: 22 })
  })

  it('commitEdit with an unchanged value marks nothing and gives no rescan notice', () => {
    const s = reduce(reduce(loaded, { type: 'beginEdit', index: 4 }), { type: 'commitEdit', value: 'POST' })
    expect(s.mode).toBe('hats')
    expect(s.edited.filter(Boolean)).toHaveLength(0)
    expect(s.notice).toBeNull()
    expect(s.flashRange).toBeNull()
  })

  it('commitEdit that empties the last target drops to empty mode', () => {
    const one = reduce(initialState, { type: 'load', text: 'x' })
    expect(reduce(reduce(one, { type: 'beginEdit', index: 0 }), { type: 'commitEdit', value: '' }).mode).toBe('empty')
  })

  it('commitEdit and cancelEdit outside editing return the same state', () => {
    expect(reduce(loaded, { type: 'commitEdit', value: 'x' })).toBe(loaded)
    expect(reduce(loaded, { type: 'cancelEdit' })).toBe(loaded)
  })

  it('cancelEdit returns to hats with tokens unchanged', () => {
    const editing = reduce(loaded, { type: 'beginEdit', index: 0 })
    const s = reduce(editing, { type: 'cancelEdit' })
    expect(s.mode).toBe('hats')
    expect(s.editingIndex).toBeNull()
    expect(s.tokens).toBe(loaded.tokens)
  })

  it('enterText copies the text into textDraft with the requested selection', () => {
    const s = reduce(loaded, { type: 'enterText', selection: 'all' })
    expect(s.mode).toBe('text')
    expect(s.textDraft).toBe(currentText(loaded))
    expect(s.textSelection).toBe('all')
    expect(currentText(s)).toBe(s.textDraft)
  })

  it('enterText from empty returns the same state', () => {
    expect(reduce(initialState, { type: 'enterText', selection: 'all' })).toBe(initialState)
  })

  it('leaveText rescans the draft and clears edited ranges', () => {
    const edited = reduce(reduce(loaded, { type: 'beginEdit', index: 4 }), { type: 'commitEdit', value: 'PUT' })
    expect(edited.editedRanges.length).toBeGreaterThan(0)
    const s = reduce(reduce(edited, { type: 'enterText', selection: null }), { type: 'leaveText', text: 'a b' })
    expect(s.mode).toBe('hats')
    expect(s.targetCount).toBe(2)
    expect(s.editedRanges).toEqual([])
    expect(s.textDraft).toBe('')
  })

  it('leaveText with empty text returns to empty', () => {
    const t = reduce(loaded, { type: 'enterText', selection: null })
    expect(reduce(t, { type: 'leaveText', text: ' \n' }).mode).toBe('empty')
  })

  it('leaveText with non-empty text that has no targets stays in hats mode with zero hats', () => {
    const t = reduce(loaded, { type: 'enterText', selection: null })
    const s = reduce(t, { type: 'leaveText', text: '--force /' })
    expect(s.mode).toBe('hats')
    expect(currentText(s)).toBe('--force /')
    expect(s.targetCount).toBe(0)
    expect(s.notice).toBe('No editable tokens · Tab for text mode')
  })

  it('notice sets the toast text and clearNotice clears it', () => {
    expect(reduce(loaded, { type: 'notice', text: 'Copied' }).notice).toBe('Copied')
    expect(reduce(loaded, { type: 'clearNotice' }).notice).toBeNull()
  })

  it('hattedCount is capped at 201 and the load notice says "201 of N hatted"', () => {
    const s = reduce(initialState, { type: 'load', text: Array.from({ length: 210 }, (_, i) => `w${i}`).join(' ') })
    expect(s.hattedCount).toBe(201)
    expect(s.targetCount).toBe(210)
    expect(s.notice).toBe('201 of 210 hatted')
  })
})
