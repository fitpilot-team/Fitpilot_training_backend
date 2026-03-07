import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    isToday,
    getDay,
    addDays,
    isAfter,
    isBefore,
    startOfDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Clock,
    X,
    Search,
    CheckCircle,
    Trash2,
    AlertTriangle,
    Apple,
    Dumbbell,
    History,
    CalendarDays,
    Play
} from 'lucide-react';

import { useAuthStore } from '@/store/newAuthStore';
import { useProfessionalClients, useAvailableSlots } from '@/features/professional-clients/queries';
import { IProfessionalClient } from '@/features/professional-clients/types';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { useGetAppointments, useInsertAppointment, useDeleteAppointment, useUpdateAppointment } from '@/features/appointments/queries';

interface Appointment {
    id: number;
    clientId: string;
    clientName: string;
    clientAvatar: string;
    date: Date;
    time: string;
    type: 'NUTRITION' | 'TRAINING' | 'BOTH';
    effectiveDuration?: number;
}

const formatDuration = (seconds: number) => {
    if (!seconds) return '';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
        return `${hours} hora${hours !== 1 ? 's' : ''} ${minutes > 0 ? `${minutes} minuto${minutes !== 1 ? 's' : ''}` : ''}`;
    }
    
    if (minutes > 0) {
        return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
    }
    
    return `${remainingSeconds} segundo${remainingSeconds !== 1 ? 's' : ''}`;
};

