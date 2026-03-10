import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, ChefHat, Flame, Scale, Clock, ChevronRight, LayoutTemplate, Trash2 } from 'lucide-react';
import { useGetMenus, useUpdateMenu } from '@/features/menus/queries';
import { IMenu } from '@/features/menus/types';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/common/Modal';
import { useProfessional } from '@/contexts/ProfessionalContext';

export function ReusableMenusPage() {
    const navigate = useNavigate();
    const { professional } = useProfessional();
    const { data: menus, isLoading } = useGetMenus(professional?.sub ? Number(professional.sub) : undefined);
    const { mutate: updateMenu, isPending: isDeleting } = useUpdateMenu();
    
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [menuToDelete, setMenuToDelete] = useState<number | null>(null);

    const handleDeleteClick = (id: number) => {
        setMenuToDelete(id);
        setDeleteModalOpen(true);
    };

    const confirmDelete = () => {
        if (menuToDelete) {
            updateMenu({ id: menuToDelete, data: { is_reusable: false } }, {
                onSuccess: () => {
                    setDeleteModalOpen(false);
                    setMenuToDelete(null);
                }
            });
        }
    };

    const reusableMenus = useMemo(() => {
        return menus?.filter(m => m.is_reusable) || [];
    }, [menus]);

    const calculateMenuStats = (menu: IMenu) => {
        let totalCalories = 0;
        let totalEquivalents = 0;
        const groupStats: Record<string, { count: number; color: string; id: number }> = {};
        const mealNames = new Set<string>();

        menu.menu_meals.forEach(meal => {
            mealNames.add(meal.name);

            // Handle nested menu items structure if it exists, or assume direct array if fixed
            const items = meal.menu_items_menu_items_menu_meal_idTomenu_meals || [];
            
            items.forEach(item => {
                const food = item.foods;
                const group = item.exchange_groups;
                
                if (food && group) {
                    const nutritionValue = food.food_nutrition_values?.[0]; // Default to first
                    
                    if (nutritionValue) {
                        const grams = item.quantity; // Assuming quantity is grams based on existing logic
                        const baseSize = parseFloat(String(nutritionValue.base_serving_size)) || 1;
                        const foodCal = parseFloat(String(nutritionValue.calories_kcal)) || 0;
                        const avgCal = group.avg_calories || 1;
                        
                        // Ratio of consumption vs base size
                        const ratio = grams / baseSize;
                        
                        // Calories
                        totalCalories += foodCal * ratio;
                        
                        // Exchanges
                        // Calculate exchanges: (Grams * FoodCal) / (BaseSize * AvgGroupCal)
                        const exchanges = (grams * foodCal) / (baseSize * avgCal);
                        
                        totalEquivalents += exchanges;

                        // Group Stats
                        if (!groupStats[group.name]) {
                            groupStats[group.name] = { 
                                count: 0, 
                                color: group.color_code || '#cbd5e1',
                                id: group.id
                            };
                        }
                        groupStats[group.name].count += exchanges;
                    }
                }
            });
        });

        // Convert groupStats to array and sort by count desc
        const sortedGroups = Object.entries(groupStats)
            .map(([name, stat]) => ({ name, ...stat }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 4); // Top 4

        // Map meal names to standardized chips if possible, or just use list
        const mealsList = Array.from(mealNames);

        return {
            calories: Math.round(totalCalories),
            equivalents: Math.round(totalEquivalents),
            groups: sortedGroups,
            meals: mealsList
        };
    };

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-gray-500 font-medium tracking-wide">Cargando menús reutilizables...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 min-h-screen bg-gray-50/50">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 mb-8"
            >
                <div className="p-3 bg-emerald-100 rounded-2xl">
                    <LayoutTemplate className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                        Menús Reutilizables
                    </h1>
                    <p className="text-gray-500 font-medium">
                        Plantillas de menús listas para asignar a tus planes nutricionales
                    </p>
                </div>
            </motion.div>

            {reusableMenus.length > 0 && (
                <div className="flex justify-end mb-8">
                     <button 
                        onClick={() => navigate('/nutrition/meal-plans/create-menu')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/25 active:scale-95"
                    >
                        <ChefHat className="w-5 h-5" />
                        Crear Nuevo Menú
                    </button>
                </div>
            )}

            {reusableMenus.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 border border-gray-100 shadow-sm text-center">
                    <div className="w-24 h-24 bg-gray-50 rounded-full mx-auto flex items-center justify-center mb-6">
                        <Copy className="w-12 h-12 text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                        No hay menús reutilizables
                    </h3>
                    <p className="text-gray-500 max-w-md mx-auto mb-8">
                        Crea menús y márcalos como reutilizables para que aparezcan aquí.
                    </p>
                    <button 
                        onClick={() => navigate('/nutrition/meal-plans/create-menu')}
                        className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/25"
                    >
                        Crear Nuevo Menú
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {reusableMenus.map((menu) => {
                        const stats = calculateMenuStats(menu);
                        
                        return (
                            <motion.div
                                key={menu.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ y: -4 }}
                                className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group"
                            >
                                {/* Header */}
                                <div className="flex justify-between items-start mb-6">
                                    <div className="p-4 bg-emerald-50 rounded-2xl group-hover:bg-emerald-100 transition-colors">
                                        <ChefHat className="w-8 h-8 text-emerald-600" />
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className="px-3 py-1 bg-emerald-100/50 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100">
                                            PLANTILLA
                                        </span>
                                        <div className="flex gap-2">
                                            <div className="px-3 py-1 bg-gray-50 rounded-full flex items-center gap-1.5 border border-gray-100">
                                                <Flame className="w-3 h-3 text-orange-500" />
                                                <span className="text-xs font-black text-gray-700">
                                                    {stats.calories} <span className="text-[9px] text-gray-400">KCAL</span>
                                                </span>
                                            </div>
                                            <div className="px-3 py-1 bg-gray-50 rounded-full flex items-center gap-1.5 border border-gray-100">
                                                <Scale className="w-3 h-3 text-blue-500" />
                                                <span className="text-xs font-black text-gray-700">
                                                    {stats.equivalents} <span className="text-[9px] text-gray-400">EQUIV.</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Title & Description */}
                                <div className="mb-6">
                                    <div className="flex justify-between items-start gap-4">
                                        <h3 className="text-2xl font-black text-gray-900 leading-tight mb-2 line-clamp-2">
                                            {menu.title || `Menú #${menu.id}`} 
                                        </h3>

                                        <button 
                                            className="text-gray-300 hover:text-red-500 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteClick(menu.id);
                                            }}
                                            title="Eliminar de reutilizables"
                                        >
                                           <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <p className="text-gray-400 text-sm font-medium line-clamp-2 min-h-[2.5em]">
                                        {menu.description_ || 'Sin descripción disponible.'}
                                    </p>
                                </div>

                                {/* Meal Distribution */}
                                <div className="mb-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Clock className="w-3.5 h-3.5 text-emerald-500" />
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                            Distribución de Comidas
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {stats.meals.length > 0 ? stats.meals.map((mealName, idx) => (
                                            <span 
                                                key={idx}
                                                className="px-3 py-1.5 bg-gray-50 rounded-xl text-xs font-bold text-gray-600 border border-gray-100 flex items-center gap-1.5"
                                            >
                                                <div className={`w-1.5 h-1.5 rounded-full ${['Desayuno', 'Comida'].includes(mealName) ? 'bg-amber-400' : 'bg-indigo-400'}`} />
                                                {mealName}
                                            </span>
                                        )) : (
                                            <span className="text-xs text-gray-400 italic">Sin comidas asignadas</span>
                                        )}
                                    </div>
                                </div>

                                {/* Equivalents Summary */}
                                <div className="mb-8">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Scale className="w-3.5 h-3.5 text-emerald-500" />
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                            Resumen de Equivalentes
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {stats.groups.map((group, idx) => (
                                            <div 
                                                key={idx}
                                                className="p-3 bg-gray-50/50 rounded-2xl border border-gray-100 flex items-center gap-3"
                                            >
                                                <div 
                                                    className="w-2.5 h-2.5 rounded-full" 
                                                    style={{ backgroundColor: group.color }} 
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider line-clamp-1">
                                                        {group.name}
                                                    </span>
                                                    <span className="text-sm font-black text-gray-900">
                                                        {Math.round(group.count)} <span className="text-[9px] font-normal text-gray-400">eq.</span>
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-3 pt-6 border-t border-gray-100">
                                    <button 
                                        className="flex-1 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 group/btn"
                                        onClick={() => navigate(`/nutrition/meal-plans/create-menu?fromMenuId=${menu.id}&clientId=0`)}
                                    >
                                        Usar este plan
                                        <ChevronRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            <Modal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="Eliminar menú reutilizable"
                size="md"
            >
                <div className="space-y-6 pt-4">
                    <div className="flex flex-col items-center text-center gap-4">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                            <Trash2 className="w-8 h-8 text-red-500" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gray-900">
                                ¿Estás seguro?
                            </h3>
                            <p className="text-gray-500 text-sm max-w-xs mx-auto">
                                Este menú dejará de aparecer en tus plantillas reutilizables, pero no se eliminará del historial de menús.
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                        <button
                            onClick={() => setDeleteModalOpen(false)}
                            className="px-5 py-2.5 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all uppercase tracking-wide"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={confirmDelete}
                            disabled={isDeleting}
                            className="px-6 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-red-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-wide text-xs flex items-center gap-2"
                        >
                            {isDeleting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Eliminando...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4" />
                                    Eliminar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
