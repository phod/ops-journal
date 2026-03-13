import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { toAccelerator } from '../utils/hotkey'

const KEY_SYMBOLS: Record<string, string> = {
  Command: '⌘',
  CommandOrControl: '⌘',
  Control: '⌃',
  Alt: '⌥',
  Shift: '⇧',
  Return: '↵',
  Space: '␣',
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→'
}

function AcceleratorBadge({ accelerator }: { accelerator: string }) {
  const parts = accelerator.split('+')
  return (
    <span className="flex items-center gap-1">
      {parts.map((part, i) => (
        <kbd
          key={i}
          className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-gray-700 border border-gray-600 text-gray-200 text-xs font-mono min-w-[1.5rem]"
        >
          {KEY_SYMBOLS[part] ?? part}
        </kbd>
      ))}
    </span>
  )
}

interface HotkeyRowProps {
  label: string
  description: string
  getter: () => Promise<string>
  setter: (accelerator: string) => Promise<boolean>
}

function HotkeyRow({ label, description, getter, setter }: HotkeyRowProps) {
  const [currentHotkey, setCurrentHotkey] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [captured, setCaptured] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const captureRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getter().then(setCurrentHotkey)
  }, [getter])

  useEffect(() => {
    if (capturing) {
      captureRef.current?.focus()
    }
  }, [capturing])

  function resetCapture(active: boolean): void {
    setCapturing(active)
    setCaptured(null)
    setError(null)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    e.preventDefault()
    e.stopPropagation()
    const accelerator = toAccelerator(e.nativeEvent)
    if (accelerator) {
      setCaptured(accelerator)
      setError(null)
    }
  }

  async function saveHotkey(): Promise<void> {
    if (!captured) return
    setSaving(true)
    setError(null)
    try {
      const success = await setter(captured)
      if (success) {
        setCurrentHotkey(captured)
        resetCapture(false)
      } else {
        setError('That shortcut is already in use by another application.')
      }
    } catch {
      setError('Failed to register shortcut.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="py-4 border-b border-gray-700/50 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm text-gray-200 font-medium mb-1">{label}</div>
          <div className="text-xs text-gray-500">{description}</div>
        </div>
        <div className="flex-shrink-0">
          {currentHotkey && !capturing && (
            <AcceleratorBadge accelerator={currentHotkey} />
          )}
        </div>
      </div>

      {!capturing ? (
        <button
          onClick={() => resetCapture(true)}
          className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600 transition-colors"
        >
          Change shortcut
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <div
            ref={captureRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="flex items-center justify-between px-4 py-3 rounded-lg border-2 border-indigo-500 bg-gray-800 outline-none cursor-default select-none"
          >
            {captured ? (
              <AcceleratorBadge accelerator={captured} />
            ) : (
              <span className="text-gray-500 text-sm font-mono">Press your shortcut…</span>
            )}
            <span className="text-xs text-gray-600">include ⌘, ⌃ or ⌥</span>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={saveHotkey}
              disabled={!captured || saving}
              className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40"
            >
              Save
            </button>
            <button
              onClick={() => resetCapture(false)}
              className="text-xs px-3 py-1.5 rounded-lg text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function HotkeySettings() {
  return (
    <div>
      <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
        Settings
      </h2>
      <div className="bg-gray-800/50 rounded-xl px-5 border border-gray-700/50">
        <HotkeyRow
          label="Open Journal"
          description="Global shortcut to toggle the overlay"
          getter={window.electronAPI.getHotkey}
          setter={window.electronAPI.setHotkey}
        />
        <HotkeyRow
          label="Capture Screenshot"
          description="Global shortcut to capture a screenshot region"
          getter={window.electronAPI.getScreenshotHotkey}
          setter={window.electronAPI.setScreenshotHotkey}
        />
        <HotkeyRow
          label="Upload Image"
          description="Global shortcut to attach an image from disk"
          getter={window.electronAPI.getUploadHotkey}
          setter={window.electronAPI.setUploadHotkey}
        />
      </div>
    </div>
  )
}
