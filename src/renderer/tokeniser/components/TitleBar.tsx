import type { Mode } from '../state'

interface TitleBarProps {
  mode: Mode
  targetCount: number
  hattedCount: number
  onToggleMode: () => void
  onCopy: () => void
  onCopyClose: () => void
}

const PILL_COLOURS: Record<'hats' | 'text', string> = {
  hats: 'text-amber-300 border-amber-400/40 bg-amber-400/10',
  text: 'text-blue-300 border-blue-300/40 bg-blue-300/10'
}

export function TitleBar({ mode, targetCount, hattedCount, onToggleMode, onCopy, onCopyClose }: TitleBarProps) {
  const pill = mode === 'text' ? 'text' : 'hats'
  const count = hattedCount < targetCount ? `${hattedCount} of ${targetCount} hatted` : `${targetCount} targets`

  return (
    <div className="drag-handle flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-800/60">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <span className="text-xs font-semibold text-gray-300 tracking-wide">Tokeniser</span>
        {mode !== 'empty' && (
          <button
            data-testid="mode-pill"
            className={`no-drag text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${PILL_COLOURS[pill]}`}
            onClick={onToggleMode}
          >
            {pill}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {mode !== 'empty' && <span className="text-[10px] text-gray-500 font-mono">{count}</span>}
        <button
          className="no-drag text-[10px] px-2 py-0.5 rounded border border-gray-700 text-gray-300 hover:bg-gray-800"
          onClick={onCopy}
        >
          copy
        </button>
        <button
          className="no-drag text-[10px] px-2 py-0.5 rounded border border-amber-400/40 text-amber-300 hover:bg-amber-400/10"
          onClick={onCopyClose}
        >
          copy &amp; close
        </button>
      </div>
    </div>
  )
}
