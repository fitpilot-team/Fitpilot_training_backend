import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ClientCard } from '@/components/nutrition/ClientCard';
import { ArrowUpDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/newAuthStore';
import { useProfessionalClients } from '@/features/professional-clients/queries';
import { useGetAppointments } from '@/features/appointments/queries';
import { IProfessionalClient } from '@/features/professional-clients/types';
import { isAfter, parseISO } from 'date-fns';

// Mapear los campos de la API a lo que espera la UI
interface UIClient extends IProfessionalClient {
    nextAppointment: string | null;
    serviceType: string;
}

export function NutritionClientsPage() {
    const { t } = useTranslation('common');
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [filterType, setFilterType] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Hardcoded ID for now as per user request "/v1/professional-clients/professional/7"
    // but ideally we use user?.id. Using '7' for demonstration.
    const professionalId = user?.id || '7';
    const { data: rawClients, isLoading: isLoadingClients, isError: isErrorClients, error: errorClients } = useProfessionalClients(professionalId);
    const { data: appointments, isLoading: isLoadingAppointments, isError: isErrorAppointments, error: errorAppointments } = useGetAppointments(professionalId);

    const isLoading = isLoadingClients || isLoadingAppointments;
    const isError = isErrorClients || isErrorAppointments;
    const error = errorClients || errorAppointments;

    const clients = useMemo(() => {
        if (!rawClients) return [];
        return rawClients.map((c: IProfessionalClient) => {
            // Find upcoming appointments for this client
            const clientAppointments = (appointments || [])
                .filter(app => Number(app.client_id) === Number(c.id))
                .filter(app => isAfter(parseISO(app.scheduled_at), new Date()))
                .sort((a, b) => parseISO(a.scheduled_at).getTime() - parseISO(b.scheduled_at).getTime());

            const nextApp = clientAppointments[0];

            return {
                ...c,
                nextAppointment: nextApp ? nextApp.scheduled_at : null,
                serviceType: 'Nutrition', // Default for now
            } as UIClient;
        });
    }, [rawClients, appointments]);
    // const clients = useMemo(() => {
    //     if (!rawClients) return [];
    //     return rawClients.map(c => ({
    //         ...c,
    //         // Estos campos podrían venir de la API o ser placeholders si el backend es diferente
    //         firstName: c.name?.split(' ')[0] || 'Cliente',
    //         lastName: c.name?.split(' ').slice(1).join(' ') || `#${c.id}`,
    //         avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || 'User')}&background=random`,
    //         nextAppointment: null, // Placeholder si la API no lo trae aún
    //         serviceType: 'Nutrition', // Default
    //     })) as Client[];
    // }, [rawClients]);

    const filteredClients = useMemo(() => {
        return clients
            .filter(client =>
                `${client.name}`.toLowerCase().includes(searchTerm.toLowerCase())
                // (filterType === 'all' || client.role === filterType)
            )
            .sort((a, b) => {
                if (!a.nextAppointment && !b.nextAppointment) return 0;
                if (!a.nextAppointment) return 1;
                if (!b.nextAppointment) return -1;

                const dateA = new Date(a.nextAppointment).getTime();
                const dateB = new Date(b.nextAppointment).getTime();

                return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            });
    }, [clients, searchTerm, filterType, sortOrder]);

    // Reset to first page when filtering or sorting changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterType, sortOrder]);

    const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedClients = filteredClients.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header Section */}
            <div className="space-y-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {t('nutritionClients', 'Clientes')}
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Gestiona seguimiento de nutrición y entrenamiento de tus clientes.
                    </p>
                </div>

                {/* Search Bar & Filter */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                    <div className="flex gap-2 w-full md:w-auto flex-1">
                        <div className="relative flex-1 md:w-80">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar clientes..."
                                className="block w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:border-nutrition-500 focus:ring-1 focus:ring-nutrition-500 transition-colors"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <button
                            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                            className="flex items-center gap-2 px-4 py-2 hover:cursor-pointer bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:border-nutrition-500 focus:ring-1 focus:ring-nutrition-500 transition-colors shrink-0"
                            title="Ordenar por fecha de próxima cita"
                        >
                            <ArrowUpDown className="h-4 w-4 text-nutrition-600 " />
                            <span className="hidden sm:inline">
                                {sortOrder === 'asc' ? 'Cita más próxima' : 'Cita más lejana'}
                            </span>
                        </button>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        <button
                            onClick={() => setFilterType('all')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap ${filterType === 'all'
                                ? 'bg-nutrition-600 text-white border-nutrition-600'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setFilterType('Nutrition')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap ${filterType === 'Nutrition'
                                ? 'bg-nutrition-600 text-white border-nutrition-600'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            Nutrición
                        </button>
                        <button
                            onClick={() => setFilterType('Coaching')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap ${filterType === 'Coaching'
                                ? 'bg-nutrition-600 text-white border-nutrition-600'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            Coaching
                        </button>
                        <button
                            onClick={() => setFilterType('Nutrition & Coaching')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap ${filterType === 'Nutrition & Coaching'
                                ? 'bg-nutrition-600 text-white border-nutrition-600'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            Ambos
                        </button>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nutrition-600"></div>
                </div>
            ) : isError ? (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-center">
                    <p>Error al cargar los datos: {error?.message || 'Error desconocido'}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-2 text-sm font-semibold underline"
                    >
                        Reintentar
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedClients.map((client) => (
                        <ClientCard
                            key={client.id}
                            image={`${client.profile_picture}`}
                            clientName={`${client.name}`}
                            nextAppointment={client.nextAppointment || null}
                            serviceType={client.serviceType || ''}
                            onAction={() => navigate(`/nutrition/clients/${client.id}`)}
                        />
                    ))}
                </div>
            )}

            {filteredClients.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">No se encontraron clientes.</p>
                </div>
            )}

            {/* Pagination Controls */}
            {filteredClients.length > 0 && (
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>Mostrar</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-nutrition-500 bg-white"
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                        <span>por página</span>
                        <span className="text-gray-400 mx-2">|</span>
                        <span>
                            Mostrando {startIndex + 1} - {Math.min(startIndex + itemsPerPage, filteredClients.length)} de {filteredClients.length}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                let pageNum = i + 1;
                                // Logic to show pages around current page if there are many pages
                                if (totalPages > 5) {
                                    if (currentPage > 3) {
                                        pageNum = currentPage - 2 + i;
                                    }
                                    if (pageNum > totalPages) {
                                        pageNum = totalPages - (4 - i);
                                    }
                                }

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum
                                            ? 'bg-nutrition-600 text-white'
                                            : 'text-gray-600 hover:bg-gray-50'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 transition-colors"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
