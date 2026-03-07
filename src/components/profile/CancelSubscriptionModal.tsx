import { Modal } from '@/components/common/Modal';
import { HoldToConfirmButton } from '@/components/common/HoldToConfirmButton';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isCancelling: boolean;
  cancelMode: 'immediately' | 'period_end' | null;
}

export function CancelSubscriptionModal({
  isOpen,
  onClose,
  onConfirm,
  isCancelling,
  cancelMode
}: CancelSubscriptionModalProps) {
  const isImmediate = cancelMode === 'immediately';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirmar Cancelación">
      <div className="flex flex-col items-center text-center space-y-6 pt-2">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-gray-900">
            ¿Estás seguro de que deseas cancelar tu suscripción?
          </h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            {isImmediate 
              ? "Perderás el acceso a todas las funciones premium inmediatamente. Esta acción no se puede deshacer."
              : "Tu suscripción seguirá activa hasta el final de tu periodo actual. Después de eso, perderás el acceso a las funciones premium."}
          </p>
        </div>

        <div className="w-full pt-4">
          <HoldToConfirmButton
            onConfirm={onConfirm}
            loading={isCancelling}
            className="w-full py-4 bg-white rounded-2xl border border-red-200 text-red-700 font-bold shadow-sm"
            bgClassName="bg-red-50"
          >
            {isCancelling ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Cancelando...
              </span>
            ) : (
              "Mantén presionado para cancelar"
            )}
          </HoldToConfirmButton>
        </div>

        <button
          onClick={onClose}
          disabled={isCancelling}
          className="text-sm font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-50 mt-4"
        >
          No, mantener mi suscripción
        </button>
      </div>
    </Modal>
  );
}
