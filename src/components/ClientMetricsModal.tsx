
import React, { useState, useMemo } from 'react';
import { Modal } from './common/Modal';
import { 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer 
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClientHealthMetric, ClientMetricHistory } from '@/features/client-history/types';

interface ClientMetricsModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'health' | 'body' | null;
    healthMetrics?: ClientHealthMetric[];
    bodyMetrics?: ClientMetricHistory[];
}

export const ClientMetricsModal: React.FC<ClientMetricsModalProps> = ({
    isOpen,
    onClose,
    type,
    healthMetrics = [],
    bodyMetrics = []
}) => {
    const [selectedMetric, setSelectedMetric] = useState<string>(type === 'health' ? 'glucose_mg_dl' : 'weight_kg');

    const data = useMemo(() => {
        if (!type) return [];
        
        // Combine and sort data by date
        const sourceData = type === 'health' ? healthMetrics : bodyMetrics;
        
        return [...sourceData].sort((a, b) => {
            const dateA = new Date((a as any).recorded_at || (a as any).date).getTime();
            const dateB = new Date((b as any).recorded_at || (b as any).date).getTime();
            return dateA - dateB;
        }).map(item => {
            const date = new Date((item as any).recorded_at || (item as any).date);
            return {
                ...item,
                dateFormatted: format(date, 'dd MMM yyyy', { locale: es }),
                timestamp: date.getTime()
            };
        });
    }, [type, healthMetrics, bodyMetrics]);

    // Update default selected metric when type changes
    React.useEffect(() => {
        if (type === 'health') setSelectedMetric('glucose_mg_dl');
        else if (type === 'body') setSelectedMetric('weight_kg');
    }, [type]);

    if (!type) return null;

    const getMetricLabel = (key: string) => {
        switch (key) {
            case 'glucose_mg_dl': return 'Glucosa (mg/dL)';
            case 'systolic_mmhg': return 'Presión Sistólica (mmHg)';
            case 'diastolic_mmhg': return 'Presión Diastólica (mmHg)';
            case 'heart_rate_bpm': return 'Frecuencia Cardiaca (bpm)';
            case 'oxygen_saturation_pct': return 'Sat. Oxígeno (%)';
            case 'weight_kg': return 'Peso (kg)';
            case 'height_cm': return 'Altura (cm)';
            case 'body_fat_pct': return 'Grasa Corporal (%)';
            case 'muscle_mass_kg': return 'Masa Muscular (kg)';
            case 'waist_cm': return 'Cintura (cm)';
            case 'hip_cm': return 'Cadera (cm)';
            default: return key;
        }
    };

    const metricOptions = type === 'health' 
        ? ['glucose_mg_dl', 'systolic_mmhg', 'diastolic_mmhg', 'heart_rate_bpm', 'oxygen_saturation_pct']
        : ['weight_kg', 'body_fat_pct', 'muscle_mass_kg', 'waist_cm', 'hip_cm'];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={type === 'health' ? 'Historial de Salud' : 'Progreso Corporal'}>
            <div className="space-y-6 max-h-[80vh] overflow-y-auto p-4">
                
                {/* Chart Controls */}
                <div className="flex flex-wrap gap-2 justify-center">
                    {metricOptions.map(option => (
                        <button
                            key={option}
                            onClick={() => setSelectedMetric(option)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                selectedMetric === option 
                                ? 'bg-nutrition-600 text-white shadow-md' 
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        >
                            {getMetricLabel(option)}
                        </button>
                    ))}
                </div>

                {/* Chart */}
                <div className="h-64 w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    {data.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis 
                                    dataKey="dateFormatted" 
                                    tick={{fontSize: 10, fill: '#9CA3AF'}} 
                                    axisLine={false}
                                    tickLine={false}
                                    dy={10}
                                />
                                <YAxis 
                                    tick={{fontSize: 10, fill: '#9CA3AF'}} 
                                    axisLine={false}
                                    tickLine={false}
                                    dx={-10}
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    labelStyle={{ color: '#6B7280', fontWeight: 'bold', marginBottom: '4px' }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey={selectedMetric} 
                                    stroke={type === 'health' ? '#0ea5e9' : '#8b5cf6'} 
                                    strokeWidth={3}
                                    dot={{ fill: 'white', strokeWidth: 2, r: 4 }}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                            No hay suficientes datos para graficar
                        </div>
                    )}
                </div>

                {/* History Table */}
                <div className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
                    <div className="px-4 py-2 bg-gray-100/50 border-b border-gray-200">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Historial Detallado</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 font-bold">Fecha</th>
                                    {metricOptions.map(key => (
                                        <th key={key} className="px-4 py-3 font-bold whitespace-nowrap">
                                            {getMetricLabel(key).split('(')[0]}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {[...data].reverse().map((row, idx) => (
                                    <tr key={idx} className="bg-white hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                                            {row.dateFormatted}
                                        </td>
                                        {metricOptions.map(key => (
                                            <td key={key} className="px-4 py-3 text-gray-600">
                                                {(row as any)[key] || '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                {data.length === 0 && (
                                    <tr>
                                        <td colSpan={metricOptions.length + 1} className="px-4 py-8 text-center text-gray-400 italic">
                                            No hay registros disponibles
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
