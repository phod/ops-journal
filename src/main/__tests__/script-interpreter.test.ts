import { describe, it, expect } from 'vitest'
import { interpretScript } from '../script-interpreter'

describe('interpretScript', () => {
  it('handles copy() with a string literal', () => {
    const actions = interpretScript('copy("hello");', {})
    expect(actions).toEqual([{ type: 'copy', value: 'hello' }])
  })

  it('handles openLink() with a string literal', () => {
    const actions = interpretScript('openLink("https://example.com");', {})
    expect(actions).toEqual([{ type: 'openLink', value: 'https://example.com' }])
  })

  it('substitutes parameter values', () => {
    const actions = interpretScript('copy(userId);', { userId: 'abc123' })
    expect(actions).toEqual([{ type: 'copy', value: 'abc123' }])
  })

  it('supports variable declaration and concatenation', () => {
    const actions = interpretScript(
      'var url = "https://site.com/" + userId;\nopenLink(url);',
      { userId: '42' }
    )
    expect(actions).toEqual([{ type: 'openLink', value: 'https://site.com/42' }])
  })

  it('supports multiple actions', () => {
    const actions = interpretScript(
      'var supportUrl = "https://site.com/support/" + userId;\ncopy(userPlan);\nopenLink(supportUrl);',
      { userId: 'u123', userPlan: 'PAID' }
    )
    expect(actions).toEqual([
      { type: 'copy', value: 'PAID' },
      { type: 'openLink', value: 'https://site.com/support/u123' }
    ])
  })

  it('supports single-quoted strings', () => {
    const actions = interpretScript("copy('hello');", {})
    expect(actions).toEqual([{ type: 'copy', value: 'hello' }])
  })

  it('supports multi-part concatenation', () => {
    const actions = interpretScript('copy("a" + "b" + "c");', {})
    expect(actions).toEqual([{ type: 'copy', value: 'abc' }])
  })

  it('supports escape sequences in strings', () => {
    const actions = interpretScript('copy("line1\\nline2");', {})
    expect(actions).toEqual([{ type: 'copy', value: 'line1\nline2' }])
  })

  it('ignores single-line comments', () => {
    const actions = interpretScript('// this is a comment\ncopy("ok");', {})
    expect(actions).toEqual([{ type: 'copy', value: 'ok' }])
  })

  it('throws on undefined variable', () => {
    expect(() => interpretScript('copy(missing);', {})).toThrow("Undefined variable: 'missing'")
  })

  it('throws on unknown function call', () => {
    expect(() => interpretScript('doStuff("x");', {})).toThrow("Unknown function: 'doStuff'")
  })

  it('throws on unterminated string', () => {
    expect(() => interpretScript('copy("hello);', {})).toThrow('Unterminated string literal')
  })

  it('throws on unexpected character', () => {
    expect(() => interpretScript('copy(@);', {})).toThrow("Unexpected character: '@'")
  })

  it('handles empty script', () => {
    const actions = interpretScript('', {})
    expect(actions).toEqual([])
  })

  it('handles variable referencing another variable', () => {
    const actions = interpretScript(
      'var a = "hello";\nvar b = a + " world";\ncopy(b);',
      {}
    )
    expect(actions).toEqual([{ type: 'copy', value: 'hello world' }])
  })
})
