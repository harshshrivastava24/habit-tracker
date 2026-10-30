import React from 'react';
import { Modal } from './Modal';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <p className="text-sm text-text-muted mb-6">{message}</p>
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-3 py-1.5 text-xs border border-border rounded-md text-text-primary hover:border-text-primary transition-colors disabled:opacity-50 cursor-pointer"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className="px-3 py-1.5 text-xs bg-danger text-text-primary rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? 'Deleting...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
};
