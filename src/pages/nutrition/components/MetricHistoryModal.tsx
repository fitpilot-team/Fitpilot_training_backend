
import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ClientMetric } from '@/services/client-metrics';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MetricHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    metrics: ClientMetric[];
    unit?: string;
    tabs?: { label: string; metricType: string }[];
    series?: { metricType: string; label: string; color: string }[];
}

export function MetricHistoryModal({ isOpen, onClose, title, metrics, unit, tabs, series }: MetricHistoryModalProps) {
    const [hoveredDate, setHoveredDate] = useState<string | null>(null);
    const [activeTab] = useState(tabs ? tabs[0].metricType : null);
    void title;

    // Prepare data based on mode (Series vs Single/Tabs)
    let processedData: any[] = [];
    
    if (series) {
        // Multi-series mode: Group by date
        const metricsByDate = new Map<string, any>();
        
        metrics.forEach(m => {
            if (series.some(s => s.metricType === m.metric_type)) {
                const datePart = m.date.toString().split('T')[0];
                const dateLocal = new Date(`${datePart}T00:00:00`);
                const dateKey = format(dateLocal, 'yyyy-MM-dd'); // sorting key
                
                if (!metricsByDate.has(dateKey)) {
                    metricsByDate.set(dateKey, {
                        dateSort: dateLocal.getTime(),
                        date: format(dateLocal, 'dd MMM', { locale: es }),
                        fullDate: format(dateLocal, 'dd MMMM yyyy', { locale: es }),
                    });
                }
                
                const entry = metricsByDate.get(dateKey);
                entry[m.metric_type] = m.value;
                // unit might assume the first series unit or passed unit
            }
        });

        processedData = Array.from(metricsByDate.values())
            .sort((a, b) => a.dateSort - b.dateSort);
            
    } else {
        // Single/Tab mode
        const filteredMetrics = activeTab
            ? metrics.filter(m => m.metric_type === activeTab)
            : metrics;

        const sortedMetrics = [...filteredMetrics].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        processedData = sortedMetrics.map(m => {
            const datePart = m.date.toString().split('T')[0];
            const dateLocal = new Date(`${datePart}T00:00:00`);
            return {
                date: format(dateLocal, 'dd MMM', { locale: es }),
                fullDate: format(dateLocal, 'dd MMMM yyyy', { locale: es }),
                value: m.value,
                unit: m.unit
            };
        });
    }

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                {/* ... (Transition setup) */}
                
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all h-[80vh] flex flex-col">
                                {/* ... (Header and Tabs) */}

                                <div className="flex-1 w-full mt-4 min-h-0">
                                    {processedData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={processedData} key={activeTab || 'all'}>
                                                <defs>
                                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                                <XAxis 
                                                    dataKey="date" 
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                                                    dy={10}
                                                />
                                                <YAxis 
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                                                    domain={['auto', 'auto']}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: 'white',
                                                        borderRadius: '12px',
                                                        border: '1px solid #f3f4f6',
                                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                                    }}
                                                    labelStyle={{ color: '#6b7280', marginBottom: '4px' }}
                                                    cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }}
                                                />
                                                
                                                {series ? (
                                                    series.map(s => (
                                                        <Area
                                                            key={s.metricType}
                                                            type="monotone"
                                                            dataKey={s.metricType}
                                                            name={s.label}
                                                            stroke={s.color}
                                                            fill="none" 
                                                            strokeWidth={3}
                                                        />
                                                    ))
                                                ) : (
                                                    <Area
                                                        type="monotone"
                                                        dataKey="value"
                                                        stroke="#10b981"
                                                        strokeWidth={3}
                                                        fillOpacity={1}
                                                        fill="url(#colorValue)"
                                                        activeDot={{ r: 6 }}
                                                    />
                                                )}

                                                {hoveredDate && (
                                                    <ReferenceLine 
                                                        x={hoveredDate} 
                                                        stroke="#10b981" 
                                                        strokeDasharray="4 4" 
                                                        strokeWidth={1}
                                                    />
                                                )}
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-400">
                                            No hay datos registrados para esta métrica
                                        </div>
                                    )}
                                </div>

                                <div className="mt-8">
                                    <h4 className="text-sm font-medium text-gray-500 mb-4">Registros Recientes</h4>
                                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                        {[...processedData].reverse().map((record, index) => (
                                            <div 
                                                key={index} 
                                                onMouseEnter={() => setHoveredDate(record.date)}
                                                onMouseLeave={() => setHoveredDate(null)}
                                                className={`flex justify-between items-center p-3 rounded-xl transition-all cursor-pointer ${
                                                    hoveredDate === record.date ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                                                }`}
                                            >
                                                <span className="text-sm text-gray-600">{record.fullDate}</span>
                                                <div className="flex flex-col items-end">
                                                    {series ? (
                                                        series.map(s => (
                                                            <span key={s.metricType} className="text-sm" style={{ color: s.color }}>
                                                                <span className="font-bold">{record[s.metricType]}</span> {unit || ''}
                                                                <span className="text-xs ml-1 text-gray-400">({s.label})</span>
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="font-bold text-gray-900">
                                                            {record.value} <span className="text-xs font-normal text-gray-500">{record.unit || unit}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
