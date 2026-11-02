import type { Token } from './tokeniser'

export const SINGLE_HATS = 'asdfghjklqwertyuiop'
export const PAIR_FIRST = 'zxcvbnm'
export const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'
export const HAT_CAPACITY = SINGLE_HATS.length + PAIR_FIRST.length * ALPHABET.length // 201

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Uppercase HTTP verbs (GET, POST, ...) are caught first by the SCREAMING_CASE rule (score 20).
const COMMAND_WORDS = new Set([
  'curl', 'docker', 'kubectl', 'aws', 'gcloud', 'run',
  'http', 'https', 'application', 'json'
])

/** Higher = more likely to be edited. First matching rule wins. */
export function scoreToken(text: string): number {
  if (UUID.test(text)) return 100
  if (/^eyJ/.test(text) || text.length > 32) return 90
  if (/^\d+(\.\d+)*$/.test(text)) return 80
  if (/^(true|false|null)$/.test(text)) return 70
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(text)) return 20
  if (COMMAND_WORDS.has(text)) return 5
  return 40 + Math.min(text.length, 20)
}

/** Parallel to tokens; null for non-targets and targets beyond HAT_CAPACITY. */
export function assignHats(tokens: Token[]): (string | null)[] {
  const hats: (string | null)[] = tokens.map(() => null)
  const targets: number[] = []
  tokens.forEach((t, i) => { if (t.target) targets.push(i) })

  if (targets.length <= ALPHABET.length) {
    targets.forEach((idx, k) => { hats[idx] = ALPHABET[k] })
    return hats
  }

  const ranked = targets
    .map((idx, order) => ({ idx, order, score: scoreToken(tokens[idx].text) }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
  ranked.slice(0, SINGLE_HATS.length).forEach((r, k) => { hats[r.idx] = SINGLE_HATS[k] })

  const rest = ranked.slice(SINGLE_HATS.length).sort((a, b) => a.order - b.order)
  const pairCapacity = PAIR_FIRST.length * ALPHABET.length
  rest.forEach((r, k) => {
    if (k < pairCapacity) hats[r.idx] = PAIR_FIRST[Math.floor(k / ALPHABET.length)] + ALPHABET[k % ALPHABET.length]
  })
  return hats
}

export function hatLookup(hats: (string | null)[]): Map<string, number> {
  const map = new Map<string, number>()
  hats.forEach((h, i) => { if (h) map.set(h, i) })
  return map
}

export function hatMatch(hats: (string | null)[], buffer: string): { exact: number | null; hasPrefix: boolean } {
  let exact: number | null = null
  let hasPrefix = false
  hats.forEach((h, i) => {
    if (!h) return
    if (h === buffer) exact = i
    else if (h.startsWith(buffer)) hasPrefix = true
  })
  return { exact, hasPrefix }
}
