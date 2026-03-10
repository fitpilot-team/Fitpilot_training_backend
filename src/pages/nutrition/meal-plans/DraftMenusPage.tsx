import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGetDrafts } from '@/features/menus/queries';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { useAuthStore } from '@/store/newAuthStore';
import { useProfessionalClients } from '@/features/professional-clients/queries';
import { 
    Clock, 
    User, 
    FileText, 
    Loader2,
    ChevronRight,
    Sparkles,
    Search,
    SortAsc,
    SortDesc, 
    X
} from 'lucide-react';
import { format, parseISO, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Input } from '@/components/common/Input';
import { DatePicker } from '@/components/common/DatePicker';

export function DraftMenusPage() {
    const navigate = useNavigate();
    const { professional } = useProfessional();
    const { user } = useAuthStore();
    const professionalId = professional?.sub || user?.id;

    const { data: drafts, isLoading: isLoadingDrafts } = useGetDrafts(Number(professionalId));
    const { data: clients } = useProfessionalClients(professionalId?.toString() || '');

    // State for filtering and sorting
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [showUnassigned, setShowUnassigned] = useState(false);

    const filteredAndSortedDrafts = useMemo(() => {
        if (!drafts) return [];

        let result = [...drafts];

        // Filter by Unassigned
        if (showUnassigned) {
            result = result.filter(draft => !draft.client_id);
        }

        // Filter by Client Name
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(draft => {
                const client = clients?.find(c => Number(c.id) === Number(draft.client_id));
                const clientName = client?.name?.toLowerCase() || '';
                return clientName.includes(lowerTerm);
            });
        }

        // Filter by Date
        if (selectedDate) {
            result = result.filter(draft => {
                if (!draft.last_autosave) return false; // Or decide how to handle missing dates
                const draftDate = new Date(draft.last_autosave);
                const filterDate = parseISO(selectedDate);
                return isSameDay(draftDate, filterDate);
            });
        }

        // Sort by Date
        result.sort((a, b) => {
            const dateA = new Date(a.last_autosave || 0).getTime();
            const dateB = new Date(b.last_autosave || 0).getTime();
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });

        return result;
    }, [drafts, clients, searchTerm, selectedDate, sortOrder, showUnassigned]);

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedDate('');
        setSortOrder('desc');
        setShowUnassigned(false);
    };

    if (isLoadingDrafts) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Cargando borradores...</p>
            </div>
        );
    }

    if (!drafts || drafts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mb-6">
                    <FileText className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No tienes borradores</h3>
                <p className="text-gray-500 max-w-sm mb-8">
                    Tus menús no terminados se guardan automáticamente aquí para que puedas continuarlos después.
                </p>
                <button
                    onClick={() => navigate('/nutrition/meal-plans/builder')}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
                >
                    Ir al Constructor
                </button>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900">Menús sin terminar</h2>
                    <p className="text-gray-500">Continúa trabajando en tus planes guardados automáticamente</p>
                </div>

                {/* Filters & Sorting Controls */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="w-full sm:w-64">
                         <Input
                            placeholder="Buscar por cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            icon={<Search className="w-4 h-4" />}
                            className="bg-white"
                            disabled={showUnassigned} 
                        />
                    </div>
                    
                    <div className="w-full sm:w-auto min-w-[180px]">
                        <DatePicker
                            value={selectedDate}
                            onChange={setSelectedDate}
                            placeholder="Filtrar por fecha"
                        />
                    </div>

                    <button
                        onClick={() => setShowUnassigned(!showUnassigned)}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-center gap-2 text-sm font-bold
                            ${showUnassigned 
                                ? 'bg-orange-50 border-orange-200 text-orange-600 ring-2 ring-orange-100' 
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                            }`}
                        title="Ver solo menús sin cliente asignado"
                    >
                        <User className="w-5 h-5" />
                        <span className="hidden md:inline">No Asignado</span>
                    </button>

                    <button
                        onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                        className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors text-gray-600"
                        title={sortOrder === 'desc' ? "Más recientes primero" : "Más antiguos primero"}
                    >
                        {sortOrder === 'desc' ? <SortDesc className="w-5 h-5" /> : <SortAsc className="w-5 h-5" />}
                    </button>

                    {(searchTerm || selectedDate || showUnassigned) && (
                        <button
                            onClick={clearFilters}
                            className="p-2.5 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                            title="Limpiar filtros"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode='popLayout'>
                    {filteredAndSortedDrafts.length > 0 ? (
                        filteredAndSortedDrafts.map((draft) => {
                            const client = clients?.find(c => Number(c.id) === Number(draft.client_id));
                            const lastSave = new Date(draft.last_autosave);
                            
                            return (
                                <motion.div
                                    layout
                                    key={draft.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    className="group bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-100/50 hover:border-blue-100 transition-all duration-300 flex flex-col"
                                >
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                                                {client ? (
                                                    <img 
                                                        src={client.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(client.name || '')}&background=random`} 
                                                        alt={client.name}
                                                        className="w-full h-full rounded-2xl object-cover"
                                                    />
                                                ) : (
                                                    <User className="w-6 h-6 text-gray-400 group-hover:text-blue-500" />
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 truncate max-w-[150px]">
                                                    {client?.name || 'Nuevo Menú'}
                                                </h4>
                                                <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                                                    <Clock className="w-3 h-3" />
                                                    {format(lastSave, "d 'de' MMM, HH:mm", { locale: es })}
                                                </div>
                                            </div>
                                        </div>
                                        {draft.is_ai_generated && (
                                            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl" title="Generado con IA">
                                                <Sparkles className="w-4 h-4" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3 mb-6 flex-1">
                                        <div className="flex items-center justify-between text-xs py-2 border-b border-gray-50">
                                            <span className="text-gray-400 font-bold uppercase tracking-wider">Comidas</span>
                                            <span className="text-gray-700 font-bold">
                                                {draft.json_data?.localMeals?.length || 0}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs py-2 border-b border-gray-50">
                                            <span className="text-gray-400 font-bold uppercase tracking-wider">Estado</span>
                                            <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-bold">
                                                Borrador
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => {
                                            const params = new URLSearchParams();
                                            params.set('draftId', draft.id);
                                            if (draft.client_id) params.set('clientId', draft.client_id.toString());
                                            navigate(`/nutrition/meal-plans/create-menu?${params.toString()}`);
                                        }}
                                        className="w-full py-3 bg-gray-50 text-gray-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 hover:text-white transition-all active:scale-[0.98]"
                                    >
                                        Continuar Editando
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            );
                        })
                    ) : (
                        <div className="col-span-full py-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <Search className="w-6 h-6 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">No se encontraron resultados</h3>
                            <p className="text-gray-500">Intenta ajustar los filtros de búsqueda</p>
                            <button 
                                onClick={clearFilters}
                                className="mt-4 text-blue-600 font-bold text-sm hover:underline"
                            >
                                Limpiar filtros
                            </button>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
