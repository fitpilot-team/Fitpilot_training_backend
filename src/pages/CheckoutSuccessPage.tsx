import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { verifyCheckoutSession } from '@/features/subscriptions/api';

export function CheckoutSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoading, userData, refreshProfessional } = useProfessional();
  const sessionId = searchParams.get('session_id');
  const [hasCheckedSubscription, setHasCheckedSubscription] = useState(false);
  const [verifiedSubscriptionActive, setVerifiedSubscriptionActive] = useState<boolean | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const refreshProfessionalRef = useRef(refreshProfessional);

  useEffect(() => {
    refreshProfessionalRef.current = refreshProfessional;
  }, [refreshProfessional]);

  useEffect(() => {
    let cancelled = false;

    const syncSubscription = async () => {
      try {
        setVerificationError(null);
        if (sessionId) {
          const verification = await verifyCheckoutSession(sessionId);
          if (!cancelled) {
            setVerifiedSubscriptionActive(verification.has_active_subscription === true);
          }
        }

        await refreshProfessionalRef.current(true);
      } catch {
        if (!cancelled) {
          setVerificationError(
            'No pudimos validar la sesion con el servidor. Si el cargo ya fue aprobado, recarga esta pagina en unos segundos.'
          );
        }
      } finally {
        if (!cancelled) {
          setHasCheckedSubscription(true);
        }
      }
    };

    void syncSubscription();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const hasActiveSubscription =
    verifiedSubscriptionActive ?? (userData?.has_active_subscription === true);
  const isVerifying = !hasCheckedSubscription || isLoading;

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-6 transform transition-all">
        <div className="flex justify-center flex-col items-center">
          <div className={`rounded-full p-3 mb-4 inline-block ${hasActiveSubscription ? 'bg-green-100' : 'bg-amber-100'}`}>
            <CheckCircleIcon className={`w-16 h-16 ${hasActiveSubscription ? 'text-green-500' : 'text-amber-500'}`} />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            {isVerifying
              ? 'Confirmando suscripcion'
              : hasActiveSubscription
                ? 'Suscripcion activada'
                : 'Pago recibido'}
          </h1>
        </div>
        
        <p className="text-lg text-gray-500">
          {isVerifying
            ? 'Estamos sincronizando tu suscripcion con Stripe. Esto puede tardar unos segundos.'
            : hasActiveSubscription
              ? 'Tu suscripcion ya aparece activa en tu cuenta. Ya puedes usar tu nuevo plan.'
              : 'Stripe ya te redirigio correctamente, pero la activacion aun no aparece en tu cuenta. Recarga en unos segundos o vuelve a intentar.'}
        </p>

        {verificationError && !isVerifying && (
          <p className="text-sm text-amber-600">{verificationError}</p>
        )}

        {sessionId && (
          <p className="text-xs text-gray-400 break-all">Sesion: {sessionId}</p>
        )}

        <div className="pt-6">
          <button
            onClick={() => navigate('/')}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Ir al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
