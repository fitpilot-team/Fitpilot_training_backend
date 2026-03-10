import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Pizza, Wheat, Droplets } from 'lucide-react';

export type MicronutrientStats = Record<string, { amount: number; unit: string; name: string; category: string }>;

export interface MacroStats {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    glycemicLoad?: number;
}

interface MacroSidebarProps {
    focusedMealName?: string;
    focusedStats: MacroStats;
    globalStats: MacroStats;
    focusedMicros?: MicronutrientStats;
    globalMicros?: MicronutrientStats;
}

const COLORS = {
    protein: '#ff5c5c', // vibrant red-ish
    carbs: '#3b82f6',   // vibrant blue
    fat: '#fb923c',     // vibrant orange/amber
};

export const MacroSidebar: React.FC<MacroSidebarProps> = ({
    focusedMealName,
    focusedStats,
    globalStats,
    focusedMicros = {},
    globalMicros = {}
}) => {
    const [activeTab, setActiveTab] = React.useState<'macros' | 'micros'>('macros');

    const renderSection = (stats: MacroStats, title: string, subtitle: string, isMain: boolean = false) => {
        const data = [
            { name: 'PROTEÍNA', value: stats.protein * 4, grams: stats.protein, color: COLORS.protein, icon: <Pizza className="w-4 h-4" /> },
            { name: 'CARBS', value: stats.carbs * 4, grams: stats.carbs, color: COLORS.carbs, icon: <Wheat className="w-4 h-4" /> },
            { name: 'GRASAS', value: stats.fat * 9, grams: stats.fat, color: COLORS.fat, icon: <Droplets className="w-4 h-4" /> },
        ];

        const totalKcal = stats.calories || (stats.protein * 4 + stats.carbs * 4 + stats.fat * 9) || 1;

        return (
            <div className={`space-y-4 ${!isMain ? 'opacity-80 scale-95 origin-top' : ''}`}>
                <div className="space-y-0.5 px-2">
                    <h2 className="text-lg font-black text-emerald-500 tracking-tight leading-none uppercase">
                        {subtitle}
                    </h2>
                    <p className="text-[10px] font-black text-gray-800 uppercase tracking-widest leading-none">
                        {title}
                    </p>
                </div>

                <div className="relative h-48 w-full flex items-center justify-center">
                    <div className="w-40 h-40 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.filter(d => d.value > 0)}
                                    innerRadius={55}
                                    outerRadius={75}
                                    paddingAngle={0}
                                    dataKey="value"
                                    stroke="none"
                                    startAngle={90}
                                    endAngle={450}
                                >
                                    {data.filter(d => d.value > 0).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-black text-gray-900 leading-none">
                                {stats.calories.toFixed(0)}
                            </span>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">
                                KCAL
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    {data.map((item) => {
                        const percentage = ((item.value / totalKcal) * 100);
                        return (
                            <div key={item.name} className="bg-[#f8fafc] rounded-xl p-3 shadow-sm border border-gray-50 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-lg bg-white shadow-sm text-gray-400`}>
                                            {item.icon}
                                        </div>
                                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-tight">
                                            {item.name}
                                        </span>
                                    </div>
                                    <span className="text-xs font-black text-gray-900">
                                        {item.grams.toFixed(1)}g
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{
                                                width: `${Math.min(100, percentage)}%`,
                                                backgroundColor: item.color
                                            }}
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <span className="text-[8px] font-black text-gray-400">
                                            {percentage.toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Fiber Display */}
                    <div className="bg-[#f8fafc] rounded-xl p-3 shadow-sm border border-gray-50 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-lg bg-white shadow-sm text-gray-400`}>
                                    <Wheat className="w-4 h-4" /> 
                                </div>
                                <span className="text-[10px] font-black text-gray-600 uppercase tracking-tight">
                                    FIBRA
                                </span>
                            </div>
                            <span className="text-xs font-black text-gray-900">
                                {(stats.fiber || 0).toFixed(1)}g
                            </span>
                        </div>
                        {/* Optional: Add a bar for fiber vs goal? For now just value */}
                    </div>

                    {/* Glycemic Load Display - Only show if data exists or it's the global summary */}
                    {(isMain && stats.glycemicLoad !== undefined) && (
                        <div className="bg-emerald-50 rounded-xl p-3 shadow-sm border border-emerald-100 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-tight">
                                    Carga Glucémica
                                </span>
                                <span className="text-lg font-black text-emerald-600">
                                    {stats.glycemicLoad.toFixed(1)}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className={`h-1.5 flex-1 rounded-full ${stats.glycemicLoad < 10 ? 'bg-emerald-400' : 'bg-emerald-200'}`} />
                                <div className={`h-1.5 flex-1 rounded-full ${stats.glycemicLoad >= 10 && stats.glycemicLoad < 20 ? 'bg-yellow-400' : 'bg-yellow-200'}`} />
                                <div className={`h-1.5 flex-1 rounded-full ${stats.glycemicLoad >= 20 ? 'bg-red-400' : 'bg-red-200'}`} />
                            </div>
                            <div className="flex justify-between text-[8px] font-bold text-gray-400 uppercase">
                                <span>Baja</span>
                                <span>Media</span>
                                <span>Alta</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="w-full flex flex-col gap-6">
            {/* Tabs Header */}
            <div className="flex p-1 bg-gray-100 rounded-2xl">
                <button
                    onClick={() => setActiveTab('macros')}
                    className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'macros'
                            ? 'bg-white text-emerald-600 shadow-sm'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                >
                    Macros
                </button>
                <button
                    onClick={() => setActiveTab('micros')}
                    className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'micros'
                            ? 'bg-white text-emerald-600 shadow-sm'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                >
                    Micros
                </button>
            </div>

            {activeTab === 'macros' ? (
                <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
                        {renderSection(focusedStats, "Estimación nutricional (basada en equivalencias)", focusedMealName || "Cargando...", true)}
                    </div>

                    <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
                        {renderSection(globalStats, "Estimación nutricional (basada en equivalencias)", "Plan Completo", true)}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                    {/* Focused Meal Micros */}
                    <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-100">
                        <h2 className="text-lg font-black text-emerald-500 tracking-tight leading-none uppercase mb-1">
                            {focusedMealName || "Comida Actual"}
                        </h2>
                        <p className="text-[10px] font-black text-gray-800 uppercase tracking-widest leading-none mb-6">
                            Micronutrientes
                        </p>
                        
                        {Object.keys(focusedMicros).length > 0 ? (
                            <div className="space-y-2">
                                {Object.values(focusedMicros).sort((a,b) => a.name.localeCompare(b.name)).map((micro) => (
                                    <div key={micro.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-gray-700">{micro.name}</span>
                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{micro.category}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-sm font-black text-emerald-600">{micro.amount.toFixed(1)}</span>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">{micro.unit}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                             <div className="flex flex-col items-center gap-2 py-8 text-gray-300">
                                <Droplets className="w-8 h-8 opacity-50" />
                                <p className="text-xs font-bold uppercase tracking-widest text-center">Sin micronutrientes</p>
                            </div>
                        )}
                    </div>

                    {/* Global Micros */}
                    <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
                         <h2 className="text-lg font-black text-emerald-500 tracking-tight leading-none uppercase mb-1">
                            Plan Completo
                        </h2>
                        <p className="text-[10px] font-black text-gray-800 uppercase tracking-widest leading-none mb-6">
                            Total Micronutrientes
                        </p>

                        {Object.keys(globalMicros).length > 0 ? (
                             <div className="space-y-2">
                                {Object.values(globalMicros).sort((a,b) => a.name.localeCompare(b.name)).map((micro) => (
                                    <div key={micro.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-gray-700">{micro.name}</span>
                                             <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{micro.category}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-sm font-black text-emerald-600">{micro.amount.toFixed(1)}</span>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">{micro.unit}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 py-8 text-gray-300">
                                <Droplets className="w-8 h-8 opacity-50" />
                                <p className="text-xs font-bold uppercase tracking-widest text-center">Sin datos de micronutrientes</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
