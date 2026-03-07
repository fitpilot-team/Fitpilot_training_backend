import React from 'react';
import { 
    LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, TrendingUp, User, Ruler } from 'lucide-react';

interface ConsultationProgressProps {
    clientHistory: any;
}

export const ConsultationProgress: React.FC<ConsultationProgressProps> = ({ clientHistory }) => {
    
    // Process data for charts
    const metricsHistory = [...(clientHistory?.client_metrics || [])].reverse().map((m: any) => ({
        ...m,
        date: m.date || m.logged_at, // Use date or logged_at
        weight_kg: Number(m.weight_kg),
        body_fat_pct: m.body_fat_pct ? Number(m.body_fat_pct) : null,
        muscle_mass_kg: m.muscle_mass_kg ? Number(m.muscle_mass_kg) : null,
        waist_cm: m.waist_cm ? Number(m.waist_cm) : null,
        hip_cm: m.hip_cm ? Number(m.hip_cm) : null,
        height_cm: m.height_cm ? Number(m.height_cm) : null
    }));

    const healthHistory = [...(clientHistory?.client_health_metrics || [])].reverse().map((m: any) => ({
        ...m,
        date: m.recorded_at, // Map recorded_at to date for consistent usage
        glucose_mg_dl: m.glucose_mg_dl ? Number(m.glucose_mg_dl) : null,
        systolic_mmhg: m.systolic_mmhg ? Number(m.systolic_mmhg) : null,
        diastolic_mmhg: m.diastolic_mmhg ? Number(m.diastolic_mmhg) : null,
        heart_rate_bpm: m.heart_rate_bpm ? Number(m.heart_rate_bpm) : null
    }));

    if (!metricsHistory.length && !healthHistory.length) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-10 text-center">
                <Activity className="w-16 h-16 text-gray-200 mb-4" />
                <h3 className="text-xl font-bold text-gray-400">Sin datos suficientes</h3>
                <p className="text-gray-400 mt-2">No hay historial de mediciones para mostrar gráficas.</p>
            </div>
        );
    }

    const currentWeight = metricsHistory[metricsHistory.length - 1]?.weight_kg;
    const initialWeight = metricsHistory[0]?.weight_kg;
    const weightChange = currentWeight && initialWeight ? (currentWeight - initialWeight).toFixed(1) : 0;
    
    const currentBodyFat = metricsHistory[metricsHistory.length - 1]?.body_fat_pct;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group hover:border-nutrition-200 transition-all">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-50 text-blue-500 rounded-xl group-hover:bg-blue-100 transition-colors">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Peso Actual</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-gray-800">{currentWeight}</span>
                            <span className="text-sm font-bold text-gray-400">kg</span>
                        </div>
                        <div className={`text-xs font-bold mt-2 ${Number(weightChange) <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {Number(weightChange) > 0 ? '+' : ''}{weightChange} kg vs inicio
                        </div>
                    </div>
                     <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none transform translate-x-1/4 translate-y-1/4">
                        <TrendingUp className="w-32 h-32" />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group hover:border-nutrition-200 transition-all">
                     <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-purple-50 text-purple-500 rounded-xl group-hover:bg-purple-100 transition-colors">
                                <Activity className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Grasa Corporal</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-gray-800">{currentBodyFat || '-'}</span>
                            <span className="text-sm font-bold text-gray-400">%</span>
                        </div>
                         <p className="text-xs text-gray-400 mt-2 font-medium">Porcentaje estimado</p>
                    </div>
                    <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none transform translate-x-1/4 translate-y-1/4">
                        <Activity className="w-32 h-32" />
                    </div>
                </div>

                 <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group hover:border-nutrition-200 transition-all">
                     <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-nutrition-50 text-nutrition-500 rounded-xl group-hover:bg-nutrition-100 transition-colors">
                                <User className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">IMC</span>
                        </div>
                        {metricsHistory[metricsHistory.length - 1]?.height_cm && currentWeight ? (
                             <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-gray-800">
                                    {(currentWeight / Math.pow(metricsHistory[metricsHistory.length - 1].height_cm / 100, 2)).toFixed(1)}
                                </span>
                            </div>
                        ) : (
                            <span className="text-2xl font-black text-gray-300">-</span>
                        )}
                        <p className="text-xs text-gray-400 mt-2 font-medium">Índice de Masa Corporal</p>
                    </div>
                     <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none transform translate-x-1/4 translate-y-1/4">
                        <User className="w-32 h-32" />
                    </div>
                </div>
            </div>

            {/* Weight Chart */}
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-nutrition-500" />
                    Evolución de Peso
                </h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={metricsHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#84cc16" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#84cc16" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis 
                                dataKey="date" 
                                tickFormatter={(date) => {
                                    if (!date) return '';
                                    try {
                                        const d = new Date(date);
                                        if (isNaN(d.getTime())) return '';
                                        return format(d, 'd MMM', { locale: es });
                                    } catch (e) {
                                        return '';
                                    }
                                }}
                                stroke="#9ca3af"
                                tick={{ fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            <YAxis 
                                domain={['auto', 'auto']} 
                                stroke="#9ca3af"
                                tick={{ fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                                dx={-10}
                            />
                            <Tooltip 
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                labelFormatter={(date) => {
                                    try {
                                        const d = new Date(date);
                                        if (isNaN(d.getTime())) return 'Fecha inválida';
                                        return format(d, 'd MMMM yyyy', { locale: es });
                                    } catch (e) {
                                        return 'Fecha inválida';
                                    }
                                }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="weight_kg" 
                                stroke="#84cc16" 
                                strokeWidth={3}
                                fillOpacity={1} 
                                fill="url(#colorWeight)" 
                                name="Peso (kg)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Anthropometry Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-purple-500" />
                        Composición Corporal
                    </h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={metricsHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis 
                                    dataKey="date" 
                                    tickFormatter={(date) => {
                                        if (!date) return '';
                                        try {
                                            const d = new Date(date);
                                            if (isNaN(d.getTime())) return '';
                                            return format(d, 'd MMM', { locale: es });
                                        } catch (e) {
                                            return '';
                                        }
                                    }}
                                    stroke="#9ca3af"
                                    tick={{ fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis 
                                    yAxisId="left"
                                    domain={[0, 100]} 
                                    stroke="#9ca3af"
                                    tick={{ fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    labelFormatter={(date) => {
                                        try {
                                            const d = new Date(date);
                                            if (isNaN(d.getTime())) return 'Fecha inválida';
                                            return format(d, 'd MMM yyyy', { locale: es });
                                        } catch (e) {
                                            return 'Fecha inválida';
                                        }
                                    }}
                                />
                                <Line 
                                    yAxisId="left"
                                    type="monotone" 
                                    dataKey="body_fat_pct" 
                                    stroke="#a855f7" 
                                    strokeWidth={2}
                                    dot={{ r: 4, fill: '#a855f7', strokeWidth: 0 }}
                                    name="% Grasa"
                                />
                                <Line 
                                    yAxisId="left"
                                    type="monotone" 
                                    dataKey="muscle_mass_kg" 
                                    stroke="#3b82f6" 
                                    strokeWidth={2}
                                    dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                                    name="Masa Muscular (kg)"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
                        <Ruler className="w-5 h-5 text-orange-500" />
                        Medidas (Cintura/Cadera)
                    </h3>
                     <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={metricsHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis 
                                    dataKey="date" 
                                    tickFormatter={(date) => {
                                        if (!date) return '';
                                        try {
                                            const d = new Date(date);
                                            if (isNaN(d.getTime())) return '';
                                            return format(d, 'd MMM', { locale: es });
                                        } catch (e) {
                                            return '';
                                        }
                                    }}
                                    stroke="#9ca3af"
                                    tick={{ fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis 
                                    domain={['auto', 'auto']} 
                                    stroke="#9ca3af"
                                    tick={{ fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip 
                                    labelFormatter={(date) => {
                                        try {
                                            const d = new Date(date);
                                            if (isNaN(d.getTime())) return 'Fecha inválida';
                                            return format(d, 'd MMM yyyy', { locale: es });
                                        } catch (e) {
                                            return 'Fecha inválida';
                                        }
                                    }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="waist_cm" 
                                    stroke="#f97316" 
                                    strokeWidth={2}
                                    dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }}
                                    name="Cintura (cm)"
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="hip_cm" 
                                    stroke="#ef4444" 
                                    strokeWidth={2}
                                    dot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }}
                                    name="Cadera (cm)"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Health Metrics Charts */}
            {healthHistory.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Glucose Chart */}
                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                        <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-amber-500" />
                            Glucosa
                        </h3>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={healthHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis 
                                        dataKey="date" 
                                    tickFormatter={(date) => {
                                        if (!date) return '';
                                        try {
                                            const d = new Date(date);
                                            if (isNaN(d.getTime())) return '';
                                            return format(d, 'd MMM', { locale: es });
                                        } catch (e) {
                                            return '';
                                        }
                                    }}
                                        stroke="#9ca3af"
                                        tick={{ fontSize: 10 }}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={10}
                                    />
                                    <YAxis 
                                        domain={['auto', 'auto']} 
                                        stroke="#9ca3af"
                                        tick={{ fontSize: 10 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    labelFormatter={(date) => {
                                        try {
                                            const d = new Date(date);
                                            if (isNaN(d.getTime())) return 'Fecha inválida';
                                            return format(d, 'd MMM yyyy', { locale: es });
                                        } catch (e) {
                                            return 'Fecha inválida';
                                        }
                                    }}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="glucose_mg_dl" 
                                        stroke="#fbbf24" 
                                        strokeWidth={2}
                                        dot={{ r: 4, fill: '#fbbf24', strokeWidth: 0 }}
                                        name="Glucosa (mg/dL)"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Blood Pressure Chart */}
                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                        <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-rose-500" />
                            Presión Arterial
                        </h3>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={healthHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis 
                                        dataKey="date" 
                                    tickFormatter={(date) => {
                                        if (!date) return '';
                                        try {
                                            const d = new Date(date);
                                            if (isNaN(d.getTime())) return '';
                                            return format(d, 'd MMM', { locale: es });
                                        } catch (e) {
                                            return '';
                                        }
                                    }}
                                        stroke="#9ca3af"
                                        tick={{ fontSize: 10 }}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={10}
                                    />
                                    <YAxis 
                                        domain={['auto', 'auto']} 
                                        stroke="#9ca3af"
                                        tick={{ fontSize: 10 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    labelFormatter={(date) => {
                                        try {
                                            const d = new Date(date);
                                            if (isNaN(d.getTime())) return 'Fecha inválida';
                                            return format(d, 'd MMM yyyy', { locale: es });
                                        } catch (e) {
                                            return 'Fecha inválida';
                                        }
                                    }}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="systolic_mmhg" 
                                        stroke="#ef4444" 
                                        strokeWidth={2}
                                        dot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }}
                                        name="Sistólica (mmHg)"
                                    />
                                     <Line 
                                        type="monotone" 
                                        dataKey="diastolic_mmhg" 
                                        stroke="#f87171" 
                                        strokeWidth={2}
                                        strokeDasharray="5 5"
                                        dot={{ r: 4, fill: '#f87171', strokeWidth: 0 }}
                                        name="Diastólica (mmHg)"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
