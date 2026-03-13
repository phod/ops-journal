import { useState, useEffect, useCallback } from 'react'
import { CreateInvestigationForm } from './components/CreateInvestigationForm'
import { HotkeySettings } from './components/HotkeySettings'
import { InvestigationDetails } from './components/InvestigationDetails'
import { InvestigationList } from './components/InvestigationList'
import type { Investigation } from '@shared/ipc-types'

export default function App() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [tab, setTab] = useState<'investigations' | 'settings'>('investigations')

  const fetchInvestigations = useCallback(async () => {
    try {
      const list = await window.electronAPI.listInvestigations()
      setInvestigations(list)
      setError(null)
    } catch (err) {
      console.error('[manager] Failed to fetch investigations:', err)
      setError('Failed to load investigations.')
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchInvestigations().finally(() => setLoading(false))
  }, [fetchInvestigations])

  useEffect(() => {
    return window.electronAPI.onInvestigationChanged(() => fetchInvestigations())
  }, [fetchInvestigations])

  useEffect(() => {
    return window.electronAPI.onShowDetails(setDetailsId)
  }, [])

  async function handleSetActive(id: string): Promise<void> {
    await window.electronAPI.setActiveInvestigation(id)
    await fetchInvestigations()
  }

  async function handleDeactivate(id: string): Promise<void> {
    await window.electronAPI.deactivateInvestigation(id)
    await fetchInvestigations()
  }

  async function handleDelete(id: string): Promise<void> {
    await window.electronAPI.deleteInvestigation(id)
    await fetchInvestigations()
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 pt-4">
        <div className="flex items-center gap-3 pb-3">
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
          <h1 className="text-lg font-semibold text-gray-100">Ops Journal</h1>
          <span className="text-gray-600 text-sm">/</span>
          <span className="text-gray-400 text-sm">
            {detailsId ? 'Investigation Details' : tab === 'settings' ? 'Settings' : 'Investigations'}
          </span>
        </div>
        {!detailsId && (
          <div className="flex gap-0">
            {(['investigations', 'settings'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize
                  ${tab === t
                    ? 'border-indigo-500 text-indigo-300'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 flex flex-col gap-8">
          {detailsId ? (
            <InvestigationDetails
              investigationId={detailsId}
              onBack={() => setDetailsId(null)}
            />
          ) : tab === 'settings' ? (
            <section>
              <HotkeySettings />
            </section>
          ) : (
            <>
              {/* Create form */}
              <section className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
                <CreateInvestigationForm onCreated={fetchInvestigations} />
              </section>

              {/* List */}
              <section>
                <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
                  All Investigations
                  {investigations.length > 0 && (
                    <span className="ml-2 text-gray-600 font-normal normal-case">
                      ({investigations.length})
                    </span>
                  )}
                </h2>

                {loading ? (
                  <div className="text-gray-500 text-sm py-8 text-center">Loading…</div>
                ) : error ? (
                  <div className="text-red-400 text-sm py-4">{error}</div>
                ) : (
                  <InvestigationList
                    investigations={investigations}
                    onSetActive={handleSetActive}
                    onDeactivate={handleDeactivate}
                    onDelete={handleDelete}
                  />
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
