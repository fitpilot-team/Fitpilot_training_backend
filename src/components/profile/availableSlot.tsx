import { useEffect, useRef, useState } from "react";
import { motion } from 'framer-motion';
import { ChevronDown, Clock3, Loader2 } from 'lucide-react';
import { IAvailableSlots } from "@/features/professional-clients/types";

interface IAvailableSlotProps {
    slot: IAvailableSlots;
    index: number;
    dayName: string;
    isSaving?: boolean;
    handleToggleDay: (index: number) => Promise<void>;
    handleTimeChange: (index: number, field: 'start_time' | 'end_time', value: string, skipSave?: boolean) => Promise<void>;
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIOD_OPTIONS = ['a. m.', 'p. m.'] as const;

type Period = (typeof PERIOD_OPTIONS)[number];

function parseTimeToParts(time: string): { hour12: number; minute: string; period: Period } {
    const [hRaw = '09', mRaw = '00'] = (time || '09:00').split(':');
    const hour24 = Number(hRaw);
    const minute = String(Number.isFinite(Number(mRaw)) ? Number(mRaw) : 0).padStart(2, '0');
    const period: Period = hour24 >= 12 ? 'p. m.' : 'a. m.';
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return { hour12, minute, period };
}

function formatPartsToTime(hour12: number, minute: string, period: Period): string {
    let hour24 = hour12 % 12;
    if (period === 'p. m.') hour24 += 12;
    if (period === 'a. m.' && hour12 === 12) hour24 = 0;
    return `${String(hour24).padStart(2, '0')}:${minute}`;
}

function formatTimeDisplay(time: string) {
    const { hour12, minute, period } = parseTimeToParts(time);
    return `${String(hour12).padStart(2, '0')}:${minute} ${period}`;
}

interface TimePickerFieldProps {
    label: string;
    value: string;
    disabled?: boolean;
    onChange: (value: string) => void;
    onOpenChange?: (isOpen: boolean) => void;
}

function TimePickerField({ label, value, disabled, onChange, onOpenChange }: TimePickerFieldProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [draftHour, setDraftHour] = useState<number>(9);
    const [draftMinute, setDraftMinute] = useState<string>('00');
    const [draftPeriod, setDraftPeriod] = useState<Period>('a. m.');
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const next = parseTimeToParts(value);
        setDraftHour(next.hour12);
        setDraftMinute(next.minute);
        setDraftPeriod(next.period);
    }, [value]);

    useEffect(() => {
        if (!isOpen) return;
        const handleOutside = (event: MouseEvent) => {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [isOpen]);

    useEffect(() => {
        onOpenChange?.(isOpen);
    }, [isOpen, onOpenChange]);

    const applyDraft = () => {
        onChange(formatPartsToTime(draftHour, draftMinute, draftPeriod));
        setIsOpen(false);
    };

    return (
        <div ref={rootRef} className="relative flex flex-col">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">{label}</label>
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setIsOpen((prev) => !prev)}
                className="min-w-[150px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 outline-none transition-all hover:border-blue-300 focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
                <span className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2">
                        <Clock3 className="w-3.5 h-3.5 text-gray-500" />
                        {formatTimeDisplay(value)}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </span>
            </button>

            {isOpen && (
                <div className="absolute top-[calc(100%+8px)] left-0 z-[120] w-[250px] rounded-2xl border border-gray-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.16)] overflow-hidden">
                    <div className="grid grid-cols-[1fr_1fr_auto] bg-blue-600 text-white text-xs font-semibold">
                        <button
                            type="button"
                            onClick={() => setDraftHour(draftHour)}
                            className="px-3 py-2 bg-blue-500 border-r border-blue-400/70"
                        >
                            {String(draftHour).padStart(2, '0')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setDraftMinute(draftMinute)}
                            className="px-3 py-2 bg-blue-500 border-r border-blue-400/70"
                        >
                            {draftMinute}
                        </button>
                        <button
                            type="button"
                            onClick={() => setDraftPeriod(draftPeriod)}
                            className="px-3 py-2 bg-blue-500"
                        >
                            {draftPeriod}
                        </button>
                    </div>

                    <div className="grid grid-cols-[1fr_1fr_auto]">
                        <div className="max-h-44 overflow-auto p-1 border-r border-gray-100">
                            {HOURS_12.map((hour) => (
                                <button
                                    key={hour}
                                    type="button"
                                    onClick={() => setDraftHour(hour)}
                                    className={`w-full rounded-lg px-2 py-1.5 text-sm font-medium transition ${
                                        draftHour === hour
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    {String(hour).padStart(2, '0')}
                                </button>
                            ))}
                        </div>
                        <div className="max-h-44 overflow-auto p-1 border-r border-gray-100">
                            {MINUTE_OPTIONS.map((minute) => (
                                <button
                                    key={minute}
                                    type="button"
                                    onClick={() => setDraftMinute(minute)}
                                    className={`w-full rounded-lg px-2 py-1.5 text-sm font-medium transition ${
                                        draftMinute === minute
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    {minute}
                                </button>
                            ))}
                        </div>
                        <div className="p-1 w-[72px]">
                            {PERIOD_OPTIONS.map((period) => (
                                <button
                                    key={period}
                                    type="button"
                                    onClick={() => setDraftPeriod(period)}
                                    className={`mb-1 w-full rounded-lg px-2 py-2 text-sm font-semibold transition ${
                                        draftPeriod === period
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    {period}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-gray-100 bg-white px-2 py-2">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 transition"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={applyDraft}
                            className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
                        >
                            Listo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export const AvailableSlot = ({ slot, index, dayName, isSaving, handleToggleDay, handleTimeChange }: IAvailableSlotProps) => {
    const [startTime, setStartTime] = useState(slot.start_time.substring(0, 5));
    const [endTime, setEndTime] = useState(slot.end_time.substring(0, 5));
    const [openPicker, setOpenPicker] = useState<'start' | 'end' | null>(null);

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
                relative p-5 rounded-3xl border transition-all duration-300
                ${openPicker ? 'z-50' : 'z-0'}
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
                    <TimePickerField
                        label="Inicio"
                        value={startTime}
                        onChange={onStartTimeChange}
                        disabled={!slot.is_active}
                        onOpenChange={(isOpen) =>
                            setOpenPicker((prev) => (isOpen ? 'start' : prev === 'start' ? null : prev))
                        }
                    />
                    <div className="w-3 h-px bg-gray-300 mt-5" />
                    <TimePickerField
                        label="Fin"
                        value={endTime}
                        onChange={onEndTimeChange}
                        disabled={!slot.is_active}
                        onOpenChange={(isOpen) =>
                            setOpenPicker((prev) => (isOpen ? 'end' : prev === 'end' ? null : prev))
                        }
                    />
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
