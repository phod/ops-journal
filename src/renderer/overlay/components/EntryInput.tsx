import React, { useState, useRef, useEffect } from 'react'
import type { Investigation, JournalEntry } from '../../../../shared/ipc-types'

interface Props {
  activeInvestigation: Investigation
  onEntryCreated: (entry: JournalEntry) => void
}

export function EntryInput({ activeInvestigation, onEntryCreated }: Props) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
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
    if ((!trimmed && !pendingImage) || submitting) return

    const imageToSubmit = pendingImage
    setValue('')
    setPendingImage(null)
    setSubmitting(true)

    try {
      const entry = await window.electronAPI.createEntry(
        activeInvestigation.id,
        trimmed,
        imageToSubmit ?? undefined
      )
      onEntryCreated(entry)
    } catch (err) {
      console.error('[overlay] Failed to create entry:', err)
      setValue(trimmed)
      setPendingImage(imageToSubmit)
    } finally {
      setSubmitting(false)
      textareaRef.current?.focus()
    }
  }

  const handlePickImage = async () => {
    try {
      const dataUrl = await window.electronAPI.pickImage()
      if (dataUrl) setPendingImage(dataUrl)
    } catch (err) {
      console.error('[overlay] Failed to pick image:', err)
    }
  }

  const handleCaptureScreenshot = async () => {
    try {
      const dataUrl = await window.electronAPI.captureScreenshot()
      if (dataUrl) setPendingImage(dataUrl)
    } catch (err) {
      console.error('[overlay] Failed to capture screenshot:', err)
    }
  }

  return (
    <div className="no-drag px-3 pb-3 pt-2 border-t border-gray-700/50">
      {/* Pending image preview */}
      {pendingImage && (
        <div className="relative mb-2 inline-block">
          <img
            src={pendingImage}
            alt="Pending attachment"
            className="max-h-32 rounded border border-gray-600 object-contain"
          />
          <button
            onClick={() => setPendingImage(null)}
            className="no-drag absolute -top-1.5 -right-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full w-4 h-4 flex items-center justify-center text-xs leading-none"
            title="Remove image"
          >
            ×
          </button>
        </div>
      )}

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

      {/* Image toolbar */}
      <div className="flex gap-1.5 mt-1.5">
        <button
          onClick={handlePickImage}
          disabled={submitting}
          className="no-drag flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40 px-1 py-0.5"
          title="Attach image"
        >
          {/* Paperclip icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
          <span>Upload</span>
        </button>
        <button
          onClick={handleCaptureScreenshot}
          disabled={submitting}
          className="no-drag flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40 px-1 py-0.5"
          title="Capture screenshot region"
        >
          {/* Scissors icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="3"/>
            <circle cx="6" cy="18" r="3"/>
            <line x1="20" y1="4" x2="8.12" y2="15.88"/>
            <line x1="14.47" y1="14.48" x2="20" y2="20"/>
            <line x1="8.12" y1="8.12" x2="12" y2="12"/>
          </svg>
          <span>Screenshot</span>
        </button>
      </div>
    </div>
  )
}
