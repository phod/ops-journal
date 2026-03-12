import React, { useState, useRef } from 'react'
import type { Investigation } from '../../../../shared/ipc-types'

interface Props {
  onCreated: (investigation: Investigation) => void
}

export function CreateInvestigationForm({ onCreated }: Props) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setSubmitting(true)
    setError(null)

    try {
      // Create then immediately set as active
      const investigation = await window.electronAPI.createInvestigation(trimmed)
      await window.electronAPI.setActiveInvestigation(investigation.id)
      setName('')
      onCreated(investigation)
      inputRef.current?.focus()
    } catch (err) {
      console.error('[manager] Failed to create investigation:', err)
      setError('Failed to create investigation. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <h2 className="text-gray-200 font-semibold text-sm uppercase tracking-wider">
        New Investigation
      </h2>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Investigation name…"
          disabled={submitting}
          maxLength={200}
          className="flex-1 bg-gray-800 text-gray-100 placeholder-gray-600 rounded-lg px-3 py-2
            border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
            outline-none text-sm transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
            disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg
            transition-colors whitespace-nowrap"
        >
          {submitting ? 'Creating…' : 'Create & Activate'}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </form>
  )
}
