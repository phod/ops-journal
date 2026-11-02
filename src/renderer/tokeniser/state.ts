import {
  tokenise, joinTokens, normaliseInput, applyTokenEdit, markEditedTokens,
  type Token, type EditedRange
} from '../../shared/tokeniser'
import { assignHats, hatMatch } from '../../shared/hats'

export type Mode = 'empty' | 'hats' | 'editing' | 'text'

export interface TokeniserState {
  mode: Mode
  tokens: Token[]
  hats: (string | null)[]
  edited: boolean[]
  editedRanges: EditedRange[]
  hatBuf: string
  editingIndex: number | null
  textDraft: string
  textSelection: 'all' | number | null
  flashRange: { start: number; end: number } | null
  notice: string | null
  targetCount: number
  hattedCount: number
}

export type Action =
  | { type: 'load'; text: string }
  | { type: 'hatKey'; key: string }
  | { type: 'clearHatBuf' }
  | { type: 'beginEdit'; index: number }
  | { type: 'commitEdit'; value: string }
  | { type: 'cancelEdit' }
  | { type: 'enterText'; selection: 'all' | number | null }
  | { type: 'leaveText'; text: string }
  | { type: 'notice'; text: string }
  | { type: 'clearNotice' }

export const initialState: TokeniserState = {
  mode: 'empty',
  tokens: [],
  hats: [],
  edited: [],
  editedRanges: [],
  hatBuf: '',
  editingIndex: null,
  textDraft: '',
  textSelection: null,
  flashRange: null,
  notice: null,
  targetCount: 0,
  hattedCount: 0
}

export function currentText(state: TokeniserState): string {
  return state.mode === 'text' ? state.textDraft : joinTokens(state.tokens)
}

const NO_TARGETS_NOTICE = 'No editable tokens · Tab for text mode'

function isBlank(text: string): boolean {
  return text.trim() === ''
}

/** Only empty/whitespace text collapses to the empty state; zero-target text stays visible in hats mode. */
function rescan(text: string, editedRanges: EditedRange[], prevTargetCount?: number): TokeniserState {
  if (isBlank(text)) return initialState
  const tokens = tokenise(text)
  const targetCount = tokens.filter(t => t.target).length

  const hats = assignHats(tokens)
  const hattedCount = hats.filter(h => h !== null).length

  let notice: string | null = null
  if (targetCount === 0) {
    notice = NO_TARGETS_NOTICE
  } else if (prevTargetCount === undefined) {
    notice = hattedCount < targetCount ? `${hattedCount} of ${targetCount} hatted` : `${targetCount} targets`
  } else if (targetCount !== prevTargetCount) {
    const delta = targetCount - prevTargetCount
    notice = `Rescanned · ${targetCount} targets (${delta > 0 ? '+' : ''}${delta})`
  }

  return {
    ...initialState,
    mode: 'hats',
    tokens,
    hats,
    edited: markEditedTokens(tokens, editedRanges),
    editedRanges,
    notice,
    targetCount,
    hattedCount
  }
}

export function reduce(state: TokeniserState, action: Action): TokeniserState {
  switch (action.type) {
    case 'load': {
      // A late clipboard read must not clobber an edit or the text view
      if (state.mode !== 'empty' && state.mode !== 'hats') return state
      const text = normaliseInput(action.text)
      if (isBlank(text)) return { ...state, notice: 'Clipboard is empty' }
      return rescan(text, [])
    }

    case 'hatKey': {
      if (state.mode !== 'hats' || !/^[a-z]$/.test(action.key)) return state
      const buffer = state.hatBuf + action.key
      const { exact, hasPrefix } = hatMatch(state.hats, buffer)
      if (exact !== null) return { ...state, mode: 'editing', editingIndex: exact, hatBuf: '' }
      if (hasPrefix) return { ...state, hatBuf: buffer }
      return { ...state, hatBuf: '', notice: `No hat "${buffer}"` }
    }

    case 'clearHatBuf':
      return state.hatBuf === '' ? state : { ...state, hatBuf: '' }

    case 'beginEdit':
      if (state.mode !== 'hats' || !state.tokens[action.index]?.target) return state
      return { ...state, mode: 'editing', editingIndex: action.index, hatBuf: '' }

    case 'commitEdit': {
      if (state.mode !== 'editing' || state.editingIndex === null) return state
      const result = applyTokenEdit(state.tokens, state.editingIndex, action.value, state.editedRanges)
      const next = rescan(result.text, result.editedRanges, state.targetCount)
      if (next.mode === 'empty') return next
      const changed = action.value !== state.tokens[state.editingIndex].text
      return { ...next, flashRange: changed ? { start: result.start, end: result.end } : null }
    }

    case 'cancelEdit':
      if (state.mode !== 'editing') return state
      return { ...state, mode: 'hats', editingIndex: null }

    case 'enterText':
      if (state.mode !== 'hats') return state
      return {
        ...state,
        mode: 'text',
        hatBuf: '',
        textDraft: joinTokens(state.tokens),
        textSelection: action.selection
      }

    case 'leaveText':
      if (state.mode !== 'text') return state
      return rescan(normaliseInput(action.text), [])

    case 'notice':
      return { ...state, notice: action.text }

    case 'clearNotice':
      return state.notice === null ? state : { ...state, notice: null }
  }
}
