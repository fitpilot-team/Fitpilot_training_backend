
import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    DndContext, 
    DragOverlay, 
    useSensor, 
    useSensors, 
    PointerSensor,
    DragStartEvent,
    DragEndEvent,
    closestCenter
} from '@dnd-kit/core';
import { 
    SortableContext, 
    verticalListSortingStrategy,
    useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, startOfWeek, addDays, parseISO, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Calendar, Flame, ChevronRight, GripVertical, AlertCircle } from 'lucide-react';
import { useGetMenuPool, useSwapDailyMenu, useGetMenuPoolCalendar } from '@/features/menus/queries';
import { useProfessionalClients } from '@/features/professional-clients/queries';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { IMenuPool } from '@/features/menus/types';
import toast from 'react-hot-toast';
import { DatePicker } from '@/components/common/DatePicker';

// --- Types ---
type DayColumn = {
    date: Date;
    dayName: string;
    menus: IMenuPool[];
};

// --- Components ---

// Draggable Menu Card
const MenuCard = ({ menu, isOverlay = false }: { menu: IMenuPool, isOverlay?: boolean }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ 
        id: menu.menu_id_selected_client || menu.id,
        data: {
            type: 'menu',
            menu
        }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    if (isDragging) {
        return (
            <div 
                ref={setNodeRef} 
                style={style} 
                className="opacity-40 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl h-32 mb-3"
            />
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`
                group bg-white rounded-2xl p-4 border border-gray-100 shadow-sm 
                hover:shadow-md hover:border-emerald-200 transition-all cursor-grab active:cursor-grabbing mb-3 mt-1
                ${isOverlay ? 'shadow-xl scale-105 rotate-2 cursor-grabbing border-emerald-500 ring-2 ring-emerald-500/20' : ''}
            `}
        >
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gray-50 text-gray-400 rounded-lg group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                        <GripVertical className="w-4 h-4" />
                    </div>
                    {menu.assigned_date && (
                        <div className="px-2 py-1 bg-gray-50 rounded-lg border border-gray-100 flex items-center gap-1.5">
                             <Calendar className="w-3 h-3 text-gray-400" />
                             <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                                {format(parseISO(menu.assigned_date.split('T')[0]), 'd MMM', { locale: es })}
                             </span>
                        </div>
                    )}
                </div>
                <div className="bg-orange-50 px-2 py-1 rounded-lg border border-orange-100 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-orange-400" />
                    <span className="text-[10px] font-bold text-orange-700">
                        {menu.menu_meals?.reduce((acc, m) => acc + (m.total_calories || 0), 0).toFixed(0)} kcal
                    </span>
                </div>
            </div>

            <h4 className="font-bold text-gray-900 leading-tight mb-3 line-clamp-2 text-sm">
                {menu.title}
            </h4>

            <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                    {menu.menu_meals?.length} Comidas
                </span>
                <ChevronRight className="w-3 h-3 text-gray-300" />
            </div>
        </div>
    );
};

