import React, { useState, useRef, useEffect } from 'react'
import type { Investigation, JournalEntry } from '../../../../shared/ipc-types'

interface Props {
  activeInvestigation: Investigation
  onEntryCreated: (entry: JournalEntry) => void
}

export function EntryInput({ activeInvestigation, onEntryCreated }: Props) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus on mount and whenever the window regains focus
  useEffect(() => {
    textareaRef.current?.focus()
    const onWindowFocus = () => textareaRef.current?.focus()
    window.addEventListener('focus', onWindowFocus)
    return () => window.removeEventListener('focus', onWindowFocus)
  }, [])

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      await submitEntry()
    }
  }

  const submitEntry = async () => {
    const trimmed = value.trim()
    if (!trimmed || submitting) return

    // Optimistic: clear input immediately
    setValue('')
    setSubmitting(true)

    try {
      const entry = await window.electronAPI.createEntry(activeInvestigation.id, trimmed)
      onEntryCreated(entry)
    } catch (err) {
      console.error('[overlay] Failed to create entry:', err)
      // Restore value on error
      setValue(trimmed)
    } finally {
      setSubmitting(false)
      textareaRef.current?.focus()
    }
  }

  return (
    <div className="no-drag px-3 pb-3 pt-2 border-t border-gray-700/50">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a note… (Enter to save, Shift+Enter for newline)"
          rows={3}
          className={`
            no-drag w-full bg-gray-800/80 text-gray-100 placeholder-gray-600
            font-mono text-sm rounded-lg px-3 py-2.5
            border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
            outline-none resize-none transition-colors
          `}
        />
        <div className="absolute bottom-2 right-2 text-xs text-gray-600 select-none pointer-events-none">
          ↵ save
        </div>
      </div>
    </div>
  )
}
