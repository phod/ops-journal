import { useState, useEffect, useCallback, useRef } from 'react'
import { CreateInvestigationForm } from './components/CreateInvestigationForm'
import { HotkeySettings } from './components/HotkeySettings'
import { InvestigationDetails } from './components/InvestigationDetails'
import type { InvestigationDetailsHandle } from './components/InvestigationDetails'
import { InvestigationList } from './components/InvestigationList'
import { ToolkitManager } from './components/ToolkitManager'
import { ReminderManager } from './components/ReminderManager'
import type { Investigation } from '@shared/ipc-types'

export default function App() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [tab, setTab] = useState<'investigations' | 'toolkits' | 'reminders' | 'settings'>('investigations')
  const [reminderCount, setReminderCount] = useState(0)
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const versionFetchedRef = useRef(false)
  const detailsRef = useRef<InvestigationDetailsHandle>(null)

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
    if (tab === 'settings' && !versionFetchedRef.current) {
      versionFetchedRef.current = true
      window.electronAPI.getAppVersion().then(setAppVersion)
    }
  }, [tab])

  useEffect(() => {
    return window.electronAPI.onInvestigationChanged(() => fetchInvestigations())
  }, [fetchInvestigations])

  useEffect(() => {
    return window.electronAPI.onShowDetails(setDetailsId)
  }, [])

  useEffect(() => {
    return window.electronAPI.onShowHome(() => setDetailsId(null))
  }, [])

  useEffect(() => {
    return window.electronAPI.onShowReminders(() => {
      setDetailsId(null)
      setTab('reminders')
    })
  }, [])

  useEffect(() => {
    return window.electronAPI.onCheckDirty(() => {
      const canProceed = detailsRef.current?.confirmIfDirty() ?? true
      window.electronAPI.replyCheckDirty(canProceed)
    })
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
    <div className="h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 pt-4">
        <div className="flex items-center gap-3 pb-3">
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
          <h1 className="text-lg font-semibold text-gray-100">Ops Journal</h1>
          <span className="text-gray-600 text-sm">/</span>
          <span className="text-gray-400 text-sm">
            {detailsId ? 'Investigation Details' : tab === 'settings' ? 'Settings' : tab === 'toolkits' ? 'Toolkits' : tab === 'reminders' ? 'Reminders' : 'Investigations'}
          </span>
        </div>
        {!detailsId && (
          <div className="flex gap-0">
            {(['investigations', 'toolkits', 'reminders', 'settings'] as const).map((t) => (
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
                {t === 'reminders' && reminderCount > 0 && (
                  <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {reminderCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className={`flex-1 min-h-0 ${detailsId ? 'flex flex-col' : 'overflow-y-auto'}`}>
        {detailsId ? (
          <div className="flex-1 min-h-0 flex flex-col px-6 py-6">
            <InvestigationDetails
              ref={detailsRef}
              investigationId={detailsId}
              onBack={() => setDetailsId(null)}
            />
          </div>
        ) : (
        <div className={`mx-auto px-6 py-6 flex flex-col gap-6 ${tab === 'settings' ? 'max-w-2xl' : 'max-w-4xl'}`}>
          {tab === 'settings' ? (
            <>
              <section>
                <HotkeySettings />
              </section>
              <section className="border-t border-gray-800 pt-6">
                <h3 className="text-gray-400 text-sm font-semibold mb-3">About</h3>
                <div className="space-y-3 text-sm text-gray-400 font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Ops Journal</span>
                    {appVersion && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300">v{appVersion}</span>}
                  </div>
                  <ResetOnboardingButton />
                </div>
              </section>
            </>
          ) : tab === 'toolkits' ? (
            <ToolkitManager />
          ) : tab === 'reminders' ? (
            <ReminderManager onActiveCountChange={setReminderCount} />
          ) : (
            <>
              {/* Header with create button */}
              <div className="flex items-center justify-between">
                <h2 className="text-gray-200 font-semibold text-sm">Investigations</h2>
                <CreateInvestigationForm onCreated={fetchInvestigations} />
              </div>

              {/* List */}
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
            </>
          )}
        </div>
        )}
      </div>
    </div>
  )
}

function ResetOnboardingButton() {
  const [done, setDone] = useState(false)

  const handleClick = async () => {
    await window.electronAPI.setOnboardingDismissed(false)
    setDone(true)
    setTimeout(() => setDone(false), 2000)
  }

  return (
    <button
      onClick={handleClick}
      className="text-xs px-2.5 py-1 rounded bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-gray-200 transition-colors"
    >
      {done ? 'Done!' : 'Reset onboarding'}
    </button>
  )
}
