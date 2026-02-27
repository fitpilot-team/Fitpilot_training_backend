import React from 'react';
import { IAppointment as Appointment } from '@/features/appointments/types';
import { FileText, Calendar, Clock, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ConsultationHistorySidebarProps {
    appointments: Appointment[];
    currentAppointmentId?: number;
    onViewHistory?: (appointmentId: number) => void;
}

export const ConsultationHistorySidebar: React.FC<ConsultationHistorySidebarProps> = ({ 
    appointments, 
    currentAppointmentId,
    onViewHistory 
}) => {
    // Filter out current appointment and sort by date descending
    const pastAppointments = appointments
        .filter(app => app.id !== currentAppointmentId && new Date(app.scheduled_at) < new Date())
        .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

    if (pastAppointments.length === 0) return null;

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                        <FileText className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-gray-800 text-sm">Expediente</h3>
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {pastAppointments.length} Sesiones
                </span>
            </div>

            <div className="max-h-60 overflow-y-auto custom-scrollbar p-2">
                <div className="flex flex-col gap-2">
                    {pastAppointments.map((appointment) => (
                        <div 
                            key={appointment.id} 
                            onClick={() => onViewHistory?.(appointment.id)}
                            className="group flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-all cursor-pointer border border-transparent hover:border-gray-100"
                        >
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-3 h-3 text-gray-400" />
                                    <span className="text-xs font-bold text-gray-700">
                                        {(() => {
                                            try {
                                                const date = new Date(appointment.scheduled_at);
                                                if (isNaN(date.getTime())) throw new Error('Invalid date');
                                                return format(date, "d MMM yyyy", { locale: es });
                                            } catch (e) {
                                                return 'Fecha inválida';
                                            }
                                        })()}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-3 h-3 text-gray-300" />
                                    <span className="text-[10px] font-medium text-gray-500">
                                        {(() => {
                                            try {
                                                  const date = new Date(appointment.scheduled_at);
                                                  if (isNaN(date.getTime())) throw new Error('Invalid date');
                                                  return format(date, "h:mm a");
                                            } catch (e) {
                                                return '--:--';
                                            }
                                        })()}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="w-6 h-6 rounded-full bg-white border border-gray-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                                <ChevronRight className="w-3 h-3 text-gray-400" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
