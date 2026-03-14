import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import type { Investigation, JournalEntry, EntryType } from '@shared/ipc-types'
import { MAX_IMAGES_PER_ENTRY } from '@shared/ipc-types'
import type { EntryTypeDefinition } from '@shared/entry-types'
import { getEntryTypeDefinition } from '@shared/entry-types'
import { getCompletions, parseSlashCommand } from '@shared/slash-commands'

const symbolMap: Record<string, string> = {
  CommandOrControl: '⌘',
  Command: '⌘',
  Control: '⌃',
  Alt: '⌥',
  Shift: '⇧'
}

function toHotkeyHint(accelerator: string): string {
  return accelerator
    .split('+')
    .map((part) => symbolMap[part] ?? part)
    .join('')
}

interface Props {
  activeInvestigation: Investigation
  entries: JournalEntry[]
  editingEntryId: string | null
  onSetEditingEntryId: (id: string | null) => void
  onEntryCreated: (entry: JournalEntry) => void
  pendingImages: string[]
  onPendingImagesChange: (images: string[]) => void
}

export function EntryInput({ activeInvestigation, entries, editingEntryId, onSetEditingEntryId, onEntryCreated, pendingImages, onPendingImagesChange }: Props) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [screenshotHint, setScreenshotHint] = useState<string | null>(null)
  const [uploadHint, setUploadHint] = useState<string | null>(null)
  const [completions, setCompletions] = useState<EntryTypeDefinition[]>([])
  const [selectedCompletionIndex, setSelectedCompletionIndex] = useState(0)
  const [detectedType, setDetectedType] = useState<EntryType>('note')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prevEditingEntryIdRef = useRef<string | null>(null)

  const atLimit = pendingImages.length >= MAX_IMAGES_PER_ENTRY

  useEffect(() => {
    window.electronAPI.getScreenshotHotkey().then((hk) => setScreenshotHint(toHotkeyHint(hk)))
    window.electronAPI.getUploadHotkey().then((hk) => setUploadHint(toHotkeyHint(hk)))
  }, [])

  // Focus on mount and whenever the window regains focus
  useEffect(() => {
    textareaRef.current?.focus()
    const onWindowFocus = () => textareaRef.current?.focus()
    window.addEventListener('focus', onWindowFocus)
    return () => window.removeEventListener('focus', onWindowFocus)
  }, [])

  // Refocus textarea when a row's edit mode ends
  useEffect(() => {
    if (prevEditingEntryIdRef.current !== null && editingEntryId === null) {
      textareaRef.current?.focus()
    }
    prevEditingEntryIdRef.current = editingEntryId
  }, [editingEntryId])

  const handleValueChange = (newValue: string) => {
    setValue(newValue)
    const newCompletions = getCompletions(newValue.trimStart())
    setCompletions(newCompletions)
    setSelectedCompletionIndex(0)
    setDetectedType(parseSlashCommand(newValue.trim()).type)
  }

  const applyCompletion = (def: EntryTypeDefinition) => {
    const cmd = def.command! + ' '
    setValue(cmd)
    setDetectedType(def.type)
    setCompletions([])
    textareaRef.current?.focus()
  }

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (completions.length > 0) {
      if (e.key === 'Tab') {
        e.preventDefault()
        applyCompletion(completions[selectedCompletionIndex])
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedCompletionIndex((i) => (i + 1) % completions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedCompletionIndex((i) => (i - 1 + completions.length) % completions.length)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setCompletions([])
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      await submitEntry()
      return
    }

    if (e.key === 'ArrowUp' && completions.length === 0) {
      if (!e.currentTarget.value && entries.length > 0) {
        e.preventDefault()
        onSetEditingEntryId(entries[entries.length - 1].id)
      }
    }
  }

  const submitEntry = async () => {
    const trimmed = value.trim()
    if ((!trimmed && pendingImages.length === 0) || submitting) return

    const { type, body } = parseSlashCommand(trimmed)
    const imagesToSubmit = pendingImages
    setValue('')
    setDetectedType('note')
    setCompletions([])
    onPendingImagesChange([])
    setSubmitting(true)

    try {
      const entry = await window.electronAPI.createEntry(
        activeInvestigation.id,
        body,
        imagesToSubmit.length > 0 ? imagesToSubmit : undefined,
        type
      )
      onEntryCreated(entry)
    } catch (err) {
      console.error('[overlay] Failed to create entry:', err)
      setValue(trimmed)
      onPendingImagesChange(imagesToSubmit)
    } finally {
      setSubmitting(false)
      textareaRef.current?.focus()
    }
  }

  const addImages = useCallback((dataUrls: string[]) => {
    onPendingImagesChange((prev: string[]) => {
      const slots = MAX_IMAGES_PER_ENTRY - prev.length
      if (slots <= 0) return prev
      return [...prev, ...dataUrls.slice(0, slots)]
    })
  }, [onPendingImagesChange])

  const removeImage = useCallback((index: number) => {
    onPendingImagesChange((prev: string[]) => prev.filter((_, i) => i !== index))
  }, [onPendingImagesChange])

  const handlePickImage = useCallback(async () => {
    if (atLimit) return
    try {
      const dataUrls = await window.electronAPI.pickImage()
      if (dataUrls.length > 0) addImages(dataUrls)
    } catch (err) {
      console.error('[overlay] Failed to pick image:', err)
    }
  }, [atLimit, addImages])

  const handleCaptureScreenshot = useCallback(async () => {
    if (atLimit) return
    try {
      const dataUrl = await window.electronAPI.captureScreenshot()
      if (dataUrl) addImages([dataUrl])
    } catch (err) {
      console.error('[overlay] Failed to capture screenshot:', err)
    }
  }, [atLimit, addImages])

  // Listen for global hotkey triggers from main process
  useEffect(() => {
    return window.electronAPI.onTriggerScreenshot((dataUrl) => addImages([dataUrl]))
  }, [addImages])

  useEffect(() => {
    return window.electronAPI.onTriggerUpload(handlePickImage)
  }, [handlePickImage])

  // Auto-resize textarea to fit content.
  // useLayoutEffect ensures sizing happens before paint so there's no visual flicker.
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [value])

  const typeDef = detectedType !== 'note' ? getEntryTypeDefinition(detectedType) : null

  return (
    <div className="no-drag px-3 pb-3 pt-2 border-t border-gray-700/50">
      {/* Pending image previews */}
      {pendingImages.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {pendingImages.map((src, i) => (
            <div key={i} className="relative inline-block">
              <img
                src={src}
                alt={`Pending attachment ${i + 1}`}
                className="max-h-24 max-w-[120px] rounded border border-gray-600 object-contain"
              />
              <button
                onClick={() => removeImage(i)}
                className="no-drag absolute -top-1.5 -right-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full w-4 h-4 flex items-center justify-center text-xs leading-none"
                title="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Limit warning */}
      {atLimit && (
        <div className="text-xs text-amber-500 font-mono mb-2">
          Image limit reached ({MAX_IMAGES_PER_ENTRY}/{MAX_IMAGES_PER_ENTRY})
        </div>
      )}

      <div className="relative">
        {/* Autocomplete dropdown */}
        {completions.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden z-10 min-w-[160px]">
            {completions.map((def, i) => (
              <button
                key={def.type}
                onMouseDown={(e) => { e.preventDefault(); applyCompletion(def) }}
                className={`w-full text-left px-3 py-1.5 text-sm font-mono flex items-center gap-2 transition-colors ${
                  i === selectedCompletionIndex ? 'bg-gray-700 text-gray-100' : 'text-gray-300 hover:bg-gray-700/60'
                }`}
              >
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${def.tagBgClass} ${def.tagTextClass}`}>
                  {def.label.toUpperCase()}
                </span>
                <span className="text-gray-500">{def.command}</span>
              </button>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handleValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a note… (Enter to save, Shift+Enter for newline)"
          style={{ minHeight: '5rem' }}
          className="no-drag w-full bg-gray-800/80 text-gray-100 placeholder-gray-600 font-mono text-sm rounded-lg px-3 py-2.5 border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none transition-colors"
        />
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 select-none pointer-events-none">
          {typeDef && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${typeDef.tagBgClass} ${typeDef.tagTextClass}`}>
              {typeDef.label.toUpperCase()}
            </span>
          )}
          <span className="text-xs text-gray-600">↵ save</span>
        </div>
      </div>

      {/* Image toolbar */}
      <div className="flex gap-1.5 mt-1.5">
        <button
          onClick={handlePickImage}
          disabled={submitting || atLimit}
          className="no-drag flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40 px-1 py-0.5"
          title={atLimit ? `Image limit reached (${MAX_IMAGES_PER_ENTRY})` : 'Attach image'}
        >
          {/* Paperclip icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
          <span>Upload</span>
          {uploadHint && <span className="text-gray-600 font-mono">{uploadHint}</span>}
        </button>
        <button
          onClick={handleCaptureScreenshot}
          disabled={submitting || atLimit}
          className="no-drag flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40 px-1 py-0.5"
          title={atLimit ? `Image limit reached (${MAX_IMAGES_PER_ENTRY})` : 'Capture screenshot region'}
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
          {screenshotHint && <span className="text-gray-600 font-mono">{screenshotHint}</span>}
        </button>
      </div>
    </div>
  )
}
