import { useEffect, useRef } from 'react'

interface TextViewProps {
  value: string
  selection: 'all' | number | null
  onChange: (value: string) => void
  onLeave: (value: string) => void
  onCopyClose: (value: string) => void
  onCopyStay: (value: string) => void
}

/** Plain textarea over the whole command; every native editing key works. */
export function TextView({ value, selection, onChange, onLeave, onCopyClose, onCopyStay }: TextViewProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Applied on mount and when the requested selection changes, not on every keystroke
  useEffect(() => {
    const ta = ref.current
    if (!ta) return
    ta.focus()
    if (selection === 'all') {
      ta.select()
    } else {
      const pos = selection ?? ta.value.length
      ta.setSelectionRange(pos, pos)
    }
  }, [selection])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget
    const mod = e.metaKey || e.ctrlKey
    if (e.key === 'Tab' || e.key === 'Escape') {
      e.preventDefault()
      onLeave(ta.value)
    } else if (mod && e.key === 'Enter') {
      e.preventDefault()
      onCopyClose(ta.value)
    } else if (mod && e.key === 'c' && ta.selectionStart === ta.selectionEnd) {
      e.preventDefault()
      onCopyStay(ta.value)
    }
  }

  return (
    <textarea
      ref={ref}
      data-testid="text-editor"
      spellCheck={false}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      className="cmd no-drag w-full h-full resize-none bg-transparent outline-none caret-amber-400"
    />
  )
}