export function NutritionAgendaPage() {
    const { user } = useAuthStore();
    const { professional } = useProfessional();
    const navigate = useNavigate();

    // Use professional ID from context or fallback
    const professionalId = professional?.sub || user?.id;
    const { data: realClients } = useProfessionalClients(professionalId?.toString() || '');
    const { data: slots } = useAvailableSlots(professionalId?.toString() || '');
    const { data: apiAppointments, isLoading: isLoadingAppointments } = useGetAppointments(professionalId?.toString() || '');
    const insertAppointmentMutation = useInsertAppointment();
    const deleteAppointmentMutation = useDeleteAppointment();
    const updateAppointmentMutation = useUpdateAppointment();


    const [currentDate, setCurrentDate] = useState(new Date());
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [selectedDateForAppointment, setSelectedDateForAppointment] = useState<Date>(new Date());
    const [isDateConfirmed, setIsDateConfirmed] = useState(true);
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
    const [meetingLink, setMeetingLink] = useState('');
    const [appointmentTitle, setAppointmentTitle] = useState('');
    const [appointmentNotes, setAppointmentNotes] = useState('');
    const [selectedType, setSelectedType] = useState<'NUTRITION' | 'TRAINING' | 'BOTH'>('NUTRITION');
    const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
    const [modalView, setModalView] = useState<'LIST' | 'FORM'>('LIST');
    const [agendaTab, setAgendaTab] = useState<'UPCOMING' | 'HISTORY'>('UPCOMING');
    const [sessionFilterQuery, setSessionFilterQuery] = useState('');

    // Helper to generate 30-min slots between start and end time
    const generateAvailableTimes = (startTime: string, endTime: string) => {
        const times = [];
        const start = new Date(startTime.includes('T') ? startTime : `1970-01-01T${startTime}`);
        let end = new Date(endTime.includes('T') ? endTime : `1970-01-01T${endTime}`);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

        if (end <= start) {
            end.setDate(end.getDate() + 1);
        }

        const current = new Date(start);
        while (current < end) {
            times.push(current.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
            current.setMinutes(current.getMinutes() + 30);
        }
        return times;
    };

    const getTimeSlotsForSelectedDate = () => {
        if (!slots) return [];
        const dayOfWeek = getDay(selectedDateForAppointment);
        const mappedDay = dayOfWeek === 0 ? 7 : dayOfWeek;
        const slot = slots.find(s => Number(s.day_of_week) === mappedDay);

        if (!slot || !slot.is_active) return [];
        return generateAvailableTimes(slot.start_time, slot.end_time);
    };

    const timeSlots = getTimeSlotsForSelectedDate();

    const appointments: Appointment[] = (apiAppointments || []).map(apiApp => {
        const client = realClients?.find(c => Number(c.id) === Number(apiApp.client_id));
        const scheduledDate = new Date(apiApp.scheduled_at);
        return {
            id: apiApp.id,
            clientId: apiApp.client_id.toString(),
            clientName: client?.name || 'Cliente Desconocido',
            clientAvatar: client?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(client?.name || 'U')}&background=random`,
            date: scheduledDate,
            time: format(scheduledDate, 'HH:mm'),
            type: apiApp.type || 'NUTRITION',
            effectiveDuration: apiApp.effective_duration
        };
    });

    const resetModal = () => {
        setIsAddModalOpen(false);
        setModalView('LIST');
        setSelectedClient(null);
        setSelectedTime(null);
        setMeetingLink('');
        setAppointmentTitle('');
        setAppointmentNotes('');
        setSelectedType('NUTRITION');
        setEditingAppointment(null);
        setSearchQuery('');
    };

    const handleConfirmAppointment = () => {
        if (selectedTime && selectedClient && professionalId) {
            const [hours, minutes] = selectedTime.split(':').map(Number);
            const appDate = new Date(selectedDateForAppointment);
            appDate.setHours(hours, minutes, 0, 0);
            const scheduled_at = appDate.toISOString();

            if (editingAppointment) {
                updateAppointmentMutation.mutate({
                    id: editingAppointment.id,
                    data: {
                        scheduled_at: scheduled_at,
                        title: appointmentTitle || undefined,
                        notes: appointmentNotes || undefined,
                        meeting_link: meetingLink || undefined,
                        type: selectedType
                    }
                }, {
                    onSuccess: () => {
                        resetModal();
                        setToastMessage('Sesión actualizada correctamente');
                        setShowSuccessToast(true);
                    }
                });
            } else {
                insertAppointmentMutation.mutate({
                    professional_id: Number(professionalId),
                    client_id: Number(selectedClient.id),
                    scheduled_at: scheduled_at,
                    duration_minutes: 30,
                    status: 'SCHEDULED',
                    meeting_link: meetingLink || undefined,
                    title: appointmentTitle || undefined,
                    notes: appointmentNotes || undefined,
                    type: selectedType
                }, {
                    onSuccess: () => {
                        resetModal();
                        setToastMessage('Sesión agregada correctamente');
                        setShowSuccessToast(true);
                    }
                });
            }
        }
    };

    const confirmDelete = () => {
        if (appointmentToDelete) {
            deleteAppointmentMutation.mutate(appointmentToDelete.id, {
                onSuccess: () => {
                    setToastMessage('Sesión eliminada correctamente');
                    setShowSuccessToast(true);
                    setAppointmentToDelete(null);
                }
            });
        }
    };

    useEffect(() => {
        if (showSuccessToast) {
            const timer = setTimeout(() => setShowSuccessToast(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [showSuccessToast]);

    const getAppointmentsForDay = (day: Date) => appointments.filter(app => isSameDay(app.date, day));

    const getBookedTimesForDay = (day: Date) => getAppointmentsForDay(day).map(app => app.time);

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
    const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    // Filtering logic for the new sections
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    const endOfCurrentWeek = endOfWeek(today, { weekStartsOn: 1 });

    const upcomingAppointments = appointments
        .filter(app => {
            const appDate = startOfDay(app.date);
            const matchesSearch = app.clientName.toLowerCase().includes(sessionFilterQuery.toLowerCase());
            return (isAfter(appDate, today) || isSameDay(appDate, today)) && 
                   (apiAppointments?.find(a => a.id === app.id)?.status !== 'completed') &&
                   matchesSearch;
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    const historyAppointments = appointments
        .filter(app => {
            const raw = apiAppointments?.find(a => a.id === app.id);
            const matchesSearch = app.clientName.toLowerCase().includes(sessionFilterQuery.toLowerCase());
            return (isBefore(app.date, today) || raw?.status === 'completed') && matchesSearch;
        })
        .sort((a, b) => b.date.getTime() - a.date.getTime());

    const todayApps = upcomingAppointments.filter(app => isSameDay(app.date, today));
    const tomorrowApps = upcomingAppointments.filter(app => isSameDay(app.date, tomorrow));
    const laterThisWeekApps = upcomingAppointments.filter(app => 
        isAfter(startOfDay(app.date), tomorrow) && !isAfter(startOfDay(app.date), endOfCurrentWeek)
    );

    const renderAppointmentCard = (appt: Appointment, showActions: boolean = true) => {
        const rawApp = apiAppointments?.find(a => a.id === appt.id);
        const isCompleted = rawApp?.status === 'completed';

        return (
            <div 
                key={appt.id}
                className="group flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl hover:border-nutrition-200 hover:shadow-md transition-all"
            >
                <div className="relative">
                    <img src={appt.clientAvatar} alt="" className="w-12 h-12 rounded-xl object-cover bg-gray-100 shadow-sm" />
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-xs`}>
                        <div className={`w-2.5 h-2.5 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-nutrition-500'}`} />
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 truncate uppercase tracking-tight">{appt.clientName}</span>
                        {isCompleted && (
                            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md leading-none">COMPLETADA</span>
                        )}
                        {isCompleted && appt.effectiveDuration && (
                            <span className="text-[10px] font-medium text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-md leading-none border border-gray-100">
                                {formatDuration(appt.effectiveDuration)}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 font-medium">
                        <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-nutrition-600" />
                            {appt.time}
                        </div>
                        <div className="flex items-center gap-1">
                            <CalendarIcon className="w-3.5 h-3.5 text-nutrition-600" />
                            {format(appt.date, 'd MMM', { locale: es })}
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-gray-50 border border-gray-100">
                            {appt.type === 'NUTRITION' && <Apple className="w-3 h-3 text-emerald-500" />}
                            {appt.type === 'TRAINING' && <Dumbbell className="w-3 h-3 text-orange-500" />}
                            {appt.type === 'BOTH' && (
                                <>
                                    <Apple className="w-3 h-3 text-emerald-500" />
                                    <Dumbbell className="w-3 h-3 text-orange-500" />
                                </>
                            )}
                        </div>
                    </div>
                </div>
                {showActions && !isCompleted && (
                    <div className="flex items-center gap-2">
                        {isToday(appt.date) && (
                            <button 
                                onClick={() => navigate(`/nutrition/consultation/${appt.id}`)}
                                className="p-2 bg-nutrition-50 text-nutrition-600 rounded-xl hover:bg-nutrition-600 hover:text-white transition-all shadow-sm group/btn"
                                title="Iniciar Sesión"
                            >
                                <Play className="w-4 h-4 fill-current" />
                            </button>
                        )}
                        <button 
                            onClick={() => {
                                const client = realClients?.find(c => Number(c.id) === Number(appt.clientId));
                                if (client && rawApp) {
                                    setSelectedClient(client);
                                    setAppointmentTitle(rawApp.title || '');
                                    setAppointmentNotes(rawApp.notes || '');
                                    setMeetingLink(rawApp.meeting_link || '');
                                    setSelectedType(rawApp.type as any || 'NUTRITION');
                                    setEditingAppointment(appt);
                                    setSelectedTime(appt.date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
                                    setModalView('FORM');
                                    setSelectedDateForAppointment(appt.date);
                                    setIsAddModalOpen(true);
                                }
                            }}
                            className="p-2 text-gray-400 hover:text-nutrition-600 hover:bg-nutrition-50 rounded-xl transition-all"
                        >
                            <Search className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setAppointmentToDelete(appt)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 relative">
            <AnimatePresence>
                {showSuccessToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, x: "-50%" }}
                        exit={{ opacity: 0, y: -20, x: "-50%" }}
                        className="fixed top-6 left-1/2 z-100 flex items-center gap-3 bg-nutrition-600 text-white px-6 py-3 rounded-full shadow-lg shadow-nutrition-200"
                    >
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">{toastMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
                    <p className="text-gray-500">Gestiona tus sesiones y disponibilidad</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setCurrentDate(new Date())}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        Hoy
                    </button>
                    <button
                        onClick={() => {
                            setSelectedDateForAppointment(new Date());
                            setIsDateConfirmed(false);
                            setModalView('FORM');
                            setIsAddModalOpen(true);
                        }}
                        className="px-4 py-2 bg-nutrition-600 text-white rounded-xl font-medium hover:bg-nutrition-700 transition-colors shadow-lg shadow-nutrition-200 flex items-center gap-2"
                    >
                        <CalendarIcon className="w-4 h-4" />
                        Nueva Sesión
                    </button>
                </div>
            </div>

            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
            >
                <div className="p-6 flex items-center justify-between border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900 capitalize">
                        {format(currentDate, 'MMMM yyyy', { locale: es })}
                    </h2>
                    <div className="flex items-center gap-2">
                        <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-colors">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className={`p-6 max-h-[700px] overflow-y-auto custom-scrollbar transition-opacity duration-300 ${isLoadingAppointments ? 'opacity-50' : 'opacity-100'}`}>
                    <div className="grid grid-cols-7 mb-4">
                        {weekDays.map(day => (
                            <div key={day} className="text-center text-sm font-semibold text-gray-400 uppercase tracking-wider py-2">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-y-4 gap-x-2">
                        {calendarDays.map((day) => {
                            const dayAppointments = getAppointmentsForDay(day);
                            const hasAppointments = dayAppointments.length > 0;
                            const isSelectedMonth = isSameMonth(day, monthStart);
                            const isTodayDate = isToday(day);
                            
                            return (
                                <div
                                    key={day.toString()}
                                    onClick={() => {
                                        setSelectedDateForAppointment(day);
                                        const dayApps = getAppointmentsForDay(day);
                                        if (dayApps.length > 0) {
                                            setModalView('LIST');
                                        } else {
                                            setIsDateConfirmed(true);
                                            setModalView('FORM');
                                        }
                                        setIsAddModalOpen(true);
                                    }}
                                    className="relative flex flex-col items-center group cursor-pointer"
                                >
                                    <div className={`
                                        w-10 h-10 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-sm font-medium transition-all duration-300 relative
                                        ${isSelectedMonth ? 'text-gray-700' : 'text-gray-300'}
                                        ${isTodayDate ? 'bg-nutrition-600 text-white shadow-lg shadow-nutrition-200' : 'hover:bg-gray-50'}
                                        ${hasAppointments && !isTodayDate ? 'bg-nutrition-50 text-nutrition-700 font-bold' : ''}
                                    `}>
                                        {format(day, 'd')}
                                        {hasAppointments && !isTodayDate && (
                                            <div className="absolute bottom-2 w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-nutrition-500" />
                                        )}
                                        {hasAppointments && isTodayDate && (
                                            <div className="absolute bottom-2 w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-white/70" />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </motion.div>

            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="space-y-6"
            >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 bg-gray-100/50 p-1.5 rounded-2xl border border-gray-100 w-fit">
                        <button
                            onClick={() => setAgendaTab('UPCOMING')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                agendaTab === 'UPCOMING'
                                    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-100'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <CalendarDays className="w-4 h-4" />
                            Próximas Sesiones
                        </button>
                        <button
                            onClick={() => setAgendaTab('HISTORY')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                agendaTab === 'HISTORY'
                                    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-100'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <History className="w-4 h-4" />
                            Historial
                        </button>
                    </div>

                    <div className="relative max-w-xs w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por cliente..."
                            value={sessionFilterQuery}
                            onChange={(e) => setSessionFilterQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-100 focus:outline-none focus:ring-2 focus:ring-nutrition-500/10 focus:border-nutrition-200 text-sm bg-white shadow-xs"
                        />
                    </div>
                </div>

                {agendaTab === 'UPCOMING' ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Hoy */}
                        <div className="space-y-4">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wider">
                                <div className="w-2 h-2 rounded-full bg-nutrition-600" />
                                Hoy
                                <span className="ml-auto text-[10px] bg-nutrition-50 text-nutrition-600 px-2 py-0.5 rounded-full">
                                    {todayApps.length}
                                </span>
                            </h3>
                            <div className="space-y-3">
                                {todayApps.length > 0 ? (
                                    todayApps.map(app => renderAppointmentCard(app))
                                ) : (
                                    <div className="p-8 text-center bg-gray-50/50 border border-dashed border-gray-200 rounded-3xl">
                                        <p className="text-xs text-gray-400 font-medium">No hay sesiones para hoy</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Mañana */}
                        <div className="space-y-4">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wider">
                                <div className="w-2 h-2 rounded-full bg-nutrition-400" />
                                Mañana
                                <span className="ml-auto text-[10px] bg-nutrition-50 text-nutrition-600 px-2 py-0.5 rounded-full">
                                    {tomorrowApps.length}
                                </span>
                            </h3>
                            <div className="space-y-3">
                                {tomorrowApps.length > 0 ? (
                                    tomorrowApps.map(app => renderAppointmentCard(app))
                                ) : (
                                    <div className="p-8 text-center bg-gray-50/50 border border-dashed border-gray-200 rounded-3xl">
                                        <p className="text-xs text-gray-400 font-medium">No hay sesiones para mañana</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Esta Semana */}
                        <div className="space-y-4">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wider">
                                <div className="w-2 h-2 rounded-full bg-gray-300" />
                                Esta Semana
                                <span className="ml-auto text-[10px] bg-nutrition-50 text-nutrition-600 px-2 py-0.5 rounded-full">
                                    {laterThisWeekApps.length}
                                </span>
                            </h3>
                            <div className="space-y-3">
                                {laterThisWeekApps.length > 0 ? (
                                    laterThisWeekApps.map(app => renderAppointmentCard(app))
                                ) : (
                                    <div className="p-8 text-center bg-gray-50/50 border border-dashed border-gray-200 rounded-3xl">
                                        <p className="text-xs text-gray-400 font-medium">No hay más sesiones esta semana</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {historyAppointments.length > 0 ? (
                            historyAppointments.map(app => renderAppointmentCard(app))
                        ) : (
                            <div className="col-span-full py-12 text-center bg-gray-50/50 border border-dashed border-gray-200 rounded-3xl">
                                <History className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                <p className="text-gray-500 font-medium">Aún no hay historial de sesiones</p>
                            </div>
                        )}
                    </div>
                )}
            </motion.div>

            {/* Modals moved from Dashboard */}
            <AnimatePresence>
                {isAddModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/20 backdrop-blur-xs z-50 flex items-center justify-center p-4"
                        onClick={resetModal}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100"
                        >
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">
                                        {modalView === 'LIST' 
                                            ? `Sesiones del ${format(selectedDateForAppointment, 'd MMM', { locale: es })}`
                                            : editingAppointment 
                                                ? 'Editar Sesión' 
                                                : 'Agendar Nueva Sesión'}
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        {modalView === 'LIST'
                                            ? 'Gestiona las sesiones programadas para este día'
                                            : editingAppointment 
                                                ? 'Modifica los detalles de la sesión' 
                                                : 'Selecciona un cliente para continuar'}
                                    </p>
                                </div>
                                <button onClick={resetModal} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6">
                                {modalView === 'LIST' ? (
                                    <div className="space-y-4">
                                        <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                                            {getAppointmentsForDay(selectedDateForAppointment).length > 0 ? (
                                                getAppointmentsForDay(selectedDateForAppointment).map((appt) => (
                                                    <div className="group/item relative" key={appt.id}>
                                                        <button
                                                            onClick={() => {
                                                                const client = realClients?.find(c => Number(c.id) === Number(appt.clientId));
                                                                const rawApp = apiAppointments?.find(a => a.id === appt.id);
                                                                if (client && rawApp) {
                                                                    setSelectedClient(client);
                                                                    setAppointmentTitle(rawApp.title || '');
                                                                    setAppointmentNotes(rawApp.notes || '');
                                                                    setMeetingLink(rawApp.meeting_link || '');
                                                                    setSelectedType(rawApp.type as any || 'NUTRITION');
                                                                    setEditingAppointment(appt);
                                                                    setSelectedTime(appt.date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
                                                                    setModalView('FORM');
                                                                }
                                                            }}
                                                            className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-nutrition-50/50 transition-all text-left border border-gray-100 hover:border-nutrition-100 bg-white"
                                                        >
                                                            <div className="relative">
                                                                <img src={appt.clientAvatar} alt="" className="w-12 h-12 rounded-2xl object-cover bg-gray-100 shadow-sm" />
                                                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-xs">
                                                                    <div className="w-2.5 h-2.5 rounded-full bg-nutrition-500" />
                                                                </div>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-base font-bold text-gray-900 truncate group-hover/item:text-nutrition-700 transition-colors uppercase tracking-tight">{appt.clientName}</p>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-nutrition-600 bg-nutrition-50 px-2 py-1 rounded-lg">
                                                                        <Clock className="w-3.5 h-3.5" />
                                                                        {appt.time}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white border border-gray-100 shadow-xs">
                                                                        {appt.type === 'NUTRITION' && <Apple className="w-3.5 h-3.5 text-emerald-500" />}
                                                                        {appt.type === 'TRAINING' && <Dumbbell className="w-3.5 h-3.5 text-orange-500" />}
                                                                        {appt.type === 'BOTH' && (
                                                                            <>
                                                                                <Apple className="w-3 h-3 text-emerald-500" />
                                                                                <Dumbbell className="w-3 h-3 text-orange-500" />
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        navigate(`/nutrition/consultation/${appt.id}`);
                                                                    }}
                                                                    className="p-2 rounded-xl text-nutrition-600 hover:bg-nutrition-50 transition-all mr-1"
                                                                    title="Iniciar Sesión"
                                                                >
                                                                    <Play className="w-5 h-5 fill-current" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAppointmentToDelete(appt);
                                                                    }}
                                                                    className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                                                >
                                                                    <Trash2 className="w-5 h-5" />
                                                                </button>
                                                                <ChevronRight className="w-5 h-5 text-gray-300 group-hover/item:text-nutrition-400 transition-colors" />
                                                            </div>
                                                        </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                                                    <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                                    <p className="font-medium text-gray-900">Sin sesiones para este día</p>
                                                    <p className="text-sm mt-1">¡Agenda tu primera sesión!</p>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => {
                                                setIsDateConfirmed(true);
                                                setModalView('FORM');
                                            }}
                                            className="w-full py-4 bg-nutrition-600 text-white rounded-2xl font-bold hover:bg-nutrition-700 transition-all shadow-lg shadow-nutrition-200 flex items-center justify-center gap-2"
                                        >
                                            <CalendarIcon className="w-5 h-5" />
                                            Nueva Sesión
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {!selectedClient ? (
                                            <>
                                                <div className="relative mb-6">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Buscar cliente por nombre..."
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        autoFocus
                                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-nutrition-500/20 focus:border-nutrition-500 text-gray-900 placeholder:text-gray-400"
                                                    />
                                                </div>

                                                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                                    {(realClients || []).filter((c: IProfessionalClient) =>
                                                        `${c.name}`.toLowerCase().includes(searchQuery.toLowerCase())
                                                    ).map((client: IProfessionalClient) => (
                                                        <button
                                                            key={client.id}
                                                            onClick={() => setSelectedClient(client)}
                                                            className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all group text-left"
                                                        >
                                                            <img
                                                                src={client.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(client.name || '')}&background=random`}
                                                                alt=""
                                                                className="w-10 h-10 rounded-full object-cover bg-gray-200"
                                                            />
                                                            <div className="flex-1">
                                                                <p className="font-semibold text-gray-900">{client.name}</p>
                                                                <p className="text-xs text-gray-500">{client.email}</p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                                <button 
                                                    onClick={() => setModalView('LIST')} 
                                                    className="w-full mt-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                            </>
                                        ) : !isDateConfirmed ? (
                                            <>
                                                <div className="mb-6 flex items-center gap-3 p-3 bg-nutrition-50 rounded-xl">
                                                    <img
                                                        src={selectedClient.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedClient.name || 'User')}&background=random`}
                                                        alt=""
                                                        className="w-10 h-10 rounded-full"
                                                    />
                                                    <div>
                                                        <p className="font-bold text-gray-900">{selectedClient.name}</p>
                                                        <p className="text-xs text-nutrition-700">Seleccionando fecha</p>
                                                    </div>
                                                    <button onClick={() => setSelectedClient(null)} className="ml-auto text-xs text-gray-500 hover:text-gray-900 underline">Cambiar</button>
                                                </div>

                                                <div className="mb-8">
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de la Sesión</label>
                                                    <input
                                                        type="date"
                                                        value={format(selectedDateForAppointment, 'yyyy-MM-dd')}
                                                        onChange={(e) => {
                                                            if (e.target.value) {
                                                                const [y, m, d] = e.target.value.split('-').map(Number);
                                                                setSelectedDateForAppointment(new Date(y, m - 1, d));
                                                            }
                                                        }}
                                                        className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-nutrition-500/20 focus:border-nutrition-500 text-gray-900"
                                                    />
                                                </div>

                                                <div className="flex gap-3">
                                                    <button onClick={() => setSelectedClient(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors">Atrás</button>
                                                    <button onClick={() => setIsDateConfirmed(true)} className="flex-1 py-2.5 rounded-xl bg-nutrition-600 text-white font-medium hover:bg-nutrition-700 transition-colors shadow-lg shadow-nutrition-200">Continuar</button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="mb-6 flex items-center gap-3 p-3 bg-nutrition-50 rounded-xl">
                                                    <img
                                                        src={selectedClient.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedClient.name || 'User')}&background=random`}
                                                        alt=""
                                                        className="w-10 h-10 rounded-full"
                                                    />
                                                    <div>
                                                        <p className="font-bold text-gray-900">{selectedClient.name}</p>
                                                        <p className="text-xs text-nutrition-700">Horario para el {format(selectedDateForAppointment, 'dd/MM/yyyy')}</p>
                                                    </div>
                                                    {!editingAppointment && (
                                                        <button onClick={() => setIsDateConfirmed(false)} className="ml-auto text-xs text-gray-500 hover:text-gray-900 underline">Cambiar</button>
                                                    )}
                                                </div>

                                                <div className="mb-6 space-y-4">
                                                    <input
                                                        type="text"
                                                        placeholder="Título de la sesión (Opcional)"
                                                        value={appointmentTitle}
                                                        onChange={(e) => setAppointmentTitle(e.target.value)}
                                                        className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-nutrition-500/20 focus:border-nutrition-500"
                                                    />
                                                    <div className="flex gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100">
                                                        {(['NUTRITION', 'TRAINING', 'BOTH'] as const).map((type) => (
                                                            <button
                                                                key={type}
                                                                onClick={() => setSelectedType(type)}
                                                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                                                                    selectedType === type
                                                                        ? 'bg-white shadow-sm ring-1 ring-gray-200 text-gray-900'
                                                                        : 'text-gray-400 hover:text-gray-600'
                                                                }`}
                                                            >
                                                                {type === 'NUTRITION' && <Apple className="w-3.5 h-3.5 text-emerald-500" />}
                                                                {type === 'TRAINING' && <Dumbbell className="w-3.5 h-3.5 text-orange-500" />}
                                                                {type === 'BOTH' && (
                                                                    <div className="flex items-center -space-x-1">
                                                                        <Apple className="w-3 h-3 text-emerald-500" />
                                                                        <Dumbbell className="w-3 h-3 text-orange-500" />
                                                                    </div>
                                                                )}
                                                                {type === 'BOTH' ? 'MIXTA' : type}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <textarea
                                                        placeholder="Notas (Opcional)"
                                                        value={appointmentNotes}
                                                        onChange={(e) => setAppointmentNotes(e.target.value)}
                                                        rows={3}
                                                        className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-nutrition-500/20 focus:border-nutrition-500 resize-none"
                                                    />
                                                    <input
                                                        type="url"
                                                        placeholder="Link de reunión (Opcional)"
                                                        value={meetingLink}
                                                        onChange={(e) => setMeetingLink(e.target.value)}
                                                        className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-nutrition-500/20 focus:border-nutrition-500"
                                                    />
                                                </div>

                                                <div className="mb-6">
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">Horarios Disponibles</label>
                                                    <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto p-1">
                                                        {timeSlots.length > 0 ? (
                                                            timeSlots.map(time => {
                                                                const isBooked = getBookedTimesForDay(selectedDateForAppointment).includes(time);
                                                                // Allow selecting the current time if editing
                                                                const isSelectedTime = selectedTime === time;
                                                                
                                                                return (
                                                                    <button
                                                                        key={time}
                                                                        disabled={isBooked && !isSelectedTime}
                                                                        onClick={() => setSelectedTime(time)}
                                                                        className={`py-2 rounded-lg text-sm font-medium transition-all ${isBooked && !isSelectedTime ? 'bg-red-50 text-red-400 cursor-not-allowed border border-red-100' :
                                                                                isSelectedTime ? 'bg-nutrition-600 text-white shadow-md' : 'bg-gray-50 text-gray-700 hover:bg-white hover:border-gray-200 border border-transparent'
                                                                            }`}
                                                                    >
                                                                        {time}
                                                                    </button>
                                                                );
                                                            })
                                                        ) : (
                                                            <div className="col-span-4 py-4 text-center text-gray-500 text-sm italic">No hay horarios disponibles</div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex gap-3">
                                                    <button 
                                                        onClick={() => {
                                                            if (editingAppointment) {
                                                                setModalView('LIST');
                                                            } else {
                                                                setIsDateConfirmed(false);
                                                            }
                                                        }} 
                                                        className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                                                    >
                                                        Atrás
                                                    </button>
                                                    <button
                                                        disabled={!selectedTime || insertAppointmentMutation.isPending || updateAppointmentMutation.isPending}
                                                        onClick={handleConfirmAppointment}
                                                        className="flex-1 py-2.5 rounded-xl bg-nutrition-600 text-white font-medium hover:bg-nutrition-700 transition-colors shadow-lg shadow-nutrition-200"
                                                    >
                                                        {insertAppointmentMutation.isPending || updateAppointmentMutation.isPending ? 'Guardando...' : editingAppointment ? 'Guardar Cambios' : 'Confirmar Sesión'}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {appointmentToDelete && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/20 backdrop-blur-xs z-60 flex items-center justify-center p-4"
                        onClick={() => setAppointmentToDelete(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-100"
                        >
                            <div className="p-6 text-center">
                                <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar Sesión</h3>
                                <p className="text-gray-500 text-sm mb-6">¿Estás seguro que deseas eliminar la sesión con <span className="font-semibold text-gray-900">{appointmentToDelete.clientName}</span>?</p>
                                <div className="flex gap-3">
                                    <button onClick={() => setAppointmentToDelete(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors">Cancelar</button>
                                    <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors">Eliminar</button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
