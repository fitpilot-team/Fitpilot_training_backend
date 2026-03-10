import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetMealPlans } from '@/features/meal-plan/queries';
import { IMealPlan } from '@/features/meal-plan/types';
import { useGetExchangeGroups } from '@/features/exchange-groups/queries';
import { IExchangeGroup } from '@/features/exchange-groups/types';
import { ClientSelectionModal } from './components/ClientSelectionModal';
import { IProfessionalClient } from '@/features/professional-clients/types';
import { motion } from 'framer-motion';
import {
    Utensils,
    Calendar,
    ChevronRight,
    Search,
    Sun,
    CloudSun,
    Moon,
    Activity
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { Edit2 } from 'lucide-react';

export function MealTemplatesPage() {
    const navigate = useNavigate();
    const { t } = useTranslation('common');
    const { data: plans, isLoading: plansLoading, error: plansError } = useGetMealPlans();
    const { data: exchangeGroups, isLoading: groupsLoading, error: groupsError } = useGetExchangeGroups();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<IMealPlan | null>(null);

    // Filter templates
    const templates = plans?.filter((p: IMealPlan) => p.is_template) || [];

    const handleUsePlan = (plan: IMealPlan) => {
        setSelectedPlan(plan);
        setIsModalOpen(true);
    };

    const handleClientSelect = (client: IProfessionalClient) => {
        if (!selectedPlan) return;
        setIsModalOpen(false);
        navigate(`/nutrition/meal-plans/create-menu?planId=${selectedPlan.id}&clientId=${client.id}`);
    };

    const isLoading = plansLoading || groupsLoading;
    const error = plansError || groupsError;

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-gray-500 font-medium tracking-wide">Cargando plantillas...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center text-red-500 bg-red-50 rounded-3xl border border-red-100 mx-8">
                <p className="font-bold">Error al cargar las plantillas</p>
                <p className="text-sm mt-1">Por favor intente de nuevo más tarde.</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                        {t('mealPlans.templates')}
                    </h1>
                    <p className="text-gray-500 font-medium mt-1">
                        Utiliza y gestiona tus estructuras de alimentación base
                    </p>
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar plantillas..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all shadow-sm"
                        />
                    </div>
                </div>
            </header>

            {templates.length === 0 ? (
                <div className="bg-white rounded-[2.5rem] p-16 text-center border-2 border-dashed border-gray-100 shadow-sm">
                    <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
                        <Calendar className="w-12 h-12" />
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 mb-2">No hay plantillas guardadas</h2>
                    <p className="text-gray-500 max-w-sm mx-auto mb-8 font-medium">
                        Crea un plan en el constructor y guárdalo como plantilla para verlo aquí y reutilizarlo con tus clientes.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {templates.map((plan: IMealPlan) => (
                        <MealPlanCard
                            key={plan.id}
                            plan={plan}
                            exchangeGroups={exchangeGroups || []}
                            onUsePlan={() => handleUsePlan(plan)}
                            onEditPlan={() => navigate(`/nutrition/meal-plans/builder?editId=${plan.id}`)}
                            currentUserId={Number(useProfessional().professional?.sub)}
                        />
                    ))}
                </div>
            )}

            {selectedPlan && (
                <ClientSelectionModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSelect={handleClientSelect}
                    planName={selectedPlan.name || ''}
                />
            )}
        </div>
    );
}

