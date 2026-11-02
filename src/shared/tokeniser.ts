export interface Token {
  text: string
  kind: 'word' | 'delim'
  target: boolean
  flag: boolean
}

export const WORD_DELIMITERS = /([/=&?:,'"{}[\]\s]+)/

const FLAG = /^-{1,2}[A-Za-z][\w-]*$/

export function tokenise(text: string): Token[] {
  return text
    .split(WORD_DELIMITERS)
    .filter(Boolean)
    .map((part): Token => {
      // split() with a capture group puts delimiter runs at odd indices, but
      // filtering empties shifts them, so detect by content instead.
      const kind = part.replace(new RegExp(WORD_DELIMITERS.source, 'g'), '') === '' ? 'delim' : 'word'
      const flag = kind === 'word' && FLAG.test(part)
      const target = kind === 'word' && !flag && part !== '\\'
      return { text: part, kind, target, flag }
    })
}

export function joinTokens(tokens: Token[]): string {
  return tokens.map(t => t.text).join('')
}

export function tokenStart(tokens: Token[], index: number): number {
  let offset = 0
  for (let i = 0; i < index; i++) offset += tokens[i].text.length
  return offset
}

export function normaliseInput(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n+$/, '')
}

export interface EditedRange {
  start: number
  end: number
}

export interface EditResult {
  text: string
  editedRanges: EditedRange[]
  start: number
  end: number
}

const PLAIN_SPACE = /^[ \t]+$/

function isPlainSpace(token: Token | undefined): boolean {
  return token !== undefined && token.kind === 'delim' && PLAIN_SPACE.test(token.text)
}

export function applyTokenEdit(
  tokens: Token[],
  index: number,
  value: string,
  editedRanges: EditedRange[]
): EditResult {
  const start = tokenStart(tokens, index)
  const oldToken = tokens[index].text
  let oldEnd = start + oldToken.length
  let removed = oldToken.length

  const next = [...tokens]
  next[index] = { ...tokens[index], text: value }
  if (value === '' && isPlainSpace(tokens[index - 1]) && isPlainSpace(tokens[index + 1])) {
    const run = tokens[index + 1].text.length
    next.splice(index + 1, 1)
    oldEnd += run
    removed += run
  }

  const delta = value.length - removed
  const ranges = editedRanges.map(r =>
    r.start >= oldEnd ? { start: r.start + delta, end: r.end + delta } : r
  )
  if (value !== oldToken && value.length > 0) ranges.push({ start, end: start + value.length })

  return { text: joinTokens(next), editedRanges: ranges, start, end: start + value.length }
}

export function markEditedTokens(tokens: Token[], ranges: EditedRange[]): boolean[] {
  let offset = 0
  return tokens.map(t => {
    const s = offset
    const e = offset + t.text.length
    offset = e
    return t.target && ranges.some(r => r.start < e && r.end > s)
  })
}
