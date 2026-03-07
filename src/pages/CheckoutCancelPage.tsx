import { useNavigate } from 'react-router-dom';
import { XCircleIcon } from '@heroicons/react/24/outline';

export function CheckoutCancelPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-6 transform transition-all">
        <div className="flex justify-center flex-col items-center">
          <div className="rounded-full bg-red-100 p-3 mb-4 inline-block">
            <XCircleIcon className="w-16 h-16 text-red-500" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Pago Cancelado</h1>
        </div>
        
        <p className="text-lg text-gray-500">
          El proceso de pago ha sido cancelado. No se han realizado cargos en tu tarjeta. 
          Puedes volver a intentar cuando estés listo.
        </p>

        <div className="pt-6 space-y-3">
          <button
            onClick={() => navigate('/subscriptions/plans')}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Volver a los planes
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Ir al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
