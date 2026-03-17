import { type FormEvent, useState, useRef, useEffect } from 'react'

interface Props {
  onCreated: () => void
}

export function CreateInvestigationForm({ onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      // Small delay to let the dialog render before focusing
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  function handleClose() {
    if (submitting) return
    setOpen(false)
    setName('')
    setError(null)
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setSubmitting(true)
    setError(null)

    try {
      const { id } = await window.electronAPI.createInvestigation(trimmed)
      await window.electronAPI.setActiveInvestigation(id)
      setName('')
      setOpen(false)
      onCreated()
    } catch (err) {
      console.error('[manager] Failed to create investigation:', err)
      setError('Failed to create investigation. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg
          flex items-center gap-1.5 transition-colors"
      >
        <span className="text-base leading-none">+</span> New Investigation
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={handleClose}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-[420px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-gray-100 font-semibold text-sm mb-4">New Investigation</h3>
            <form onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Investigation name…"
                disabled={submitting}
                maxLength={200}
                className="w-full bg-gray-900 text-gray-100 placeholder-gray-600 rounded-lg px-3 py-2
                  border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                  outline-none text-sm transition-colors disabled:opacity-50 mb-4"
              />
              {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-700 text-gray-300
                    hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                    disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
                >
                  {submitting ? 'Creating…' : 'Create & Activate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
