import { Modal } from '@shared/Modal'

interface Props {
  title: string
  message: string
  confirmLabel: string
  confirmVariant?: 'danger' | 'warning'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, message, confirmLabel, confirmVariant = 'danger', onConfirm, onCancel }: Props) {
  const confirmClass = confirmVariant === 'danger'
    ? 'bg-red-600 hover:bg-red-500 text-white'
    : 'bg-amber-600 hover:bg-amber-500 text-white'

  return (
    <Modal onClose={onCancel} className="p-6 w-[400px]">
      <h3 className="text-gray-100 font-semibold text-sm mb-2">{title}</h3>
      <p className="text-gray-400 text-sm mb-5 leading-relaxed">{message}</p>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-700 text-gray-300
            hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${confirmClass}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
