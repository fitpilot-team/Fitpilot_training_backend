import { useState, useEffect } from 'react';
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
    getDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Clock,
    User,
    X,
    Search,
    Plus,
    CheckCircle,
    Trash2,
    AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
}

export function NutritionAgendaPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { professional } = useProfessional();

    // Use professional ID from context or fallback
    const professionalId = professional?.sub || user?.id;
    const { data: realClients } = useProfessionalClients(professionalId?.toString() || '');
    const { data: slots, isLoading: isLoadingSlots } = useAvailableSlots(professionalId?.toString() || '');
    const { data: apiAppointments, isLoading: isLoadingAppointments } = useGetAppointments(professionalId?.toString() || '');
    const insertAppointmentMutation = useInsertAppointment();
    const deleteAppointmentMutation = useDeleteAppointment();
    const updateAppointmentMutation = useUpdateAppointment();


    const [currentDate, setCurrentDate] = useState(new Date());
    const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
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
    const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

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
        } as any;
    });

    const resetModal = () => {
        setIsAddModalOpen(false);
        setSelectedClient(null);
        setSelectedTime(null);
        setMeetingLink('');
        setAppointmentTitle('');
        setAppointmentNotes('');
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
                        meeting_link: meetingLink || undefined
                    }
                }, {
                    onSuccess: () => {
                        resetModal();
                        setToastMessage('Cita actualizada correctamente');
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
                    notes: appointmentNotes || undefined
                }, {
                    onSuccess: () => {
                        resetModal();
                        setToastMessage('Cita agregada correctamente');
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
                    setToastMessage('Cita eliminada correctamente');
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
                    <h1 className="text-2xl font-bold text-gray-900">Agenda Nutricional</h1>
                    <p className="text-gray-500">Gestiona tus citas y disponibilidad</p>
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
                            setIsAddModalOpen(true);
                        }}
                        className="px-4 py-2 bg-nutrition-600 text-white rounded-xl font-medium hover:bg-nutrition-700 transition-colors shadow-lg shadow-nutrition-200 flex items-center gap-2"
                    >
                        <CalendarIcon className="w-4 h-4" />
                        Nueva Cita
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
                                        setIsDateConfirmed(true);
                                        setIsAddModalOpen(true);
                                        setHoveredDate(null);
                                    }}
                                    className="relative flex flex-col items-center group cursor-pointer"
                                    onMouseEnter={() => setHoveredDate(day)}
                                    onMouseLeave={() => setHoveredDate(null)}
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

                                    <AnimatePresence>
                                        {hoveredDate && isSameDay(hoveredDate, day) && hasAppointments && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                                                className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-3"
                                            >
                                                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                                                    Citas del {format(day, 'd MMM', { locale: es })}
                                                </div>
                                                <div className="space-y-2">
                                                    {dayAppointments.map((appt, i) => (
                                                        <div className="group/item relative" key={appt.id}>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const client = realClients?.find(c => Number(c.id) === Number(appt.clientId));
                                                                    const rawApp = apiAppointments?.find(a => a.id === appt.id);
                                                                    if (client && rawApp) {
                                                                        setSelectedClient(client);
                                                                        setSelectedDateForAppointment(appt.date);
                                                                        setSelectedTime(appt.time);
                                                                        setAppointmentTitle(rawApp.title || '');
                                                                        setAppointmentNotes(rawApp.notes || '');
                                                                        setMeetingLink(rawApp.meeting_link || '');
                                                                        setEditingAppointment(appt);
                                                                        setIsDateConfirmed(true);
                                                                        setIsAddModalOpen(true);
                                                                        setHoveredDate(null);
                                                                    }
                                                                }}
                                                                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors text-left"
                                                            >
                                                                <img src={appt.clientAvatar} alt="" className="w-8 h-8 rounded-full object-cover bg-gray-100" />
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium text-gray-900 truncate">{appt.clientName}</p>
                                                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                                                        <Clock className="w-3 h-3" />
                                                                        {appt.time}
                                                                    </div>
                                                                </div>
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setAppointmentToDelete(appt);
                                                                    setHoveredDate(null);
                                                                }}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all opacity-0 group-hover/item:opacity-100 shadow-sm"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-t border-l border-gray-100 transform rotate-45" />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                </div>
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
                                    <h2 className="text-lg font-bold text-gray-900">{editingAppointment ? 'Editar Cita' : 'Agendar Nueva Cita'}</h2>
                                    <p className="text-sm text-gray-500">{editingAppointment ? 'Modifica los detalles de la cita' : 'Selecciona un cliente para continuar'}</p>
                                </div>
                                <button onClick={resetModal} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6">
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
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de la Cita</label>
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
                                            <button onClick={() => setIsDateConfirmed(false)} className="ml-auto text-xs text-gray-500 hover:text-gray-900 underline">Cambiar</button>
                                        </div>

                                        <div className="mb-6 space-y-4">
                                            <input
                                                type="text"
                                                placeholder="Título de la cita (Opcional)"
                                                value={appointmentTitle}
                                                onChange={(e) => setAppointmentTitle(e.target.value)}
                                                className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-nutrition-500/20 focus:border-nutrition-500"
                                            />
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
                                                        return (
                                                            <button
                                                                key={time}
                                                                disabled={isBooked}
                                                                onClick={() => setSelectedTime(time)}
                                                                className={`py-2 rounded-lg text-sm font-medium transition-all ${isBooked ? 'bg-red-50 text-red-400 cursor-not-allowed border border-red-100' :
                                                                        selectedTime === time ? 'bg-nutrition-600 text-white' : 'bg-gray-50 text-gray-700 hover:bg-white hover:border-gray-200 border border-transparent'
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
                                            <button onClick={() => setIsDateConfirmed(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors">Atrás</button>
                                            <button
                                                disabled={!selectedTime || insertAppointmentMutation.isPending || updateAppointmentMutation.isPending}
                                                onClick={handleConfirmAppointment}
                                                className="flex-1 py-2.5 rounded-xl bg-nutrition-600 text-white font-medium hover:bg-nutrition-700 transition-colors shadow-lg shadow-nutrition-200"
                                            >
                                                {insertAppointmentMutation.isPending || updateAppointmentMutation.isPending ? 'Guardando...' : editingAppointment ? 'Guardar Cambios' : 'Confirmar Cita'}
                                            </button>
                                        </div>
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
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar Cita</h3>
                                <p className="text-gray-500 text-sm mb-6">¿Estás seguro que deseas eliminar la cita con <span className="font-semibold text-gray-900">{appointmentToDelete.clientName}</span>?</p>
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
