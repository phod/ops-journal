import type { EntryType, HypothesisStatus, JournalEntry } from './ipc-types'

export interface EntryTypeDefinition {
  type: EntryType
  command: string | null
  label: string
  leftBorderClass: string
  cardBgClass: string
  cardBorderClass: string
  tagBgClass: string
  tagTextClass: string
}

export const ENTRY_TYPES: EntryTypeDefinition[] = [
  {
    type: 'note',
    command: null,
    label: 'Note',
    leftBorderClass: '',
    cardBgClass: '',
    cardBorderClass: '',
    tagBgClass: 'bg-gray-700',
    tagTextClass: 'text-gray-400'
  },
  {
    type: 'action',
    command: '/action',
    label: 'Action',
    leftBorderClass: 'border-l-orange-400',
    cardBgClass: 'bg-orange-400/10',
    cardBorderClass: 'border-orange-500/40',
    tagBgClass: 'bg-orange-400',
    tagTextClass: 'text-orange-950 font-bold'
  },
  {
    type: 'finding',
    command: '/finding',
    label: 'Finding',
    leftBorderClass: 'border-l-teal-400',
    cardBgClass: 'bg-teal-400/10',
    cardBorderClass: 'border-teal-500/40',
    tagBgClass: 'bg-teal-400',
    tagTextClass: 'text-teal-950 font-bold'
  },
  {
    type: 'hypothesis',
    command: '/hypothesis',
    label: 'Hypothesis',
    leftBorderClass: 'border-l-violet-400',
    cardBgClass: 'bg-violet-400/10',
    cardBorderClass: 'border-violet-500/40',
    tagBgClass: 'bg-violet-500',
    tagTextClass: 'text-violet-50 font-bold'
  }
]

export const SLASH_COMMANDS = ENTRY_TYPES.filter((d) => d.command !== null)

export function getEntryTypeDefinition(type: EntryType): EntryTypeDefinition {
  return ENTRY_TYPES.find((d) => d.type === type) ?? ENTRY_TYPES[0]
}

export const HYPOTHESIS_STATUS_LABEL: Record<HypothesisStatus, string> = {
  open: 'Open',
  true: 'True',
  false: 'False',
  abandoned: 'Abandoned'
}

export const HYPOTHESIS_STATUS_CLASS: Record<HypothesisStatus, string> = {
  open: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  true: 'bg-green-500/20 text-green-300 border border-green-500/30',
  false: 'bg-red-500/20 text-red-300 border border-red-500/30',
  abandoned: 'bg-gray-500/20 text-gray-400 border border-gray-600/30'
}

export const HYPOTHESIS_STATUS_TEXT_CLASS: Record<HypothesisStatus, string> = {
  open: 'text-yellow-300',
  true: 'text-green-300',
  false: 'text-red-300',
  abandoned: 'text-gray-400'
}

export type Filter = 'all' | 'images' | 'finding' | 'action' | 'hypothesis' | 'flagged'

export function countEntries(entries: JournalEntry[]) {
  return entries.reduce(
    (acc, e) => {
      acc.all++
      if (e.image_paths.length > 0) acc.images++
      if (e.type === 'finding') acc.finding++
      if (e.type === 'action') acc.action++
      if (e.type === 'hypothesis') acc.hypothesis++
      if (e.flagged) acc.flagged++
      return acc
    },
    { all: 0, images: 0, finding: 0, action: 0, hypothesis: 0, flagged: 0 }
  )
}

export function filterEntries(entries: JournalEntry[], filter: Filter): JournalEntry[] {
  if (filter === 'all') return entries
  if (filter === 'images') return entries.filter((e) => e.image_paths.length > 0)
  if (filter === 'flagged') return entries.filter((e) => e.flagged)
  return entries.filter((e) => e.type === filter)
}

export function resolveEntriesByIds(ids: number[] | undefined | null, allEntries: JournalEntry[]): JournalEntry[] {
  return (ids ?? [])
    .map((id) => allEntries.find((e) => e.id === id))
    .filter(Boolean) as JournalEntry[]
}

export function resolveLinkedFindings(entry: JournalEntry, allEntries: JournalEntry[]): JournalEntry[] {
  if (entry.type !== 'hypothesis') return []
  return resolveEntriesByIds(entry.linked_finding_ids, allEntries)
}

export function resolveChildHypotheses(entry: JournalEntry, allEntries: JournalEntry[]): JournalEntry[] {
  if (entry.type !== 'hypothesis') return []
  return resolveEntriesByIds(entry.linked_child_hypothesis_ids, allEntries)
}

export function resolveParentHypotheses(entry: JournalEntry, allEntries: JournalEntry[]): JournalEntry[] {
  if (entry.type !== 'hypothesis') return []
  return resolveEntriesByIds(entry.parent_hypothesis_ids, allEntries)
}
