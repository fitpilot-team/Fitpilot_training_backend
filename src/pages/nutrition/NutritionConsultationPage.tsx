import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock,
    User,
    ChevronLeft,
    Pause,
    Play,
    Square,
    Save,
    FileText,
    Activity,
    Video,
    AlertCircle
} from 'lucide-react';
import { useGetAppointments, useStartConsultation, useFinishConsultation } from '@/features/appointments/queries';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { useAuthStore } from '@/store/newAuthStore';
import { useProfessionalClients } from '@/features/professional-clients/queries';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function NutritionConsultationPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { professional } = useProfessional();
    const { user } = useAuthStore();
    const professionalId = professional?.sub || user?.id;

    const { data: appointments, isLoading: isLoadingAppointments } = useGetAppointments(professionalId?.toString() || '');
    const { data: clients } = useProfessionalClients(professionalId?.toString() || '');

    const appointment = appointments?.find(a => a.id.toString() === id);
    const client = clients?.find(c => Number(c.id) === Number(appointment?.client_id));

    const [seconds, setSeconds] = useState(0);
    const [isActive, setIsActive] = useState(true);
    const [notes, setNotes] = useState('');
    const [showEndConfirmation, setShowEndConfirmation] = useState(false);

    const startMutation = useStartConsultation();
    const finishMutation = useFinishConsultation();

    // Start consultation automatically if it hasn't started yet
    useEffect(() => {
        if (appointment && !appointment.start_date && !startMutation.isPending) {
            startMutation.mutate(appointment.id);
        }
    }, [appointment?.id, appointment?.start_date]);

    useEffect(() => {
        let interval: any = null;
        if (isActive) {
            interval = setInterval(() => {
                setSeconds(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isActive]);

    // Warning when closing the window/tab
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isActive) {
                e.preventDefault();
                e.returnValue = ''; // Standard way to show browser confirmation

            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isActive]);

    const formatTime = (totalSeconds: number) => {
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (isLoadingAppointments) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-nutrition-200 border-t-nutrition-600 rounded-full animate-spin" />
                    <p className="text-gray-500 font-medium tracking-wide">Iniciando consulta...</p>
                </div>
            </div>
        );
    }

    if (!appointment) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-900 font-bold text-xl mb-4">Cita no encontrada</p>
                    <button
                        onClick={() => navigate('/nutrition')}
                        className="px-6 py-2 bg-nutrition-600 text-white rounded-xl shadow-lg"
                    >
                        Volver al Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            {/* Header / Top Bar */}
            <header className="bg-white/80 border-b border-gray-100 sticky top-0 z-30 px-6 py-4 shadow-sm backdrop-blur-md">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowEndConfirmation(true)}
                            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <div className="h-10 w-px bg-gray-100" />
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-bold text-gray-900">Consulta en Curso</h1>
                                <span className="px-2 py-0.5 rounded-full bg-nutrition-100 text-nutrition-700 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                                    En Vivo
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 font-medium">
                                {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Session Timer */}
                        <div className="relative group/timer">
                            <div className="flex items-center gap-3 bg-gray-900 text-white px-5 py-2.5 rounded-2xl shadow-xl shadow-gray-200">
                                <Clock className={`w-5 h-5 ${isActive ? 'text-nutrition-400' : 'text-gray-500'}`} />
                                <span className="text-xl font-mono font-bold tracking-tighter tabular-nums">
                                    {formatTime(seconds)}
                                </span>
                                <div className="flex items-center gap-1 border-l border-gray-700 ml-2 pl-3">
                                    <button
                                        onClick={() => setIsActive(!isActive)}
                                        className="p-1 rounded-lg hover:bg-gray-800 transition-colors"
                                    >
                                        {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-nutrition-400" />}
                                    </button>
                                    <button
                                        onClick={() => setShowEndConfirmation(true)}
                                        className="p-1 rounded-lg hover:bg-gray-800 transition-colors text-red-400"
                                    >
                                        <Square className="w-4 h-4 fill-current" />
                                    </button>
                                </div>
                            </div>

                            {/* Prolonged Consultation Badge */}
                            <AnimatePresence>
                                {seconds >= 1800 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute top-full left-0 right-0 mt-2 flex justify-center"
                                    >
                                        <div className="bg-orange-50 border border-orange-100 px-3 py-1 rounded-full flex items-center gap-2 shadow-sm whitespace-nowrap">
                                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                            <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wide">
                                                Consulta prolongada » {Math.floor(seconds / 60)} min
                                            </span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <button
                            onClick={() => setShowEndConfirmation(true)}
                            className="hidden md:flex items-center gap-2 px-6 py-2.5 bg-nutrition-600 text-white rounded-2xl font-bold shadow-lg shadow-nutrition-200 hover:bg-nutrition-700 transition-all active:scale-95"
                        >
                            <Save className="w-4 h-4" />
                            Finalizar Consulta
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 mt-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column - Client Info & Main Actions */}
                    <div className="lg:col-span-4 space-y-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="relative mb-4">
                                    <img
                                        src={client?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(client?.name || 'U')}&background=random&size=128`}
                                        alt={client?.name}
                                        className="w-32 h-32 rounded-3xl object-cover shadow-2xl shadow-gray-200 border-4 border-white"
                                    />
                                    <div className="absolute -bottom-2 -right-2 bg-nutrition-600 text-white p-2 rounded-2xl shadow-lg">
                                        <User className="w-5 h-5" />
                                    </div>
                                </div>
                                <h2 className="text-2xl font-black text-gray-900 mb-1">{client?.name || 'Cargando...'}</h2>
                                <p className="text-gray-500 font-medium mb-6">Paciente de Nutrición</p>

                                <div className="grid grid-cols-2 gap-3 w-full">
                                    <div className="bg-gray-50 rounded-2xl p-4">
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Última Cita</p>
                                        <p className="text-sm font-bold text-gray-700">Hace 15 días</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-2xl p-4">
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Objetivo</p>
                                        <p className="text-sm font-bold text-nutrition-600">Pérdida de Grasa</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-8 border-t border-gray-50 space-y-3">
                                <button className="w-full flex items-center gap-3 p-4 rounded-2xl bg-gray-50 text-gray-600 font-bold hover:bg-gray-100 transition-colors">
                                    <FileText className="w-5 h-5 text-nutrition-600" />
                                    Ver Historial Médico
                                </button>
                                <button className="w-full flex items-center gap-3 p-4 rounded-2xl bg-gray-50 text-gray-600 font-bold hover:bg-gray-100 transition-colors">
                                    <Activity className="w-5 h-5 text-blue-500" />
                                    Medidas y Biometría
                                </button>
                                {appointment.meeting_link && (
                                    <a
                                        href={appointment.meeting_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 transition-colors"
                                    >
                                        <Video className="w-5 h-5" />
                                        Entrar a Videollamada
                                    </a>
                                )}
                            </div>
                        </motion.div>

                        <div className="bg-nutrition-600 rounded-[32px] p-8 text-white shadow-xl shadow-nutrition-100">
                            <h3 className="text-lg font-bold mb-4">Recordatorio</h3>
                            <p className="text-nutrition-100 text-sm leading-relaxed mb-6">
                                Recuerda revisar los niveles de hidratación y el consumo de fibra reportado en la app durante la semana.
                            </p>
                            <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
                                <p className="text-xs font-medium text-white/60 mb-2 italic">Notas rápidas:</p>
                                <p className="text-sm font-bold truncate">"Sintió pesadez post-entreno"</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Notes & Plan */}
                    <div className="lg:col-span-8 flex flex-col gap-8">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex-1 bg-white rounded-[40px] shadow-sm border border-gray-100 p-8 flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-nutrition-50 text-nutrition-600 rounded-2xl">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900">Notas de la Consulta</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400 font-medium italic">Se guarda automáticamente</span>
                                </div>
                            </div>

                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder={`Motivo de la consulta:
Evolución desde la última sesión:
Indicaciones dadas:
Acuerdos / próximos pasos:
`}
                                className="flex-1 w-full bg-gray-50/50 rounded-3xl p-8 border border-transparent focus:border-nutrition-200 focus:bg-white focus:outline-none text-gray-700 leading-relaxed text-lg resize-none transition-all placeholder:text-gray-300"
                                autoFocus
                            />
                        </motion.div>

                        {/* Quick Plan Adjustments / To Do */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white rounded-[40px] shadow-sm border border-gray-100 p-8"
                        >
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
                                    <Activity className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">Ajustes del Plan Prox. Semana</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-4 rounded-3xl bg-gray-50 border border-transparent hover:border-gray-200 transition-all group">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Proteínas</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-lg font-bold text-gray-800">140g</span>
                                        <div className="flex gap-1">
                                            <button className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-nutrition-600">-</button>
                                            <button className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-nutrition-600">+</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 rounded-3xl bg-gray-50 border border-transparent hover:border-gray-200 transition-all">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Carbohidratos</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-lg font-bold text-gray-800">210g</span>
                                        <div className="flex gap-1">
                                            <button className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-nutrition-600">-</button>
                                            <button className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-nutrition-600">+</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 rounded-3xl bg-gray-50 border border-transparent hover:border-gray-200 transition-all">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Grasas</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-lg font-bold text-gray-800">65g</span>
                                        <div className="flex gap-1">
                                            <button className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-nutrition-600">-</button>
                                            <button className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-nutrition-600">+</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </main>

            {/* Custom Confirmation Modal */}
            <AnimatePresence>
                {showEndConfirmation && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowEndConfirmation(false)}
                            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white rounded-[32px] p-8 shadow-2xl border border-gray-100 relative z-10 max-w-sm w-full text-center"
                        >
                            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <AlertCircle className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">¿Finalizar sesión?</h3>
                            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                                Asegúrate de haber guardado todos los ajustes importantes antes de salir.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowEndConfirmation(false)}
                                    className="flex-1 py-3.5 rounded-2xl bg-gray-50 text-gray-600 font-bold hover:bg-gray-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        // const durationMinutes = Math.floor(seconds / 60);
                                        const durationSeconds = seconds;
                                        finishMutation.mutate(
                                            { id: appointment.id, durationSeconds, notes },
                                            {
                                                onSuccess: () => {
                                                    navigate('/nutrition');
                                                }
                                            }
                                        );
                                    }}
                                    disabled={finishMutation.isPending}
                                    className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 shadow-lg shadow-red-100 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {finishMutation.isPending ? 'Finalizando...' : 'Salir'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
