import type { EntryType } from './ipc-types'

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
    tagBgClass: '',
    tagTextClass: ''
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
  }
]

export const SLASH_COMMANDS = ENTRY_TYPES.filter((d) => d.command !== null)

export function getEntryTypeDefinition(type: EntryType): EntryTypeDefinition {
  return ENTRY_TYPES.find((d) => d.type === type) ?? ENTRY_TYPES[0]
}