function MealPlanCard({
    plan,
    exchangeGroups,
    onUsePlan,
    onEditPlan,
    currentUserId
}: {
    plan: IMealPlan;
    exchangeGroups: IExchangeGroup[];
    onUsePlan: () => void;
    onEditPlan: () => void;
    currentUserId: number;
}) {
    // Lenient check: show edit if created_by matches or is null
    const isOwner = !plan.created_by || plan.created_by === currentUserId;
    console.log("plan", plan);
    const totalExchanges = plan.meal_plan_meals?.reduce((acc: number, meal) =>
        acc + (meal.meal_plan_exchanges?.reduce((mAcc: number, ex) => mAcc + ex.quantity, 0) || 0), 0
    ) || 0;

    // Group exchanges across all meals
    const exchangeSummary = plan.meal_plan_meals?.reduce((acc, meal) => {
        meal.meal_plan_exchanges?.forEach(ex => {
            acc[ex.exchange_group_id] = (acc[ex.exchange_group_id] || 0) + ex.quantity;
        });
        return acc;
    }, {} as Record<number, number>) || {};

    const groupsMap = exchangeGroups.reduce((acc, group) => {
        acc[group.id] = group;
        return acc;
    }, {} as Record<number, IExchangeGroup>);

    const totalCalories = plan.meal_plan_meals?.reduce((acc: number, meal) =>
        acc + (meal.meal_plan_exchanges?.reduce((mAcc: number, ex) => {
            const group = groupsMap[ex.exchange_group_id];
            return mAcc + (ex.quantity * (group?.avg_calories || 0));
        }, 0) || 0), 0
    ) || 0;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            className="bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-emerald-900/10 transition-all group flex flex-col h-full ring-1 ring-gray-900/5"
        >
            <div className="p-6 md:p-8 flex flex-col h-full relative">
                <div className="flex items-start justify-between mb-6">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300 shadow-sm">
                        <Utensils className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                            {isOwner && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEditPlan();
                                    }}
                                    className="p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                                    title="Editar plantilla"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            )}
                            <div className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-widest border border-emerald-100">
                                Plantilla
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 bg-gray-50/50 px-2.5 py-1 rounded-xl border border-gray-100 shadow-sm">
                                <span className="text-xs font-black text-gray-900 tabular-nums">{Math.round(totalCalories)}</span>
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Kcal</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-gray-50/50 px-2.5 py-1 rounded-xl border border-gray-100 shadow-sm">
                                <span className="text-xs font-black text-emerald-600 tabular-nums">{totalExchanges}</span>
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Equiv.</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 space-y-6">
                    <div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2 group-hover:text-emerald-600 transition-colors tracking-tight">
                            {plan.name}
                        </h3>
                        {plan.description && (
                            <p className="text-gray-500 text-sm line-clamp-2 font-medium leading-relaxed">
                                {plan.description}
                            </p>
                        )}
                    </div>

                    {/* Meals Summary */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            <Activity className="w-3.5 h-3.5 text-emerald-500/50" />
                            Distribución de Comidas
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {plan.meal_plan_meals?.map((meal, idx) => (
                                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100 text-[11px] font-bold text-gray-700 hover:bg-white transition-colors">
                                    <MealIconMini name={meal.meal_name || 'Comida'} />
                                    {meal.meal_name || 'Comida'}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Exchanges Summary */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            <Utensils className="w-3.5 h-3.5 text-emerald-500/50" />
                            Resumen de Equivalentes
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(exchangeSummary).map(([groupId, quantity]) => {
                                const group = groupsMap[Number(groupId)];
                                return (
                                    <div key={groupId} className="flex items-center gap-2 p-2.5 bg-gray-50/50 rounded-2xl border border-gray-50 hover:bg-white transition-colors">
                                        <div
                                            className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm"
                                            style={{ backgroundColor: group?.color_code || '#cbd5e1' }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[9px] font-bold text-gray-400 truncate uppercase tracking-tighter">
                                                {group?.name || 'Otro'}
                                            </div>
                                            <div className="text-sm font-black text-gray-700 leading-none mt-0.5">
                                                {quantity} <span className="text-[10px] font-medium text-gray-400">eq.</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-2 justify-end">
                    {/* Edit button moved to top */}
                    <button
                        onClick={onUsePlan}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-700 rounded-2xl text-xs font-bold hover:bg-emerald-100 transition-all group/use-btn active:scale-95"
                    >
                        Usar este plan
                        <ChevronRight className="w-4 h-4 group-hover/use-btn:translate-x-1 transition-transform" />
                    </button>
                    <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-2xl text-xs font-bold hover:bg-emerald-600 transition-all group/btn shadow-xl shadow-gray-200 active:scale-95">
                        Ver Detalles
                        <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

function MealIconMini({ name }: { name: string }) {
    const n = name.toLowerCase();
    if (n.includes('desayuno') || n.includes('breakfast')) return <Sun className="w-3.5 h-3.5 text-amber-500" />;
    if (n.includes('comida') || n.includes('lunch')) return <CloudSun className="w-3.5 h-3.5 text-blue-400" />;
    if (n.includes('cena') || n.includes('dinner')) return <Moon className="w-3.5 h-3.5 text-indigo-500" />;
    return <Utensils className="w-3.5 h-3.5 text-emerald-500" />;
}
