import { useState, useEffect } from 'react';
import {
    format,
    isToday,
    isTomorrow,
    parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock,
    User,
    Calendar as CalendarIcon,
    ChevronRight,
    ExternalLink,
    CheckCircle,
    Play,
    Apple,
    Dumbbell
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    BeakerIcon,
    CalendarDaysIcon,
    ChartBarIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/store/newAuthStore';
import { useProfessionalClients } from '@/features/professional-clients/queries';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { useGetAppointments } from '@/features/appointments/queries';
import { DraftsSection } from './components/DraftsSection';
import { Card } from '@/components/common/Card';

interface Appointment {
    id: number;
    clientId: string;
    clientName: string;
    clientAvatar: string;
    date: Date;
    time: string;
    type?: 'NUTRITION' | 'TRAINING' | 'BOTH';
    title?: string;
    meeting_link?: string;
}

export function NutritionDashboardPage() {
    const navigate = useNavigate();
    const { t } = useTranslation('common');
    const { user } = useAuthStore();
    const { professional } = useProfessional();

    // Use professional ID from context or fallback
    const professionalId = professional?.sub || user?.id;
    const { data: realClients } = useProfessionalClients(professionalId?.toString() || '');
    const { data: apiAppointments, isLoading: isLoadingAppointments } = useGetAppointments(professionalId?.toString() || '');

    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [toastMessage] = useState('');

    // Derived appointments for the UI
    const appointments: Appointment[] = (apiAppointments || []).map(apiApp => {
        const client = realClients?.find(c => Number(c.id) === Number(apiApp.client_id));
        const scheduledDate = parseISO(apiApp.scheduled_at);
        return {
            id: apiApp.id,
            clientId: apiApp.client_id.toString(),
            clientName: client?.name || 'Cliente Desconocido',
            clientAvatar: client?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(client?.name || 'U')}&background=random`,
            date: scheduledDate,
            time: format(scheduledDate, 'HH:mm'),
            type: apiApp.type,
            title: apiApp.title,
            meeting_link: apiApp.meeting_link
        };
    });

    // Filter appointments for Today and Tomorrow
    const todayAppointments = appointments
        .filter(app => isToday(app.date))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    const tomorrowAppointments = appointments
        .filter(app => isTomorrow(app.date))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    useEffect(() => {
        if (showSuccessToast) {
            const timer = setTimeout(() => setShowSuccessToast(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [showSuccessToast]);

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            <AnimatePresence>
                {showSuccessToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, x: "-50%" }}
                        exit={{ opacity: 0, y: -20, x: "-50%" }}
                        className="fixed top-6 left-1/2 z-50 flex items-center gap-3 bg-nutrition-600 text-white px-6 py-3 rounded-full shadow-lg shadow-nutrition-200"
                    >
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">{toastMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Hola de nuevo, {user?.full_name?.split(' ')[0]} 👋</h1>
                    <p className="text-gray-500">Esto es lo que tienes pendiente para hoy.</p>
                </div>
                <button
                    onClick={() => navigate('/nutrition/agenda')}
                    className="px-4 py-2 bg-nutrition-600 text-white rounded-xl font-medium hover:bg-nutrition-700 transition-colors shadow-lg shadow-nutrition-200 flex items-center gap-2"
                >
                    <CalendarIcon className="w-4 h-4" />
                    Ver Agenda Completa
                </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Sesiones Hoy', value: todayAppointments.length, color: 'text-nutrition-600', bg: 'bg-nutrition-50', icon: CalendarIcon },
                    { label: 'Mañana', value: tomorrowAppointments.length, color: 'text-blue-600', bg: 'bg-blue-50', icon: Clock },
                    { label: 'Clientes Activos', value: realClients?.length || 0, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: User },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4"
                    >
                        <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">{stat.label}</p>
                            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Training Summary moved from training dashboard */}
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                        {
                            key: 'totalExercises',
                            value: '32',
                            icon: BeakerIcon,
                            color: 'bg-blue-500',
                        },
                        {
                            key: 'activeMesocycles',
                            value: '2',
                            icon: CalendarDaysIcon,
                            color: 'bg-green-500',
                        },
                        {
                            key: 'completionRate',
                            value: '87%',
                            icon: ChartBarIcon,
                            color: 'bg-yellow-500',
                        },
                    ].map((stat) => {
                        const Icon = stat.icon;
                        return (
                            <Card key={stat.key} padding="md">
                                <div className="flex items-center">
                                    <div className={`${stat.color} p-3 rounded-lg`}>
                                        <Icon className="h-6 w-6 text-white" />
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-gray-600">{t(`dashboard.stats.${stat.key}`)}</p>
                                        <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>

                <Card>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">{t('dashboard.quickActions')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={() => navigate('/training/exercises')}
                            className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-center"
                        >
                            <BeakerIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                            <p className="font-medium text-gray-700">{t('dashboard.browseExercises')}</p>
                        </button>
                        <button
                            onClick={() => navigate('/training/programs/new')}
                            className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-center"
                        >
                            <CalendarDaysIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                            <p className="font-medium text-gray-700">{t('dashboard.createMesocycle')}</p>
                        </button>
                    </div>
                </Card>
            </div>


            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content (Appointments) */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Today's Appointments */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            Hoy <span className="text-sm font-normal text-gray-400">({format(new Date(), 'dd MMMM', { locale: es })})</span>
                        </h2>
                    </div>

                    <div className="space-y-3">
                        {isLoadingAppointments ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-3xl" />
                            ))
                        ) : todayAppointments.length > 0 ? (
                            todayAppointments.map((appt) => (
                                <AppointmentListItem key={appt.id} appt={appt} />
                            ))
                        ) : (
                            <div className="bg-gray-50/50 border border-dashed border-gray-200 rounded-2xl p-8 text-center text-gray-500">
                                No tienes sesiones agendadas para hoy.
                            </div>
                        )}
                    </div>
                </section>

                {/* Tomorrow's Appointments */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            Mañana
                        </h2>
                    </div>

                    <div className="space-y-3">
                        {isLoadingAppointments ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-3xl" />
                            ))
                        ) : tomorrowAppointments.length > 0 ? (
                            tomorrowAppointments.map((appt) => (
                                <AppointmentListItem key={appt.id} appt={appt} />
                            ))
                        ) : (
                            <div className="bg-gray-50/50 border border-dashed border-gray-200 rounded-2xl p-8 text-center text-gray-500">
                                No hay sesiones para mañana todavía.
                            </div>
                        )}
                    </div>
                </section>
                </div>
            </div>

            {/* Sidebar (Drafts & potentially other widgets) */}
            <div className="space-y-6">
                 <DraftsSection />
            </div>
         </div>
       </div>
    );
}

function AppointmentListItem({ appt }: { appt: Appointment }) {
    return (
        <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="group bg-white p-4 rounded-3xl shadow-sm border border-gray-100 hover:border-nutrition-200 transition-all hover:shadow-md"
        >
            <div className="flex items-center gap-4">
                <div className="relative">
                    <img
                        src={appt.clientAvatar}
                        alt={appt.clientName}
                        className="w-12 h-12 rounded-2xl object-cover bg-gray-50"
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-nutrition-600 rounded-full border-2 border-white flex items-center justify-center">
                        <Clock className="w-3 h-3 text-white" />
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                        <h3 className="text-base font-bold text-gray-900 truncate">{appt.clientName}</h3>
                        <span className="text-sm font-bold text-nutrition-600 bg-nutrition-50 px-2 py-0.5 rounded-lg">
                            {appt.time}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm text-gray-500 truncate flex-1">
                            {appt.title || 'Consulta'}
                        </p>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-50 border border-gray-100">
                            {appt.type === 'NUTRITION' && <Apple className="w-3 h-3 text-emerald-500" />}
                            {appt.type === 'TRAINING' && <Dumbbell className="w-3 h-3 text-orange-500" />}
                            {appt.type === 'BOTH' && (
                                <div className="flex items-center -space-x-1">
                                    <Apple className="w-3 h-3 text-emerald-500" />
                                    <Dumbbell className="w-3 h-3 text-orange-500" />
                                </div>
                            )}
                            <span className="text-[10px] font-bold text-gray-400">
                                {appt.type === 'BOTH' ? 'MIXTA' : appt.type || 'NUTRITION'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        to={`/nutrition/consultation/${appt.id}`}
                        className="opacity-0 group-hover:opacity-100 px-4 py-2 bg-nutrition-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-nutrition-100 hover:bg-nutrition-700 transition-all flex items-center gap-2"
                    >
                        <Play className="w-3 h-3 fill-current" />
                        Iniciar sesión
                    </Link>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {appt.meeting_link && (
                            <a
                                href={appt.meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-xl hover:bg-nutrition-50 text-nutrition-600 transition-colors"
                                title="Unirme a la reunión"
                            >
                                <ExternalLink className="w-5 h-5" />
                            </a>
                        )}
                        <Link
                            to={`/nutrition/clients/${appt.clientId}`}
                            className="p-2 rounded-xl hover:bg-gray-50 text-gray-400 hover:text-gray-900 transition-all"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </Link>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