// Droppable Day Column
const DayColumn = ({ day, isToday }: { day: DayColumn, isToday: boolean }) => {
    const { setNodeRef, isOver } = useSortable({
        id: day.date.toISOString(),
        data: {
            type: 'column',
            date: day.date
        }
    });

    return (
        <div 
            ref={setNodeRef}
            className={`
                shrink-0 w-72 h-full flex flex-col rounded-3xl transition-colors duration-200
                ${isOver ? 'bg-emerald-50/50 ring-2 ring-emerald-500/20' : 'bg-gray-50/50'}
                ${isToday ? 'bg-emerald-50/30' : ''}
            `}
        >
            {/* Column Header */}
            <div className={`
                p-4 border-b border-gray-100 flex items-center justify-between
                ${isToday ? 'bg-emerald-100/50 text-emerald-900 rounded-t-3xl' : ''}
            `}>
                <div>
                    <p className={`text-xs font-black uppercase tracking-widest ${isToday ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {day.dayName}
                    </p>
                    <p className={`text-lg font-bold ${isToday ? 'text-emerald-700' : 'text-gray-900'}`}>
                        {format(day.date, 'd MMM', { locale: es })}
                    </p>
                </div>
                {isToday && (
                    <span className="text-[10px] bg-emerald-500 text-white px-2 py-1 rounded-full font-bold uppercase tracking-wider">
                        Hoy
                    </span>
                )}
            </div>

            {/* Droppable Area */}
            <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
                <SortableContext 
                    items={day.menus.map(m => m.menu_id_selected_client || m.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {day.menus.length > 0 ? (
                        day.menus.map(menu => (
                            <MenuCard key={menu.menu_id_selected_client || menu.id} menu={menu} />
                        ))
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-200 rounded-2xl p-4">
                            <Calendar className="w-8 h-8 mb-2 opacity-50" />
                            <span className="text-xs font-medium text-center">Sin menús</span>
                        </div>
                    )}
                </SortableContext>
            </div>
        </div>
    );
};


// Draggable Sidebar Menu Item
const SidebarPoolMenu = ({ menu }: { menu: IMenuPool }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        isDragging
    } = useSortable({ 
        id: `pool-${menu.id}`,
        data: {
            type: 'pool-menu',
            menu
        }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm mb-3 cursor-grab hover:border-emerald-300 hover:shadow-md transition-all"
        >
            <h4 className="font-bold text-gray-800 text-xs mb-1 line-clamp-2">{menu.title}</h4>
            <div className="flex items-center gap-2">
                 <span className="text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded font-bold border border-orange-100">
                    {menu.menu_meals?.reduce((acc, m) => acc + (m.total_calories || 0), 0).toFixed(0)} kcal
                 </span>
            </div>
        </div>
    );
};

const WeeklyViewSkeleton = () => (
    <div className="h-[calc(100vh-6rem)] flex flex-col -m-6 px-6 pb-6 pt-10 animate-pulse">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
            <div>
                <div className="h-4 w-32 bg-gray-200 rounded-lg mb-3" />
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-2xl" />
                    <div className="h-8 w-64 bg-gray-200 rounded-xl" />
                </div>
            </div>
            <div className="flex gap-4">
                <div className="w-40 h-10 bg-gray-200 rounded-xl" />
                <div className="w-48 h-10 bg-gray-200 rounded-xl" />
            </div>
        </div>

        <div className="flex flex-1 overflow-hidden gap-6">
            {/* Calendar Columns */}
            <div className="flex-1 flex gap-4 overflow-hidden">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="shrink-0 w-72 h-full bg-gray-50 rounded-3xl border border-gray-100 p-4">
                        <div className="flex justify-between mb-6">
                            <div className="space-y-2">
                                <div className="h-3 w-16 bg-gray-200 rounded" />
                                <div className="h-6 w-12 bg-gray-200 rounded" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="h-40 bg-white rounded-2xl border border-gray-100" />
                            <div className="h-32 bg-white rounded-2xl border border-gray-100" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Sidebar */}
            <div className="w-[20%] min-w-[250px] bg-white rounded-3xl border border-gray-100 p-4">
                <div className="h-6 w-32 bg-gray-200 rounded mb-6" />
                <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-20 bg-gray-50 rounded-xl border border-gray-100" />
                    ))}
                </div>
            </div>
        </div>
    </div>
);

export function ClientWeeklyMenuView() {
    const { clientId } = useParams();
    const navigate = useNavigate();
    const { professional } = useProfessional();
    const { data: poolMenusRaw, isLoading: isLoadingPool } = useGetMenuPool(professional?.sub ? Number(professional.sub) : undefined);
    const { data: calendarMenusRaw, isLoading: isLoadingCalendar } = useGetMenuPoolCalendar(professional?.sub ? Number(professional.sub) : undefined, Number(clientId));
    const { data: clients, isLoading: isLoadingClients } = useProfessionalClients(professional?.sub ? Number(professional.sub) : '');
    const swapMenuMutation = useSwapDailyMenu();
    
    // State
    const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [activeId, setActiveId] = useState<string | number | null>(null);

    // Get current client
    const client = useMemo(() => 
        clients?.find(c => c.id === Number(clientId)), 
    [clients, clientId]);

    const clientMenus = useMemo(() => {
        if (!calendarMenusRaw || !clientId) return [];
        return (calendarMenusRaw as IMenuPool[]).filter(m => m.client_id === Number(clientId));
    }, [calendarMenusRaw, clientId]);

    const sidebarMenus = useMemo(() => {
        if (!poolMenusRaw || !clientId) return [];
        return (poolMenusRaw as IMenuPool[]).filter(m => m.client_id === Number(clientId));
    }, [poolMenusRaw, clientId]);

    // Unique menus for the pool sidebar (deduplicated by ID to show available options)
    const uniquePoolMenus = useMemo(() => {
        const unique = new Map();
        sidebarMenus.forEach((m: IMenuPool) => {
            if (!unique.has(m.id)) {
                unique.set(m.id, m);
            }
        });
        return Array.from(unique.values());
    }, [sidebarMenus]);

    // Generate week days
    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }).map((_, i) => {
            const date = addDays(currentWeekStart, i);
            return {
                date,
                dayName: format(date, 'EEEE', { locale: es }),
                menus: clientMenus.filter(m => {
                    if (!m.assigned_date) return false;
                    const dateStr = m.assigned_date.split('T')[0];
                    return isSameDay(parseISO(dateStr), date);
                })
            };
        });
    }, [currentWeekStart, clientMenus]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    // Dnd Handlers
    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const draggedMenu = active.data.current?.menu as IMenuPool;
        if (!draggedMenu) return;

        // Resolve the target date
        let targetDate: Date | null = null;
        const overData = over.data.current;

        if (overData?.type === 'column') {
            targetDate = overData.date;
        } else if (overData?.type === 'menu') {
            const overMenu = overData.menu as IMenuPool;
            if (overMenu.assigned_date) {
                const dateStr = overMenu.assigned_date.split('T')[0];
                targetDate = parseISO(dateStr);
            }
        }

        // Fallback: try to interpret over.id as a date string if strictly string
        if (!targetDate && typeof over.id === 'string') {
             const parsed = new Date(over.id);
             if (!isNaN(parsed.getTime())) {
                 targetDate = parsed;
             }
        }

        if (!targetDate) return;

        // Only update if the date actually changed (and it's not a new assignment from pool)
        const isFromPool = active.data.current?.type === 'pool-menu';
        const newDate = targetDate;
        // Parse oldDate ignoring timezone shift
        const oldDate = draggedMenu.assigned_date ? parseISO(draggedMenu.assigned_date.split('T')[0]) : null;

        if (!isFromPool && oldDate && isSameDay(newDate, oldDate)) return;

        try {
            await swapMenuMutation.mutateAsync({
                client_id: Number(clientId),
                date: format(newDate, 'yyyy-MM-dd'),
                new_menu_id: draggedMenu.id
            });
            toast.success('Menú asignado correctamente');
        } catch (error) {
            console.error('Failed to move menu:', error);
            toast.error('Error al asignar el menú');
        }
    };

    if (isLoadingClients || isLoadingPool || isLoadingCalendar || !client) {
         return <WeeklyViewSkeleton />;
    }

    const activeMenu = activeId ? (
        typeof activeId === 'string' && activeId.startsWith('pool-') 
            ? uniquePoolMenus.find((m: IMenuPool) => `pool-${m.id}` === activeId)
            : clientMenus.find(m => (m.menu_id_selected_client || m.id) === activeId)
    ) : null;

    const handleDateChange = (dateStr: string) => {
        if (!dateStr) return;
        const date = parseISO(dateStr);
        setCurrentWeekStart(startOfWeek(date, { weekStartsOn: 1 }));
    };


    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col -m-6 px-6 pb-6 pt-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-gray-400 hover:text-gray-600 mb-2 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Volver a la colección
                    </button>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 rounded-2xl">
                             <Calendar className="w-6 h-6 text-emerald-600" />
                        </div>
                        Planificación Semanal
                        <span className="text-gray-300">|</span>
                        <span className="text-emerald-600">{client.name} {client.lastname}</span>
                    </h1>
                </div>

                <div className="flex items-center gap-4">
                     {/* Date Picker for Quick Navigation */}
                     <div className="w-40">
                        <DatePicker 
                            value=""
                            onChange={handleDateChange}
                            placeholder="Ir a fecha..."
                        />
                     </div>

                     <div className="bg-white rounded-xl border border-gray-100 p-1 flex items-center shadow-sm">
                        <button 
                            onClick={() => setCurrentWeekStart(d => addDays(d, -7))}
                            className="p-2 hover:bg-gray-50 rounded-lg text-gray-500 transition-colors"
                        >
                            <ChevronRight className="w-4 h-4 rotate-180" />
                        </button>
                        <span className="px-4 text-sm font-bold text-gray-700 min-w-[140px] text-center capitalize">
                            {format(currentWeekStart, 'MMMM yyyy', { locale: es })}
                        </span>
                        <button 
                             onClick={() => setCurrentWeekStart(d => addDays(d, 7))}
                            className="p-2 hover:bg-gray-50 rounded-lg text-gray-500 transition-colors"
                        >
                             <ChevronRight className="w-4 h-4" />
                        </button>
                     </div>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex flex-1 overflow-hidden gap-6">
                    {/* Main Calendar Area - 80% */}
                    <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar pb-4">
                        {/* Warning if no menus assigned */}
                        {clientMenus.length === 0 && (
                             <div className="mb-6 bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center gap-3 text-orange-800">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <p className="text-sm font-medium">
                                    Este cliente no tiene menús asignados. Puedes arrastrar menús desde el panel o crear uno nuevo.
                                </p>
                             </div>
                        )}
                        
                        <div className="flex gap-4 min-w-max h-full">
                            {weekDays.map((day) => (
                                <DayColumn 
                                    key={day.date.toISOString()} 
                                    day={day} 
                                    isToday={isSameDay(day.date, new Date())} 
                                />
                            ))}
                        </div>
                    </div>

                    {/* Sidebar Panel - 20% */}
                    <div className="w-[20%] min-w-[250px] bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col h-full overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <div className="p-1.5 bg-emerald-100 rounded-lg">
                                    <GripVertical className="w-4 h-4 text-emerald-600" />
                                </div>
                                Menús Disponibles
                            </h3>
                            <p className="text-xs text-gray-400 mt-1">Arrastra al calendario para asignar</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                            <SortableContext 
                                items={uniquePoolMenus.map(m => `pool-${m.id}`)}
                                strategy={verticalListSortingStrategy}
                            >
                                {uniquePoolMenus.map(menu => (
                                    <SidebarPoolMenu key={`pool-${menu.id}`} menu={menu} />
                                ))}
                                {uniquePoolMenus.length === 0 && (
                                    <div className="text-center py-8 text-gray-400 text-sm">
                                        No hay menús en la piscina.
                                    </div>
                                )}
                            </SortableContext>
                        </div>
                    </div>
                </div>

                <DragOverlay>
                    {activeMenu ? (
                        <div className="w-64">
                             <MenuCard menu={activeMenu} isOverlay /> 
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Global Loader Overlay during Mutation */}
            {swapMenuMutation.isPending && (
                <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-200">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-100 border-t-emerald-500" />
                        <p className="text-sm font-bold text-gray-700">Actualizando calendario...</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ClientWeeklyMenuView;
