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
