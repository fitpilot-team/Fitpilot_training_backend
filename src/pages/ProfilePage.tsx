import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useAvailableSlots, useInsertAvailableSlot, useUpdateAvailableSlot } from '@/features/professional-clients/queries';
import { IAvailableSlots } from '@/features/professional-clients/types';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { AvailableSlot } from '@/components/profile/availableSlot';

const DAYS = [
    { id: 1, label: 'Lunes' },
    { id: 2, label: 'Martes' },
    { id: 3, label: 'Miércoles' },
    { id: 4, label: 'Jueves' },
    { id: 5, label: 'Viernes' },
    { id: 6, label: 'Sábado' },
    { id: 7, label: 'Domingo' }
];

const formatTimeForInput = (time: string) => {
    if (!time) return '09:00';
    if (time.includes('T')) {
        // Use Date object to correctly extract local time from ISO strings
        const date = new Date(time);
        if (!isNaN(date.getTime())) {
            return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        }
        return time.split('T')[1].substring(0, 5);
    }
    return time.substring(0, 5);
};

export function ProfilePage() {
    const { professional } = useProfessional();
    const professionalId = professional?.sub;

    const { data: slots, isLoading: isLoadingSlots } = useAvailableSlots(professionalId || '');
    const insertMutation = useInsertAvailableSlot();
    const updateMutation = useUpdateAvailableSlot();

    const [workSlots, setWorkSlots] = useState<IAvailableSlots[]>([]);
    const [savingSlots, setSavingSlots] = useState<number[]>([]);
    const [showToast, setShowToast] = useState(false);

    const isSaving = insertMutation.isPending || updateMutation.isPending;

    useEffect(() => {
        if (slots) {
            const mappedSlots = DAYS.map(day => {
                const existingSlot = slots.find(s => s.day_of_week === day.id);
                if (existingSlot) {
                    return {
                        ...existingSlot,
                        start_time: formatTimeForInput(existingSlot.start_time),
                        end_time: formatTimeForInput(existingSlot.end_time)
                    };
                }
                return {
                    day_of_week: day.id,
                    is_active: false,
                    start_time: '09:00',
                    end_time: '17:00'
                };
            });
            setWorkSlots(mappedSlots);
        } else if (!isLoadingSlots) {
            // Default state if no data yet (all disabled)
            setWorkSlots(DAYS.map(day => ({
                day_of_week: day.id,
                is_active: false,
                start_time: '09:00',
                end_time: '17:00'
            })));
        }
    }, [slots, isLoadingSlots]);

    const handleToggleDay = async (index: number) => {
        if (!professionalId) return;
        const slot = workSlots[index];
        const newIsActiveStatus = !slot.is_active;

        // Optimistic update
        const newSlots = [...workSlots];
        newSlots[index] = { ...slot, is_active: newIsActiveStatus };
        setWorkSlots(newSlots);

        setSavingSlots(prev => [...prev, slot.day_of_week]);

        try {
            if (slot.id) {
                // Update
                await updateMutation.mutateAsync({
                    id: slot.id,
                    slotData: { is_active: newIsActiveStatus }
                });
            } else {
                // Insert
                await insertMutation.mutateAsync({
                    day_of_week: slot.day_of_week,
                    is_active: newIsActiveStatus,
                    start_time: slot.start_time.length === 5 ? `${slot.start_time}:00` : slot.start_time,
                    end_time: slot.end_time.length === 5 ? `${slot.end_time}:00` : slot.end_time,
                    professional_id: parseInt(professionalId.toString())
                });
            }
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2000);
        } catch (error) {
            // Rollback on error
            setWorkSlots(workSlots);
            console.error('Failed to save slot:', error);
        } finally {
            setSavingSlots(prev => prev.filter(id => id !== slot.day_of_week));
        }
    };

    const handleTimeChange = async (index: number, field: 'start_time' | 'end_time', value: string, skipSave: boolean = false) => {
        const slot = workSlots[index];
        const formattedValue = value.length === 5 ? `${value}:00` : value;

        // Optimistic update
        const newSlots = [...workSlots];
        newSlots[index] = { ...slot, [field]: value };
        setWorkSlots(newSlots);

        if (skipSave) return;

        setSavingSlots(prev => [...prev, slot.day_of_week]);

        try {
            if (slot.id) {
                await updateMutation.mutateAsync({
                    id: slot.id,
                    slotData: { [field]: formattedValue }
                });
                setShowToast(true);
                setTimeout(() => setShowToast(false), 2000);
            }
        } catch (error) {
            setWorkSlots(workSlots);
            console.error('Failed to update time:', error);
        } finally {
            setSavingSlots(prev => prev.filter(id => id !== slot.day_of_week));
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Configuración de Perfil</h1>
                    <p className="text-gray-500 mt-1">Gestiona tu disponibilidad. Los cambios se guardan automáticamente.</p>
                </div>

                {/* Auto-save status indicator */}
                <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-2xl shadow-sm">
                    {isSaving ? (
                        <div className="flex items-center gap-2 text-nutrition-600">
                            <div className="w-4 h-4 border-2 border-nutrition-600/30 border-t-nutrition-600 rounded-full animate-spin" />
                            <span className="text-xs font-bold uppercase tracking-wider">Guardando...</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-nutrition-500">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Sincronizado</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Lateral Info */}
                <div className="lg:col-span-1 space-y-6">
                    <motion.div
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm"
                    >
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-nutrition-600" />
                            Horarios de Trabajo
                        </h2>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            Define los intervalos de tiempo en los que estarás disponible para recibir citas. Estos horarios se reflejarán en tu calendario de agenda.
                        </p>

                        <div className="mt-6 flex items-start gap-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-700 leading-normal">
                                Los cambios realizados aquí actualizarán automáticamente los espacios disponibles en el dashboard de nutrición.
                            </p>
                        </div>
                    </motion.div>
                </div>

                {/* Main Content: Work Slots */}
                <div className="lg:col-span-2 space-y-4">
                    {isLoadingSlots ? (
                        /* Skeleton Loader */
                        Array.from({ length: 7 }).map((_, i) => (
                            <div key={i} className="p-6 bg-white border border-gray-100 rounded-3xl animate-pulse">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-6 bg-gray-200 rounded-full" />
                                        <div className="w-20 h-4 bg-gray-200 rounded-md" />
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="w-20 h-10 bg-gray-200 rounded-xl" />
                                        <div className="w-20 h-10 bg-gray-200 rounded-xl" />
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        workSlots.map((slot, index) => (
                            <AvailableSlot
                                key={slot.day_of_week}
                                slot={slot}
                                index={index}
                                isSaving={savingSlots.includes(slot.day_of_week)}
                                dayName={DAYS[index].label}
                                handleToggleDay={handleToggleDay}
                                handleTimeChange={handleTimeChange}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Success Toast */}
            <AnimatePresence>
                {showToast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, x: "-50%" }}
                        exit={{ opacity: 0, y: 20, x: "-50%" }}
                        className="fixed bottom-10 left-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-6 py-4 rounded-3xl shadow-2xl border border-white/10 backdrop-blur-md"
                    >
                        <div className="w-8 h-8 rounded-full bg-nutrition-500/20 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-nutrition-400" />
                        </div>
                        <div>
                            <p className="font-bold text-sm">Cambios guardados</p>
                            <p className="text-gray-400 text-xs text-nowrap">Tus horarios se han actualizado correctamente.</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
