import { Modal } from './Modal';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  isLoading = false,
}: ConfirmModalProps) {
  const confirmButtonClass = variant === 'danger' ? 'btn-danger' : 'btn-primary';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="empty-state mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
          {cancelLabel}
        </button>
        <button
          className={`btn ${confirmButtonClass}`}
          onClick={onConfirm}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="spinner" style={{ width: '1.25rem', height: '1.25rem' }} />
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </Modal>
  );
}
