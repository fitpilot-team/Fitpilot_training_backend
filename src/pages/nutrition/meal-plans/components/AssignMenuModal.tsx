import { useState, useMemo } from 'react';
import { Modal } from '@/components/common/Modal';
import { useGetMenus } from '@/features/menus/queries';
import { Search, Loader2, Check, Flame, Scale, ChefHat } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { IMenu } from '@/features/menus/types';

interface AssignMenuModalProps {
    isOpen: boolean;
    onClose: () => void;
    professionalId?: number;
    clientName: string;
    onConfirm: (menuIds: number[]) => void;
}

export function AssignMenuModal({ isOpen, onClose, professionalId, clientName, onConfirm }: AssignMenuModalProps) {
    const { data: menus, isLoading } = useGetMenus(professionalId);
    
    // API call removed, logic moved to parent
    
    const [selectedMenuIds, setSelectedMenuIds] = useState<number[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredMenus = useMemo(() => {
        if (!menus) return [];
        return menus.filter(menu => 
            (menu.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (menu.description_ || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [menus, searchQuery]);

    const toggleMenu = (menuId: number) => {
        setSelectedMenuIds(prev => 
            prev.includes(menuId) 
                ? prev.filter(id => id !== menuId)
                : [...prev, menuId]
        );
    };

    const handleAssign = () => {
        if (selectedMenuIds.length === 0) {
            toast.error('Selecciona al menos un menú');
            return;
        }

        onConfirm(selectedMenuIds);
        onClose();
        // Keep selection or clear it? Clearing for now to reset state on next open
        setSelectedMenuIds([]);
    };

    const calculateMenuStats = (menu: IMenu) => {
        let totalCalories = 0;
        let totalEquivalents = 0;
        const groupStats: Record<string, { count: number; color: string; id: number }> = {};
        const mealNames = new Set<string>();

        menu.menu_meals.forEach(meal => {
            mealNames.add(meal.name);
            const items = meal.menu_items_menu_items_menu_meal_idTomenu_meals || [];
            
            items.forEach(item => {
                const food = item.foods;
                const group = item.exchange_groups;
                
                if (food && group) {
                    const nutritionValue = food.food_nutrition_values?.[0];
                    
                    if (nutritionValue) {
                        const grams = item.quantity;
                        const baseSize = parseFloat(String(nutritionValue.base_serving_size)) || 1;
                        const foodCal = parseFloat(String(nutritionValue.calories_kcal)) || 0;
                        const avgCal = group.avg_calories || 1;
                        
                        const ratio = grams / baseSize;
                        totalCalories += foodCal * ratio;
                        const exchanges = (grams * foodCal) / (baseSize * avgCal);
                        totalEquivalents += exchanges;

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

        const sortedGroups = Object.entries(groupStats)
            .map(([name, stat]) => ({ name, ...stat }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 4);

        const mealsList = Array.from(mealNames);

        return {
            calories: Math.round(totalCalories),
            equivalents: Math.round(totalEquivalents),
            groups: sortedGroups,
            meals: mealsList
        };
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Asignar menús a ${clientName}`} size="full">
            <div className="space-y-6 h-[80vh] flex flex-col">
               {/* Search */}
               <div className="relative shrink-0">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                   <input 
                       type="text"
                       placeholder="Buscar menús..."
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-base outline-none focus:ring-2 focus:ring-emerald-500"
                   />
               </div>

               {/* List */}
               <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar p-1">
                   {isLoading ? (
                       <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
                   ) : filteredMenus.length === 0 ? (
                       <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                           <Search className="w-12 h-12 mb-4 opacity-20" />
                           <p>No se encontraron menús</p>
                       </div>
                   ) : (
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                           {filteredMenus.map(menu => {
                               const isSelected = selectedMenuIds.includes(menu.id);
                               const stats = calculateMenuStats(menu);

                               return (
                                   <div 
                                       key={menu.id}
                                       onClick={() => toggleMenu(menu.id)}
                                       className={`
                                            relative rounded-[2rem] p-5 border-2 transition-all cursor-pointer group hover:shadow-lg
                                            ${isSelected 
                                                ? 'bg-emerald-50/50 border-emerald-500 shadow-emerald-500/10' 
                                                : 'bg-white border-gray-100 hover:border-emerald-200 hover:shadow-emerald-500/5'
                                            }
                                       `}
                                   >
                                        {/* Selection Checkmark */}
                                        <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                                            ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-gray-200 group-hover:border-emerald-300'}`}>
                                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                        </div>

                                        {/* Header */}
                                        <div className="flex items-start gap-4 mb-4 pr-8">
                                            <div className="p-3 bg-emerald-50 rounded-2xl shrink-0">
                                                <ChefHat className="w-6 h-6 text-emerald-600" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 leading-tight mb-1 line-clamp-1">{menu.title || `Menú ${menu.id}`}</h4>
                                                
                                                <div className="flex items-center gap-2">
                                                    {menu.is_reusable && (
                                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider rounded-md">
                                                            Plantilla
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-gray-400 font-medium">
                                                        {menu.menu_meals.length} comidas
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="flex gap-2 mb-4">
                                            <div className="px-2.5 py-1 bg-gray-50 rounded-lg flex items-center gap-1.5 border border-gray-100">
                                                <Flame className="w-3 h-3 text-orange-500" />
                                                <span className="text-[10px] font-black text-gray-700">
                                                    {stats.calories}
                                                </span>
                                            </div>
                                            <div className="px-2.5 py-1 bg-gray-50 rounded-lg flex items-center gap-1.5 border border-gray-100">
                                                <Scale className="w-3 h-3 text-blue-500" />
                                                <span className="text-[10px] font-black text-gray-700">
                                                    {stats.equivalents} eq.
                                                </span>
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <p className="text-xs text-gray-400 font-medium line-clamp-2 mb-4 min-h-[2.5em]">
                                            {menu.description_ || 'Sin descripción disponible.'}
                                        </p>

                                        {/* Groups Summary (Mini) */}
                                        <div className="grid grid-cols-2 gap-2">
                                            {stats.groups.slice(0, 2).map((group, idx) => (
                                                <div key={idx} className="flex items-center gap-2 p-1.5 bg-gray-50 rounded-lg border border-gray-100">
                                                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                                                    <span className="text-[10px] text-gray-500 truncate">{group.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                   </div>
                               );
                           })}
                       </div>
                   )}
               </div>

               {/* Actions */}
               <div className="flex items-center justify-between pt-4 border-t border-gray-100 shrink-0">
                   <div className="text-sm font-medium text-gray-500">
                       {selectedMenuIds.length > 0 ? (
                           <span className="text-emerald-600 font-bold">{selectedMenuIds.length} menús seleccionados</span>
                       ) : (
                           'Selecciona menús para asignar'
                       )}
                   </div>
                   <div className="flex items-center gap-3">
                       <button 
                           onClick={onClose}
                           className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                       >
                           Cancelar
                       </button>
                       <button
                           onClick={handleAssign}
                           disabled={selectedMenuIds.length === 0}
                           className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5"
                       >
                           <Check className="w-4 h-4" />
                           Asignar Menús
                       </button>
                   </div>
               </div>
            </div>
        </Modal>
    );
}
