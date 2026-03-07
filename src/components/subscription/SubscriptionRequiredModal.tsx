import { LockClosedIcon, CreditCardIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/common/Modal';

interface SubscriptionRequiredModalProps {
  isOpen: boolean;
}

export function SubscriptionRequiredModal({ isOpen }: SubscriptionRequiredModalProps) {
  const navigate = useNavigate();

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      size="md"
      panelClassName="border-red-100 shadow-red-500/10"
    >
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
            <LockClosedIcon className="w-7 h-7 text-red-600" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-gray-900">Suscripción requerida</h3>
            <p className="text-sm text-gray-600">
              Para continuar usando FitPilot necesitas elegir una suscripción activa.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/subscriptions/plans')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <CreditCardIcon className="w-4 h-4" />
            Ver planes
          </button>
        </div>
      </div>
    </Modal>
  );
}
