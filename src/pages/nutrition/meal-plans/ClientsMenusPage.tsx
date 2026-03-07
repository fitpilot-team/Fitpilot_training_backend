
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, User, Search, Check, X } from 'lucide-react';
import { useGetMenuPool } from '@/features/menus/queries';
import { IMenuPool } from '@/features/menus/types';
import { useNavigate } from 'react-router-dom';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { useProfessionalClients } from '@/features/professional-clients/queries';
import { EnhancedClientSelectorModal } from './components/EnhancedClientSelectorModal';
import { IProfessionalClient } from '@/features/professional-clients/types';

export function ClientsMenusPage() {
    const navigate = useNavigate();
    const { professional } = useProfessional();
    const { data: menus, isLoading } = useGetMenuPool(professional?.sub ? Number(professional.sub) : undefined);
    const { data: clients, isLoading: isLoadingClients } = useProfessionalClients(professional?.sub ? Number(professional.sub) : '');
    
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<IProfessionalClient | null>(null);

    const calculateMenuStats = (menu: IMenuPool) => {
        if (menu.menu_meals && menu.menu_meals.length > 0) {
            const totalCals = menu.menu_meals.reduce((acc: number, meal: any) => acc + (meal.total_calories || 0), 0);
             return {
                calories: Math.round(totalCals),
                equivalents: 0
            };
        }
       return { calories: 0, equivalents: 0 };
    };

    // Group menus by client for the "By Client" view
    const menusGroupedByClient = useMemo(() => {
        if (!menus) return [];
        
        const groupedMap = new Map<number, IMenuPool[]>();
        
        let availableMenus = menus as IMenuPool[];
        
        if (selectedClient) {
            availableMenus = availableMenus.filter(m => m.client_id === selectedClient.id);
        }

        availableMenus.forEach(menu => {
            if (menu.client_id) {
                const existing = groupedMap.get(menu.client_id) || [];
                groupedMap.set(menu.client_id, [...existing, menu]);
            }
        });

        return Array.from(groupedMap.entries()).map(([clientId, clientMenus]) => {
            const client = clients?.find(c => c.id === clientId);
            return {
                client,
                menus: clientMenus,
                totalMenus: clientMenus.length,
                totalCalories: clientMenus.reduce((acc, m) => {
                    const stats = calculateMenuStats(m);
                    return acc + stats.calories;
                }, 0) / clientMenus.length 
            };
        });
    }, [menus, clients, selectedClient]);



    return (
        <div className="space-y-8 pb-20 pt-4">
             {/* Header */}
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-100 rounded-2xl">
                                 <User className="w-6 h-6 text-emerald-600" />
                            </div>
                            Planes Clientes
                        </h1>
                        <p className="text-gray-500 font-medium mt-1 ml-14">
                            Gestión integral de planes nutricionales
                        </p>
                    </div>
                </div>
                
                 <div className="flex items-center gap-3 w-full md:w-auto">
                    <button 
                        onClick={() => setIsClientModalOpen(true)}
                        className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl border transition-all font-black text-sm uppercase tracking-widest shadow-sm ${
                            selectedClient 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-emerald-100' 
                            : 'bg-white border-gray-100 text-gray-500 hover:border-emerald-200 hover:text-emerald-600'
                        }`}
                    >
                        {selectedClient ? (
                            <>
                                <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
                                    <Check className="w-4 h-4" />
                                </div>
                                {selectedClient.name} {selectedClient.lastname}
                                <X 
                                    className="w-4 h-4 ml-2 hover:text-red-500 transition-colors" 
                                    onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        setSelectedClient(null);
                                    }}
                                />
                            </>
                        ) : (
                            <>
                                <Search className="w-5 h-5" />
                                Buscar por cliente
                            </>
                        )}
                    </button>
                </div>
            </div>

            <EnhancedClientSelectorModal 
                isOpen={isClientModalOpen}
                onClose={() => setIsClientModalOpen(false)}
                clients={clients}
                isLoading={isLoadingClients}
                onSelect={(client) => {
                    setSelectedClient(client);
                    setIsClientModalOpen(false);
                }}
            />

            {/* Content Area */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-4xl p-6 h-[200px] animate-pulse border border-gray-100" />
                    ))}
                </div>
            ) : (
                /* By Client Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {menusGroupedByClient.length > 0 ? (
                        menusGroupedByClient.map(({ client, menus: cMenus, totalMenus }) => (
                            <motion.div
                                key={client?.id || Math.random()}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="group bg-white rounded-4xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                                onClick={() => {
                                    if (client) {
                                        setSelectedClient(client);
                                    }
                                }}
                            >
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm ring-1 ring-gray-100 group-hover:ring-emerald-200 transition-all">
                                        {client?.profile_picture ? (
                                            <img src={client.profile_picture} alt={client.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <img 
                                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${client?.email || client?.name || 'unknown'}`} 
                                                alt="avatar" 
                                                className="w-full h-full object-cover opacity-80" 
                                            />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-black text-gray-900 truncate tracking-tight">
                                            {client?.name} {client?.lastname}
                                        </h3>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest truncate">
                                            {totalMenus} {totalMenus === 1 ? 'Menú asignado' : 'Menús asignados'}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-6">
                                    {cMenus.slice(0, 2).map(m => (
                                        <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                                <span className="text-xs font-bold text-gray-700 truncate">{m.title}</span>
                                            </div>
                                            <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                                        </div>
                                    ))}
                                    {totalMenus > 2 && (
                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center pt-1">
                                            + {totalMenus - 2} más
                                        </p>
                                    )}
                                </div>

                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (client?.id) {
                                            navigate(`/nutrition/meal-plans/clients-menus/weekly-view/${client.id}`);
                                        }
                                    }}
                                    className="w-full py-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all"
                                >
                                    Ver Planificación Semanal
                                </button>
                            </motion.div>
                        ))
                    ) : (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
                             <div className="p-6 bg-white rounded-3xl shadow-sm mb-4">
                                <User className="w-12 h-12 text-gray-300" />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 mb-2">No hay clientes con menús</h3>
                            <p className="text-gray-500 text-center max-w-md mb-8 font-medium">
                                Los clientes que tengan menús en tu colección aparecerán aquí agrupados.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
