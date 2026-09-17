import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = true,
  isLoading = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`p-3 rounded-2xl shrink-0 ${
              isDestructive ? 'bg-[#E06A6A]/10 text-[#E06A6A] border border-[#E06A6A]/25' : 'bg-[#E6AF55]/10 text-[#E6AF55] border border-[#E6AF55]/25'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-sm text-[#FBF9F5] leading-relaxed pt-1">{message}</p>
        </div>

        <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-[#26231F]">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-5 py-2 text-xs font-semibold text-[#A8A096] hover:text-[#FBF9F5] bg-[#181614] hover:bg-[#201D1A] border border-[#2E2A25] rounded-xl transition-all cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              isDestructive
                ? 'bg-[#E06A6A] hover:bg-[#C95959] text-white shadow-[0_4px_15px_rgba(224,106,106,0.3)] disabled:opacity-50'
                : 'bg-[#EDE1D3] hover:bg-[#F7EFE6] text-[#121110] font-bold shadow-[0_4px_15px_rgba(237,225,211,0.2)] disabled:opacity-50'
            }`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
