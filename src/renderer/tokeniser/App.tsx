import { useEffect, useReducer, useRef, useState } from 'react'
import { reduce, initialState, currentText } from './state'
import { TitleBar } from './components/TitleBar'
import { TokenView } from './components/TokenView'
import { StatusStrip } from './components/StatusStrip'
import { TextView } from './components/TextView'

const TOAST_MS = 2200

function ownsKeys(target: EventTarget): boolean {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true
  if (!(target instanceof HTMLElement)) return false
  // jsdom does not implement isContentEditable, so also check the attribute
  return target.isContentEditable || target.closest('[contenteditable="true"]') !== null
}

export default function App() {
  const [state, dispatch] = useReducer(reduce, initialState)
  const [opaqueOverlay, setOpaqueOverlay] = useState(false)
  // The reducer seeds textDraft on enterText; keystrokes in the textarea live here.
  // Seeded during render (not in an effect) so the textarea mounts with the full text
  // and its initial selection is applied against the real value.
  const [draft, setDraft] = useState('')
  const [draftMode, setDraftMode] = useState(state.mode)
  if (state.mode !== draftMode) {
    setDraftMode(state.mode)
    if (state.mode === 'text') setDraft(state.textDraft)
  }
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electronAPI.getOpaqueOverlay().then(setOpaqueOverlay)
    return window.electronAPI.onOpaqueOverlayChanged(setOpaqueOverlay)
  }, [])

  useEffect(() => window.electronAPI.onTokeniserShown(() => dispatch({ type: 'reset' })), [])

  useEffect(() => {
    if (state.mode === 'hats' || state.mode === 'empty') overlayRef.current?.focus()
  }, [state.mode])

  useEffect(() => {
    if (state.notice === null) return
    const timer = setTimeout(() => dispatch({ type: 'clearNotice' }), TOAST_MS)
    return () => clearTimeout(timer)
  }, [state.notice])

  /** The whole command as the user currently sees it. */
  function fullText(): string {
    return state.mode === 'text' ? draft : currentText(state)
  }

  async function copyStay(text: string) {
    try {
      await window.electronAPI.copyToClipboard(text)
      dispatch({ type: 'notice', text: 'Copied' })
    } catch {
      dispatch({ type: 'notice', text: 'Copy failed' })
    }
  }

  async function copyAndClose(text: string) {
    try {
      await window.electronAPI.copyToClipboard(text)
    } catch {
      dispatch({ type: 'notice', text: 'Copy failed' })
      return
    }
    await window.electronAPI.hideTokeniserOverlay()
  }

  function toggleMode() {
    if (state.mode === 'text') dispatch({ type: 'leaveText', text: draft })
    else if (state.mode === 'hats') dispatch({ type: 'enterText', selection: null })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (ownsKeys(e.target)) return

    const mod = e.metaKey || e.ctrlKey
    if (state.mode === 'text') {
      // Focus can sit on the overlay itself in text mode; leaving must never hide with a draft pending
      if (e.key === 'Escape' || e.key === 'Tab') {
        e.preventDefault()
        dispatch({ type: 'leaveText', text: draft })
      }
    } else if (state.mode === 'hats' && e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault()
      copyAndClose(fullText())
    } else if (state.mode === 'hats' && mod && e.key === 'c') {
      e.preventDefault()
      copyStay(fullText())
    } else if (state.mode === 'hats' && e.key === 'Tab') {
      e.preventDefault()
      dispatch({ type: 'enterText', selection: null })
    } else if (state.mode === 'hats' && mod && e.key === 'a') {
      e.preventDefault()
      dispatch({ type: 'enterText', selection: 'all' })
    } else if (mod && e.key === 'v') {
      e.preventDefault()
      window.electronAPI.readClipboard().then((text) => dispatch({ type: 'load', text }))
    } else if (/^[a-z]$/.test(e.key) && !mod && !e.altKey) {
      // Must be prevented so the hat letter never lands in the editor that mounts next
      e.preventDefault()
      dispatch({ type: 'hatKey', key: e.key })
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (state.hatBuf) dispatch({ type: 'clearHatBuf' })
      else window.electronAPI.hideTokeniserOverlay()
    }
  }

  return (
    <div
      ref={overlayRef}
      data-testid="overlay"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`h-screen flex flex-col font-mono rounded-xl ${opaqueOverlay ? 'bg-gray-900/95' : 'bg-gray-900'} border border-gray-700/60 shadow-2xl overflow-hidden backdrop-blur-sm outline-none relative`}
    >
      <TitleBar
        mode={state.mode}
        targetCount={state.targetCount}
        hattedCount={state.hattedCount}
        onToggleMode={toggleMode}
        onCopy={() => copyStay(fullText())}
        onCopyClose={() => copyAndClose(fullText())}
      />

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pt-5 pb-3">
        {state.mode === 'empty' ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
            <div className="text-sm text-gray-300">Paste a command</div>
            <div className="text-[11px] text-gray-500">⌘V · each editable piece will get a letter above it</div>
          </div>
        ) : state.mode === 'text' ? (
          <TextView
            value={draft}
            selection={state.textSelection}
            onChange={setDraft}
            onLeave={(text) => dispatch({ type: 'leaveText', text })}
            onCopyClose={copyAndClose}
            onCopyStay={copyStay}
          />
        ) : (
          <TokenView
            tokens={state.tokens}
            hats={state.hats}
            edited={state.edited}
            hatBuf={state.hatBuf}
            editingIndex={state.editingIndex}
            flashRange={state.flashRange}
            onCommit={(value) => dispatch({ type: 'commitEdit', value })}
            onCancel={() => dispatch({ type: 'cancelEdit' })}
            onTokenDoubleClick={(index) => dispatch({ type: 'beginEdit', index })}
            onTextClick={(offset) => dispatch({ type: 'enterText', selection: offset })}
          />
        )}
      </div>

      {state.notice !== null && (
        <div
          data-testid="toast"
          className="absolute bottom-10 right-3 px-2.5 py-1 rounded-md bg-gray-800 border border-gray-700 text-[11px] text-gray-200 shadow-lg pointer-events-none"
        >
          {state.notice}
        </div>
      )}

      <StatusStrip mode={state.mode} hatBuf={state.hatBuf} />
    </div>
  )
}
