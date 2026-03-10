
import React from 'react';

import { useClientHistory } from '@/features/client-history/queries';
import { Heart, ThumbsUp, ThumbsDown, Activity, Info } from 'lucide-react';

interface ClientHistoryPanelProps {
    clientId: number;
    currentCalories?: number;
}

import { ClientMetricsModal } from './ClientMetricsModal';
import { useState } from 'react';

// ... existing code ...

export const ClientHistoryPanel: React.FC<ClientHistoryPanelProps> = ({ clientId, currentCalories = 0 }) => {
    const { data: history, isLoading } = useClientHistory(clientId);
    const [metricsModal, setMetricsModal] = useState<{ isOpen: boolean; type: 'health' | 'body' | null }>({
        isOpen: false,
        type: null
    });

    if (isLoading) {
        // ... existing loading skeleton ...
        return (
            <div className="p-4 bg-white rounded-3xl shadow-sm border border-gray-100 animate-pulse space-y-4">
                <div className="h-6 bg-gray-100 rounded w-1/3"></div>
                <div className="space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-full"></div>
                    <div className="h-4 bg-gray-100 rounded w-2/3"></div>
                </div>
            </div>
        );
    }

    if (!history) return null;

    // ... existing variable definitions ...
    const record = history.client_records?.[0];
    const target = history.daily_targets?.find(t => t.is_active) || history.daily_targets?.[0];
    const allergies = history.client_allergens?.map(ca => ca.allergens.name).join(', ') || 'Ninguna';

    const likes = record?.preferences?.likes || [];
    const dislikes = record?.preferences?.dislikes || [];
    const conditions = record?.medical_conditions || 'Ninguna';

    // Progress Bar Logic
    const targetCalories = target?.target_calories || 2000;
    const percentage = Math.min((currentCalories / targetCalories) * 100, 100);
    const isOver = currentCalories > targetCalories;
    
    const getProgressColor = () => {
        if (isOver) return 'bg-rose-500';
        if (percentage > 90) return 'bg-emerald-500';
        if (percentage > 50) return 'bg-amber-500';
        return 'bg-blue-500';
    };

    return (
        <>
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                 {/* Progress Bar Header */}
                 <div className="relative h-2 bg-gray-100 w-full">
                    <div 
                        className={`absolute top-0 left-0 h-full transition-all duration-500 ease-out ${getProgressColor()}`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>

                <div className="px-6 py-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-100 rounded-xl">
                            <Info className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                             <h3 className="font-black text-gray-800 text-sm">Información del Paciente</h3>
                             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                {currentCalories > 0 && (
                                    <span className={isOver ? 'text-rose-500' : 'text-emerald-600'}>
                                        Actual: {Math.round(currentCalories)} kcal
                                    </span>
                                )}
                             </p>
                        </div>
                    </div>
                    {target && (
                         <div className="text-right">
                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Meta</span>
                            <span className="font-black text-gray-700">{Math.round(target.target_calories)} kcal</span>
                         </div>
                    )}
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Calories / Targets */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-gray-400">
                            <Activity className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">Metas Diarias</span>
                        </div>
                        {target ? (
                            <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 relative overflow-hidden">
                                 {/* Mini Progress Background */}
                                 <div className="absolute bottom-0 left-0 h-1 bg-orange-200/50 w-full">
                                    <div 
                                        className="h-full bg-orange-500/50 transition-all duration-500" 
                                        style={{ width: `${percentage}%` }}
                                    />
                                 </div>

                                <div className="flex items-baseline gap-1 mb-2">
                                    <span className="text-2xl font-black text-orange-600">{Math.round(target.target_calories)}</span>
                                    <span className="text-xs font-bold text-orange-400">kcal</span>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500 font-medium">Proteína</span>
                                        <span className="font-bold text-gray-700">{Math.round(target.target_protein_g)}g</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500 font-medium">Carbos</span>
                                        <span className="font-bold text-gray-700">{Math.round(target.target_carbs_g)}g</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500 font-medium">Grasas</span>
                                        <span className="font-bold text-gray-700">{Math.round(target.target_fat_g)}g</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 italic">Sin objetivos definidos</p>
                        )}
                    </div>

                    {/* Medical & Allergies */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-gray-400">
                            <Heart className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">Médico</span>
                        </div>
                        <div className="space-y-3">
                            <div className="bg-red-50 rounded-2xl p-3 border border-red-100">
                                <span className="block text-[10px] font-bold text-red-400 uppercase tracking-wide mb-1">Alergias</span>
                                <p className="text-sm font-bold text-gray-800 leading-tight">{allergies}</p>
                            </div>
                             <div className="bg-blue-50 rounded-2xl p-3 border border-blue-100">
                                <span className="block text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-1">Condiciones</span>
                                <p className="text-sm font-bold text-gray-800 leading-tight line-clamp-3">{conditions}</p>
                            </div>
                        </div>
                    </div>

                    {/* Likes & Dislikes (Combined or separated as before) */}
                    {/* ... (Keeping existing Likes/Dislikes Logic but simplifying if needed, 
                        assuming standard layout is 4 cols. We have Calories, Medical, Preferences(Likes/Dislikes split?), Metrics x2.
                        Wait, layout is 4 cols.
                        Col 1: Calories
                        Col 2: Medical
                        Col 3: Likes/Dislikes (maybe combine?)
                        Col 4: Metrics (Health & Body)
                        
                        Currently code has:
                        1. Calories
                        2. Medical
                        3. Likes
                        4. Dislikes
                        5. Health Metrics
                        6. Body Metrics
                        
                        This will wrap to next row. That's fine.
                    */ }

                    {/* Likes */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-gray-400">
                            <ThumbsUp className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">Preferencias</span>
                        </div>
                        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 h-full max-h-40 overflow-y-auto custom-scrollbar">
                            {likes.length > 0 ? (
                                <div className="flex flex-wrap gap-3">
                                    {likes.map((item, idx) => (
                                        <span key={idx} className="px-3 py-1.5 bg-white rounded-lg text-xs font-bold text-emerald-700 border border-emerald-100 shadow-sm">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 italic">No hay preferencias registradas</p>
                            )}
                        </div>
                    </div>

                     {/* Dislikes */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-gray-400">
                            <ThumbsDown className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">No le gusta</span>
                        </div>
                        <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100 h-full max-h-40 overflow-y-auto custom-scrollbar">
                            {dislikes.length > 0 ? (
                                <div className="flex flex-wrap gap-3">
                                    {dislikes.map((item, idx) => (
                                        <span key={idx} className="px-3 py-1.5 bg-white rounded-lg text-xs font-bold text-rose-700 border border-rose-100 shadow-sm">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 italic">No hay alimentos excluidos</p>
                            )}
                        </div>
                    </div>

                    {/* Health Metrics */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-gray-400">
                            <Activity className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">Métricas de Salud</span>
                        </div>
                        <div 
                            className="bg-blue-50 rounded-2xl p-4 border border-blue-100 space-y-2 cursor-pointer hover:bg-blue-100 transition-colors hover:shadow-sm group"
                            onClick={() => setMetricsModal({ isOpen: true, type: 'health' })}
                        >
                            {history.client_health_metrics && history.client_health_metrics.length > 0 ? (
                                <>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500 font-medium group-hover:text-gray-700">Glucosa</span>
                                        <span className="font-bold text-gray-700">{history.client_health_metrics[0].glucose_mg_dl || '-'} mg/dL</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500 font-medium group-hover:text-gray-700">Presión Arterial</span>
                                        <span className="font-bold text-gray-700">
                                            {history.client_health_metrics[0].systolic_mmhg && history.client_health_metrics[0].diastolic_mmhg 
                                                ? `${history.client_health_metrics[0].systolic_mmhg}/${history.client_health_metrics[0].diastolic_mmhg}` 
                                                : '-'} mmHg
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500 font-medium group-hover:text-gray-700">Frecuencia Cardiaca</span>
                                        <span className="font-bold text-gray-700">{history.client_health_metrics[0].heart_rate_bpm || '-'} bpm</span>
                                    </div>
                                    <div className="text-center mt-2 pt-2 border-t border-blue-200">
                                         <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Ver Historial Completo »</span>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-gray-400 italic">No hay métricas de salud recientes</p>
                            )}
                        </div>
                    </div>

                    {/* Body Metrics */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-gray-400">
                            <Activity className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">Medidas Corporales</span>
                        </div>
                        <div 
                            className="bg-purple-50 rounded-2xl p-4 border border-purple-100 space-y-2 cursor-pointer hover:bg-purple-100 transition-colors hover:shadow-sm group"
                            onClick={() => setMetricsModal({ isOpen: true, type: 'body' })}
                        >
                            {history.client_metrics && history.client_metrics.length > 0 ? (
                                <>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500 font-medium group-hover:text-gray-700">Peso</span>
                                        <span className="font-bold text-gray-700">{history.client_metrics[0].weight_kg || '-'} kg</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500 font-medium group-hover:text-gray-700">Altura</span>
                                        <span className="font-bold text-gray-700">{history.client_metrics[0].height_cm || '-'} cm</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500 font-medium group-hover:text-gray-700">Grasa Corporal</span>
                                        <span className="font-bold text-gray-700">{history.client_metrics[0].body_fat_pct || '-'} %</span>
                                    </div>
                                    <div className="text-center mt-2 pt-2 border-t border-purple-200">
                                         <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">Ver Progreso »</span>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-gray-400 italic">No hay medidas recientes</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <ClientMetricsModal 
                isOpen={metricsModal.isOpen}
                onClose={() => setMetricsModal({ ...metricsModal, isOpen: false })}
                type={metricsModal.type}
                healthMetrics={history.client_health_metrics}
                bodyMetrics={history.client_metrics}
            />
        </>
    );
};
