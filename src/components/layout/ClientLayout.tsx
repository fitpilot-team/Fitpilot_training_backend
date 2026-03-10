import { useEffect, useState } from 'react';
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Button } from '../common/Button';
import { useClientStore } from '../../store/clientStore';
import { clientsApi } from '../../services/clients';
import type { Client } from '../../types/client';

/**
 * ClientLayout - Solo maneja la carga del cliente
 * El sidebar ahora está unificado en Sidebar.tsx
 */
export function ClientLayout() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { selectClient } = useClientStore();

  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar cliente y guardarlo en el store
  useEffect(() => {
    if (!clientId) return;

    const fetchClient = async () => {
      setIsLoading(true);
      try {
        const data = await clientsApi.getClient(clientId);
        setClient(data);
        selectClient(data); // Sidebar lo usará
      } catch (err: any) {
        setError(err.message || 'Error al cargar cliente');
      } finally {
        setIsLoading(false);
      }
    };

    fetchClient();
  }, [clientId, selectClient]);

  // Limpiar cliente al salir de la ruta
  useEffect(() => {
    return () => {
      selectClient(null);
    };
  }, [selectClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Cliente no encontrado'}</p>
          <Button variant="secondary" onClick={() => navigate('/clients')}>
            Volver a Clientes
          </Button>
        </div>
      </div>
    );
  }

  return <Outlet context={{ client }} />;
}

// Hook para acceder al cliente en rutas hijas
export function useClientContext() {
  const { client } = (useLocation() as any).state || {};
  return { client };
}
