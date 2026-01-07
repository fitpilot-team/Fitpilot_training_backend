import { useEffect, useState } from "react";
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { IAvailableSlots } from "@/features/professional-clients/types";

interface IAvailableSlotProps {
    slot: IAvailableSlots;
    index: number;
    dayName: string;
    isSaving?: boolean;
    handleToggleDay: (index: number) => Promise<void>;
    handleTimeChange: (index: number, field: 'start_time' | 'end_time', value: string, skipSave?: boolean) => Promise<void>;
}

export const AvailableSlot = ({ slot, index, dayName, isSaving, handleToggleDay, handleTimeChange }: IAvailableSlotProps) => {
    const [startTime, setStartTime] = useState(slot.start_time.substring(0, 5));
    const [endTime, setEndTime] = useState(slot.end_time.substring(0, 5));

    useEffect(() => {
        setStartTime(slot.start_time.substring(0, 5));
        setEndTime(slot.end_time.substring(0, 5));
    }, [slot.start_time, slot.end_time]);

    const onStartTimeChange = (value: string) => {
        setStartTime(value);
        handleTimeChange(index, 'start_time', value);
    };

    const onEndTimeChange = (value: string) => {
        setEndTime(value);
        handleTimeChange(index, 'end_time', value);
    };

    return (
        <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: index * 0.05 }}
            className={`
                p-5 rounded-3xl border transition-all duration-300
                ${slot.is_active
                    ? 'bg-white border-gray-100 shadow-sm'
                    : 'bg-gray-50/50 border-gray-100 opacity-60'}
            `}
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div
                        onClick={() => handleToggleDay(index)}
                        className={`
                            w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200
                            ${slot.is_active ? 'bg-nutrition-600' : 'bg-gray-300'}
                        `}
                    >
                        <div className={`
                            w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-200
                            ${slot.is_active ? 'translate-x-6' : 'translate-x-0'}
                        `} />
                    </div>
                    <span className={`text-base font-bold transition-colors ${slot.is_active ? 'text-gray-900' : 'text-gray-400'}`}>
                        {dayName}
                    </span>
                    {isSaving && (
                        <Loader2 className="w-4 h-4 text-nutrition-600 animate-spin" />
                    )}
                </div>

                <div className={`flex items-center gap-3 transition-all duration-300 ${slot.is_active ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Inicio</label>
                        <input
                            type="time"
                            value={startTime}
                            onChange={(e) => onStartTimeChange(e.target.value)}
                            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-nutrition-500/20 focus:border-nutrition-500 outline-none transition-all"
                        />
                    </div>
                    <div className="w-3 h-px bg-gray-300 mt-5" />
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Fin</label>
                        <input
                            type="time"
                            value={endTime}
                            onChange={(e) => onEndTimeChange(e.target.value)}
                            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-nutrition-500/20 focus:border-nutrition-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {!slot.is_active && (
                    <div className="text-sm font-medium text-gray-400 italic">
                        Día no laborable
                    </div>
                )}
            </div>
        </motion.div>
    );
};