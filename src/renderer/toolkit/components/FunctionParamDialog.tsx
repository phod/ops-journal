import { useState, useRef, useEffect } from 'react'
import type { Tool } from '@shared/ipc-types'

interface Props {
  tool: Tool
  onRun: (paramValues: Record<string, string>) => void
  onCancel: () => void
}

export function FunctionParamDialog({ tool, onRun, onCancel }: Props) {
  const params = tool.parameters ?? []
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const p of params) {
      if ((p.type === 'list' || p.type === 'list-other') && p.options && p.options.length > 0) {
        init[p.name] = p.options[0]
      } else {
        init[p.name] = ''
      }
    }
    return init
  })
  const [otherMode, setOtherMode] = useState<Record<string, boolean>>({})
  const firstRef = useRef<HTMLInputElement | HTMLSelectElement>(null)

  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  function setValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onRun(values)
    }
  }

  return (
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800/60 flex items-center gap-2">
        <span className="text-emerald-400 text-sm">⚡</span>
        <span className="text-sm font-semibold text-gray-100">{tool.name}</span>
      </div>

      {/* Parameters */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
        {params.map((param, i) => (
          <div key={param.name}>
            <label className="block text-xs text-gray-400 font-medium mb-1">
              {param.name}
            </label>
            {param.type === 'text' ? (
              <input
                ref={i === 0 ? firstRef as React.RefObject<HTMLInputElement> : undefined}
                type="text"
                value={values[param.name] ?? ''}
                onChange={(e) => setValue(param.name, e.target.value)}
                className="no-drag w-full bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-emerald-500/60 transition-colors"
                placeholder={`Enter ${param.name}...`}
              />
            ) : param.type === 'list' ? (
              <select
                ref={i === 0 ? firstRef as React.RefObject<HTMLSelectElement> : undefined}
                value={values[param.name] ?? ''}
                onChange={(e) => setValue(param.name, e.target.value)}
                className="no-drag w-full bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-1.5 text-sm text-gray-100 outline-none focus:border-emerald-500/60 transition-colors"
              >
                {(param.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : /* list-other */ (
              otherMode[param.name] ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={values[param.name] ?? ''}
                    onChange={(e) => setValue(param.name, e.target.value)}
                    className="no-drag flex-1 bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-emerald-500/60 transition-colors"
                    placeholder="Custom value..."
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setOtherMode((prev) => ({ ...prev, [param.name]: false }))
                      setValue(param.name, (param.options ?? [])[0] ?? '')
                    }}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2"
                  >
                    List
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    ref={i === 0 ? firstRef as React.RefObject<HTMLSelectElement> : undefined}
                    value={values[param.name] ?? ''}
                    onChange={(e) => setValue(param.name, e.target.value)}
                    className="no-drag flex-1 bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-1.5 text-sm text-gray-100 outline-none focus:border-emerald-500/60 transition-colors"
                  >
                    {(param.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setOtherMode((prev) => ({ ...prev, [param.name]: true }))
                      setValue(param.name, '')
                    }}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2"
                  >
                    Other
                  </button>
                </div>
              )
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-800/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-600">
            <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-500 text-[9px] font-mono">↵</kbd> run
          </span>
          <span className="text-[10px] text-gray-600">
            <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-500 text-[9px] font-mono">esc</kbd> cancel
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="no-drag px-3 py-1.5 text-xs font-medium rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onRun(values)}
            className="no-drag px-4 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            Run ⚡
          </button>
        </div>
      </div>
    </div>
  )
}
