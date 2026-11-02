import { useEffect, useRef } from 'react'

interface InlineEditorProps {
  initialValue: string
  onCommit: (value: string) => void
  onCancel: () => void
}

/** A contentEditable span so the edit wraps within the command's text flow. */
export function InlineEditor({ initialValue, onCommit, onCancel }: InlineEditorProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const done = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.textContent = initialValue
    el.focus()
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(el)
    sel?.removeAllRanges()
    sel?.addRange(range)
    // initialValue is only read on mount; the span owns its text afterwards
  }, [])

  function finish(action: () => void) {
    if (done.current) return
    done.current = true
    action()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLSpanElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const value = ref.current?.textContent ?? ''
      finish(() => onCommit(value))
    } else if (e.key === 'Escape') {
      e.preventDefault()
      finish(onCancel)
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLSpanElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    if (typeof document.execCommand === 'function') {
      document.execCommand('insertText', false, text)
    } else if (ref.current) {
      ref.current.textContent = (ref.current.textContent ?? '') + text
    }
  }

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      data-testid="inline-editor"
      className="inline-editor break-all"
      onKeyDown={handleKeyDown}
      onBlur={() => finish(onCancel)}
      onPaste={handlePaste}
    />
  )
}
