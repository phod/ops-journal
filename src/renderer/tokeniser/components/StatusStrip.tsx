import type { ReactNode } from 'react'
import type { Mode } from '../state'

interface StatusStripProps {
  mode: Mode
  hatBuf: string
}

function Key({ children }: { children: ReactNode }) {
  return <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400 text-[9px] font-mono">{children}</kbd>
}

const Sep = () => <span className="text-gray-700 whitespace-pre"> · </span>

function Hint({ k, label }: { k: string; label: string }) {
  return (
    <span>
      <Key>{k}</Key> {label}
    </span>
  )
}

function Hints({ items }: { items: [string, string][] }) {
  return (
    <>
      {items.map(([k, label], i) => (
        <span key={k} className="flex items-center gap-1.5">
          {i > 0 && <Sep />}
          <Hint k={k} label={label} />
        </span>
      ))}
    </>
  )
}

export function StatusStrip({ mode, hatBuf }: StatusStripProps) {
  let content: ReactNode
  if (mode === 'empty') {
    content = <Hints items={[['⌘V', 'paste'], ['Esc', 'close']]} />
  } else if (mode === 'hats' && hatBuf) {
    content = (
      <>
        <span className="text-amber-300 font-bold">{hatBuf}</span>{' '}
        <span>second letter…</span>
        <Sep />
        <Hint k="Esc" label="cancel" />
      </>
    )
  } else if (mode === 'hats') {
    content = (
      <>
        <span className="text-amber-300">hats — type a letter to edit that token</span>
        <Sep />
        <Hints items={[['Tab', 'text mode'], ['⌘A', 'select all'], ['⌘C', 'copy'], ['⏎', 'copy & close'], ['Esc', 'close']]} />
      </>
    )
  } else if (mode === 'editing') {
    content = (
      <>
        <span className="text-amber-300">editing token</span>
        <Sep />
        <Hints items={[['⏎', 'commit'], ['Esc', 'cancel']]} />
      </>
    )
  } else {
    content = (
      <>
        <span className="text-blue-300">text — edit freely</span>
        <Sep />
        <Hints items={[['Tab', 'back to hats'], ['⌘A', 'select all'], ['⌘C', 'copy'], ['⌘⏎', 'copy & close'], ['Esc', 'hats']]} />
      </>
    )
  }

  return (
    <div
      data-testid="status-strip"
      className="px-3 py-1.5 border-t border-gray-800/40 flex flex-wrap items-center gap-1.5 text-[10px] text-gray-500"
    >
      {content}
    </div>
  )
}
