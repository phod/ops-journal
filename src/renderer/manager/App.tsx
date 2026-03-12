import React, { useState, useEffect, useCallback } from 'react'
import type { Investigation } from '../../shared/ipc-types'
import { CreateInvestigationForm } from './components/CreateInvestigationForm'
import { InvestigationList } from './components/InvestigationList'
import { HotkeySettings } from './components/HotkeySettings'

export default function App() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  // Subscribe to push events
  useEffect(() => {
    const unsubscribe = window.electronAPI.onInvestigationChanged(() => {
      // Re-fetch the full list whenever anything changes
      fetchInvestigations()
    })
    return unsubscribe
  }, [fetchInvestigations])

  const handleCreated = (_investigation: Investigation) => {
    fetchInvestigations()
  }

  const handleSetActive = async (id: string) => {
    await window.electronAPI.setActiveInvestigation(id)
    await fetchInvestigations()
  }

  const handleDelete = async (id: string) => {
    await window.electronAPI.deleteInvestigation(id)
    await fetchInvestigations()
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
          <h1 className="text-lg font-semibold text-gray-100">Ops Journal</h1>
          <span className="text-gray-600 text-sm">/</span>
          <span className="text-gray-400 text-sm">Investigations</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 flex flex-col gap-8">
          {/* Create form */}
          <section className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
            <CreateInvestigationForm onCreated={handleCreated} />
          </section>

          {/* Settings */}
          <section>
            <HotkeySettings />
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
                onDelete={handleDelete}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
