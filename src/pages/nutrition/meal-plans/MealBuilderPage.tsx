import { useState, useMemo, Fragment, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Listbox, Transition } from '@headlessui/react';
import { useGetExchangeGroups } from '@/features/exchange-groups/queries';
import { IExchangeGroup } from '@/features/exchange-groups/types';
import { useCreateMealPlan, useGetMealPlanById, useUpdateMealPlan } from '@/features/meal-plan/queries';
import { IMealPlan } from '@/features/meal-plan/types';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import {
    Plus,
    Trash2,
    Utensils,
    X,
    ChevronDown,
    Save,
    Sun,
    CloudSun,
    Moon,
    Loader2,
    GripVertical
} from 'lucide-react';

interface Exchange {
    id: string;
    groupId: number;
    quantity: number;
}

interface Meal {
    id: string;
    name: string;
    exchanges: Exchange[];
}

export function MealBuilderPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('editId') ? Number(searchParams.get('editId')) : null;

    const { professional } = useProfessional();
    const currentUserId = Number(professional?.sub);

    const [planName, setPlanName] = useState('');
    const [description, setDescription] = useState('');
    const [saveAsTemplate, setSaveAsTemplate] = useState(false);
    const { data: exchangeGroups, isLoading: groupsLoading, error: groupsError } = useGetExchangeGroups();
    const { data: existingPlan, isLoading: planLoading } = useGetMealPlanById(editId || 0);

    const { mutate: createMealPlan, isPending: isSaving } = useCreateMealPlan();
    const { mutate: updateMealPlan, isPending: isUpdating } = useUpdateMealPlan();

    const [meals, setMeals] = useState<Meal[]>([
        { id: '1', name: 'Desayuno', exchanges: [] },
        { id: '2', name: 'Comida', exchanges: [] },
        { id: '3', name: 'Cena', exchanges: [] },
    ]);

    const isOwner = useMemo(() => {
        if (!editId) return true;
        if (!existingPlan) return false;
        // Lenient check for now: if created_by is null/undefined, assume we can edit it
        // (This happens because the backend might not be returning the creator yet)
        return !existingPlan.created_by || existingPlan.created_by === currentUserId;
    }, [editId, existingPlan, currentUserId]);

    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (existingPlan && editId && !isInitialized) {
            setPlanName(existingPlan.name || '');
            setDescription(existingPlan.description || '');
            setSaveAsTemplate(!!existingPlan.is_template);
            if (existingPlan.meal_plan_meals) {
                setMeals(existingPlan.meal_plan_meals.map(m => ({
                    id: m.id?.toString() || crypto.randomUUID(),
                    name: m.meal_name || '',
                    exchanges: m.meal_plan_exchanges?.map(ex => ({
                        id: ex.id?.toString() || crypto.randomUUID(),
                        groupId: ex.exchange_group_id,
                        quantity: ex.quantity,
                    })) || []
                })));
            }
            setIsInitialized(true);
        }
    }, [existingPlan, editId, isInitialized]);

    const totalExchanges = useMemo(() => {
        return meals.reduce((sum, meal) => {
            return sum + meal.exchanges.reduce((mSum, ex) => mSum + (Number(ex.quantity) || 0), 0);
        }, 0);
    }, [meals]);

    const handleAddMeal = () => {
        const newMeal: Meal = {
            id: crypto.randomUUID(),
            name: 'Nueva Comida',
            exchanges: [],
        };
        setMeals([...meals, newMeal]);
    };

    const handleDeleteMeal = (mealId: string) => {
        setMeals(meals.filter(m => m.id !== mealId));
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setMeals((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleUpdateMealName = (mealId: string, name: string) => {
        setMeals(meals.map(m => m.id === mealId ? { ...m, name } : m));
    };

    const handleAddExchange = (mealId: string) => {
        if (!exchangeGroups || exchangeGroups.length === 0) return;

        setMeals(meals.map(m => {
            if (m.id === mealId) {
                // Find available groups
                const selectedGroupIds = m.exchanges.map(ex => ex.groupId);
                const availableGroup = exchangeGroups.find(g => !selectedGroupIds.includes(g.id)) || exchangeGroups[0];

                const newExchange: Exchange = {
                    id: crypto.randomUUID(),
                    groupId: availableGroup.id,
                    quantity: 1,
                };
                return { ...m, exchanges: [...m.exchanges, newExchange] };
            }
            return m;
        }));
    };

    const handleUpdateExchange = (mealId: string, exchangeId: string, updates: Partial<Exchange>) => {
        setMeals(meals.map(m => {
            if (m.id === mealId) {
                return {
                    ...m,
                    exchanges: m.exchanges.map(ex => ex.id === exchangeId ? { ...ex, ...updates } : ex)
                };
            }
            return m;
        }));
    };

    const handleDeleteExchange = (mealId: string, exchangeId: string) => {
        setMeals(meals.map(m => {
            if (m.id === mealId) {
                return { ...m, exchanges: m.exchanges.filter(ex => ex.id !== exchangeId) };
            }
            return m;
        }));
    };

    const handleSave = () => {
        if (!planName.trim()) {
            toast.error('Por favor, ingresa un nombre para el plan');
            return;
        }

        if (!isOwner) {
            toast.error('No tienes permisos para modificar este plan');
            return;
        }

        const mealPlan: IMealPlan = {
            name: planName,
            description,
            is_template: saveAsTemplate,
            meal_plan_meals: meals.map((m, index) => ({
                id: editId && !m.id.includes('-') ? Number(m.id) : undefined, // Keep existing ID if valid number
                meal_name: m.name,
                sort_order: index + 1,
                meal_plan_exchanges: m.exchanges.map(ex => ({
                    id: editId && !ex.id.includes('-') ? Number(ex.id) : undefined,
                    exchange_group_id: ex.groupId,
                    quantity: ex.quantity
                }))
            }))
        };

        const onMutationSuccess = () => {
            toast.success('¡Plan de alimentación guardado con éxito!');
            if (saveAsTemplate) {
                navigate('/nutrition/meal-plans/templates');
            } else {
                navigate('/nutrition/meal-plans/overview');
            }
        };

        const onMutationError = (err: any) => {
            console.error('Error saving meal plan:', err);
            toast.error('Error al guardar el plan. Por favor, intenta de nuevo.');
        };

        if (editId) {
            updateMealPlan({ id: editId, data: mealPlan }, {
                onSuccess: onMutationSuccess,
                onError: onMutationError
            });
        } else {
            createMealPlan(mealPlan, {
                onSuccess: onMutationSuccess,
                onError: onMutationError
            });
        }
    };

    const isLoading = groupsLoading || planLoading;
    const error = groupsError;

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-gray-500 font-medium tracking-wide">Cargando...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center text-red-500 bg-red-50 rounded-3xl border border-red-100 mx-8">
                <p className="font-bold">Error al cargar datos</p>
                <p className="text-sm mt-1">Por favor intente de nuevo más tarde.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                        {editId ? 'Edit Meal Plan' : 'Meal Plan Builder'}
                    </h1>
                    <p className="text-gray-500 mt-1 font-medium">
                        {editId ? 'Modify your existing strategy' : 'Design your custom nutrition strategy'}
                    </p>
                </div>
            </div>

            {/* Plan Info Card */}
            <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 ring-1 ring-gray-900/5">
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 ml-1">Plan Name</label>
                        <input
                            type="text"
                            value={planName}
                            onChange={(e) => setPlanName(e.target.value)}
                            placeholder="e.g. High Protein Week 1"
                            className="w-full px-4 py-3 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all duration-200 text-gray-900 font-medium border border-gray-100"
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group transition-colors hover:bg-white hover:border-emerald-100">
                        <div>
                            <p className="font-bold text-gray-900">Save as template</p>
                            <p className="text-xs text-gray-500">Reuse this structure later</p>
                        </div>
                        <button
                            onClick={() => setSaveAsTemplate(!saveAsTemplate)}
                            className={`w-12 h-6 rounded-full transition-all duration-300 relative ${saveAsTemplate ? 'bg-emerald-500' : 'bg-gray-300'}`}
                        >
                            <motion.div
                                animate={{ x: saveAsTemplate ? 26 : 2 }}
                                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                            />
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">Description</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add notes for the client or describe the goal of this plan..."
                        className="w-full h-[150px] px-4 py-3 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all duration-200 text-gray-900 font-medium resize-none border border-gray-100"
                    />
                </div>
            </div>

            {/* Meals Section Header */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl shadow-inner">
                        <Utensils className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Meals & Exchanges</h2>
                </div>
                <div className="bg-white px-4 py-1.5 rounded-full border border-gray-100 shadow-sm flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total exchanges:</span>
                    <span className="text-lg font-black text-emerald-600">{totalExchanges}</span>
                </div>
            </div>

            {/* Meals List */}
            <div className="space-y-6">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                    modifiers={[restrictToVerticalAxis]}
                >
                    <SortableContext
                        items={meals.map(m => m.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {meals.map((meal) => (
                            <SortableMeal
                                key={meal.id}
                                meal={meal}
                                exchangeGroups={exchangeGroups}
                                handleUpdateMealName={handleUpdateMealName}
                                handleDeleteMeal={handleDeleteMeal}
                                handleUpdateExchange={handleUpdateExchange}
                                handleDeleteExchange={handleDeleteExchange}
                                handleAddExchange={handleAddExchange}
                                isOwner={isOwner}
                            />
                        ))}
                    </SortableContext>
                </DndContext>

                {/* Add Meal Button */}
                {isOwner && (
                    <button
                        onClick={handleAddMeal}
                        className="w-full py-8 border-2 border-dashed border-gray-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 text-gray-400 hover:border-emerald-300 hover:text-emerald-500 hover:bg-emerald-50/50 transition-all group"
                    >
                        <div className="p-4 bg-gray-100 rounded-full group-hover:bg-emerald-100 transition-colors">
                            <Plus className="w-8 h-8" />
                        </div>
                        <span className="font-bold text-lg">Add another meal</span>
                    </button>
                )}
            </div>

            {/* Action Bar */}
            <div className="sticky bottom-6 flex items-center justify-end gap-4 p-4 bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl shadow-emerald-900/10 ring-1 ring-gray-900/5 mt-12">
                <button
                    onClick={() => navigate(-1)}
                    className="px-8 py-3.5 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-2xl transition-all"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving || isUpdating || !isOwner}
                    className="px-8 py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                    {isSaving || isUpdating ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Save className="w-5 h-5" />
                    )}
                    {editId ? 'Update Meal Plan' : 'Save Meal Plan'}
                </button>
            </div>
        </div>
    );
}


function SortableMeal({
    meal,
    exchangeGroups,
    handleUpdateMealName,
    handleDeleteMeal,
    handleUpdateExchange,
    handleDeleteExchange,
    handleAddExchange,
    isOwner
}: {
    meal: Meal;
    exchangeGroups: IExchangeGroup[] | undefined;
    handleUpdateMealName: (id: string, name: string) => void;
    handleDeleteMeal: (id: string) => void;
    handleUpdateExchange: (mealId: string, exId: string, updates: any) => void;
    handleDeleteExchange: (mealId: string, exId: string) => void;
    handleAddExchange: (mealId: string) => void;
    isOwner: boolean;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: meal.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`bg-white rounded-[2rem] shadow-lg shadow-gray-200/40 border border-gray-100 overflow-hidden group ${isDragging ? 'opacity-50 ring-2 ring-emerald-500' : ''}`}
        >
            {/* Meal Header */}
            <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between bg-gray-50/30 group-hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-4 flex-1">
                    {isOwner && (
                        <div
                            {...attributes}
                            {...listeners}
                            className="p-2 -ml-2 text-gray-300 hover:text-emerald-500 cursor-grab active:cursor-grabbing transition-colors"
                        >
                            <GripVertical className="w-5 h-5" />
                        </div>
                    )}
                    <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-100">
                        <MealIcon name={meal.name} />
                    </div>
                    <input
                        type="text"
                        value={meal.name}
                        onChange={(e) => handleUpdateMealName(meal.id, e.target.value)}
                        disabled={!isOwner}
                        className="bg-transparent border-none p-0 text-xl font-extrabold text-gray-900 focus:ring-0 w-full placeholder:text-gray-300 disabled:opacity-75"
                        placeholder="Meal Name"
                    />
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg border border-gray-100 shadow-sm text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                        {meal.exchanges.reduce((sum, ex) => sum + (Number(ex.quantity) || 0), 0)} EXCHANGES
                    </div>
                    {isOwner && (
                        <button
                            onClick={() => handleDeleteMeal(meal.id)}
                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Exchanges List */}
            <div className="p-6 space-y-4">
                <div className="grid grid-cols-12 gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">
                    <div className="col-span-12 md:col-span-7">Exchange Group</div>
                    <div className="col-span-12 md:col-span-4 pl-1">Quantity</div>
                </div>

                <AnimatePresence mode="popLayout">
                    {meal.exchanges.map((ex) => (
                        <motion.div
                            key={ex.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="grid grid-cols-12 gap-4 items-center group/row p-1 rounded-2xl hover:bg-gray-50 transition-all duration-200"
                        >
                            <div className="col-span-11 md:col-span-7 relative">
                                <Listbox
                                    value={ex.groupId}
                                    onChange={(value: number) => handleUpdateExchange(meal.id, ex.id, { groupId: value })}
                                    disabled={!isOwner}
                                >
                                    <div className="relative">
                                        <Listbox.Button className="relative w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 text-left focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm disabled:opacity-75">
                                            <span className="block truncate">
                                                {exchangeGroups?.find(g => g.id === ex.groupId)?.name || 'Seleccionar grupo'}
                                            </span>
                                            <div
                                                className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-white shadow-sm"
                                                style={{ backgroundColor: exchangeGroups?.find(g => g.id === ex.groupId)?.color_code || '#cbd5e1' }}
                                            />
                                            {isOwner && (
                                                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                                                    <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                                                </span>
                                            )}
                                        </Listbox.Button>
                                        <Transition
                                            as={Fragment}
                                            leave="transition ease-in duration-100"
                                            leaveFrom="opacity-100"
                                            leaveTo="opacity-0"
                                        >
                                            <Listbox.Options
                                                anchor="bottom start"
                                                transition
                                                className="z-50 mt-1 max-h-60 w-(--button-width) overflow-auto rounded-2xl bg-white py-1 text-base shadow-2xl focus:outline-none sm:text-sm [--anchor-gap:4px] data-closed:opacity-0 data-leave:transition data-leave:duration-100 data-leave:ease-in"
                                            >
                                                {exchangeGroups?.filter((group: IExchangeGroup) => {
                                                    const otherExchangesIds = meal.exchanges
                                                        .filter(e => e.id !== ex.id)
                                                        .map(e => e.groupId);
                                                    return !otherExchangesIds.includes(group.id);
                                                }).map((group: IExchangeGroup) => (
                                                    <Listbox.Option
                                                        key={group.id}
                                                        className={({ active }) =>
                                                            `relative cursor-pointer select-none py-3 pl-10 pr-4 transition-colors ${active ? 'bg-emerald-50 text-emerald-900' : 'text-gray-900'
                                                            }`
                                                        }
                                                        value={group.id}
                                                    >
                                                        {({ selected }) => (
                                                            <>
                                                                <span className={`block truncate ${selected ? 'font-black text-emerald-600' : 'font-bold'}`}>
                                                                    {group.name}
                                                                </span>
                                                                <div
                                                                    className="absolute left-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm"
                                                                    style={{ backgroundColor: group.color_code }}
                                                                />
                                                            </>
                                                        )}
                                                    </Listbox.Option>
                                                ))}
                                            </Listbox.Options>
                                        </Transition>
                                    </div>
                                </Listbox>
                            </div>

                            <div className="col-span-11 md:col-span-4">
                                <input
                                    type="number"
                                    value={ex.quantity}
                                    min="0.25"
                                    step="0.25"
                                    onChange={(e) => handleUpdateExchange(meal.id, ex.id, { quantity: Number(e.target.value) })}
                                    disabled={!isOwner}
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm disabled:opacity-75"
                                />
                            </div>

                            <div className="col-span-1 flex justify-end">
                                {isOwner && (
                                    <button
                                        onClick={() => handleDeleteExchange(meal.id, ex.id)}
                                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Add Exchange Button */}
                {isOwner && (
                    <button
                        onClick={() => handleAddExchange(meal.id)}
                        className="w-full py-4 mt-2 border-2 border-dashed border-gray-100 rounded-3xl flex items-center justify-center gap-2 text-sm font-bold text-gray-400 hover:border-emerald-300 hover:text-emerald-500 hover:bg-emerald-50/30 transition-all group/add"
                    >
                        <div className="p-1 rounded-lg bg-gray-50 group-hover/add:bg-emerald-100 transition-colors">
                            <Plus className="w-4 h-4" />
                        </div>
                        Add exchange
                    </button>
                )}
            </div>
        </div>
    );
}


function MealIcon({ name }: { name: string }) {
    const n = name.toLowerCase();
    if (n.includes('desayuno') || n.includes('breakfast')) return <Sun className="w-6 h-6 text-amber-500" />;
    if (n.includes('comida') || n.includes('lunch')) return <CloudSun className="w-6 h-6 text-blue-400" />;
    if (n.includes('cena') || n.includes('dinner')) return <Moon className="w-6 h-6 text-indigo-500" />;
    return <Utensils className="w-6 h-6 text-emerald-500" />;
}
