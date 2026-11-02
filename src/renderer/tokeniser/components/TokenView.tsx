import { useEffect, useRef } from 'react'
import type { Token } from '../../../shared/tokeniser'
import { InlineEditor } from './InlineEditor'

interface TokenViewProps {
  tokens: Token[]
  hats: (string | null)[]
  edited: boolean[]
  hatBuf: string
  editingIndex: number | null
  flashRange: { start: number; end: number } | null
  onCommit: (value: string) => void
  onCancel: () => void
  onTokenDoubleClick: (index: number) => void
  onTextClick: (offset: number) => void
}

/** How long a single click waits so a double-click can cancel it. */
const CLICK_DELAY_MS = 220

function Hat({ hat, hatBuf }: { hat: string; hatBuf: string }) {
  const state = hatBuf ? (hat.startsWith(hatBuf) ? ' part' : ' miss') : ''
  return (
    <span data-testid="hat" className={`hat${state}`}>
      <span className="h1">{hat[0]}</span>
      {hat.length > 1 && <span className="h2">{hat.slice(1)}</span>}
    </span>
  )
}

/** Character offset of a click within the whole command. */
function clickOffset(e: React.MouseEvent<HTMLSpanElement>, start: number): number {
  const span = e.currentTarget
  const caret = typeof document.caretRangeFromPoint === 'function'
    ? document.caretRangeFromPoint(e.clientX, e.clientY)
    : null
  if (caret && caret.startContainer.nodeType === Node.TEXT_NODE && caret.startContainer.parentNode === span) {
    return start + caret.startOffset
  }
  return start
}

export function TokenView({
  tokens, hats, edited, hatBuf, editingIndex, flashRange,
  onCommit, onCancel, onTokenDoubleClick, onTextClick
}: TokenViewProps) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearClickTimer() {
    if (clickTimer.current !== null) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
    }
  }

  useEffect(() => clearClickTimer, [])

  let start = 0
  return (
    <div className="cmd">
      {tokens.map((token, i) => {
        const tokStart = start
        start += token.text.length

        function handleClick(e: React.MouseEvent<HTMLSpanElement>) {
          const offset = clickOffset(e, tokStart)
          clearClickTimer()
          clickTimer.current = setTimeout(() => {
            clickTimer.current = null
            onTextClick(offset)
          }, CLICK_DELAY_MS)
        }

        if (!token.target) {
          const cls = token.kind === 'delim' ? 'tok delim' : token.text === '\\' ? 'tok dim' : token.flag ? 'tok flag' : 'tok'
          return <span key={i} className={cls} onClick={handleClick}>{token.text}</span>
        }

        const flash = flashRange !== null && tokStart < flashRange.end && flashRange.start < tokStart + token.text.length
        const cls = `tok target${edited[i] ? ' edited' : ''}${flash ? ' flash' : ''}`
        const hat = hats[i] ?? null

        return (
          <span
            key={i}
            data-testid="token"
            data-hat={hat ?? undefined}
            className={cls}
            onClick={handleClick}
            onDoubleClick={() => {
              clearClickTimer()
              onTokenDoubleClick(i)
            }}
          >
            {hat !== null && <Hat hat={hat} hatBuf={hatBuf} />}
            {i === editingIndex
              ? <InlineEditor initialValue={token.text} onCommit={onCommit} onCancel={onCancel} />
              : token.text}
          </span>
        )
      })}
    </div>
  )
}
