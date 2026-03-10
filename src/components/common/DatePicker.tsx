import { useState, useEffect } from 'react';
import { 
    format, 
    addMonths, 
    subMonths, 
    startOfMonth, 
    endOfMonth, 
    eachDayOfInterval, 
    isSameMonth, 
    isSameDay, 
    isToday, 
    startOfWeek, 
    endOfWeek,
    parseISO,
    isValid
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, Transition } from '@headlessui/react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { Fragment } from 'react';

interface DatePickerProps {
    label?: string;
    value: string;
    onChange: (date: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export function DatePicker({ label, value, onChange, placeholder = "Seleccionar fecha", className = "", disabled = false }: DatePickerProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    
    // Initialize current month focused based on value
    useEffect(() => {
        if (value) {
            const date = parseISO(value);
            if (isValid(date)) {
                setCurrentMonth(date);
            }
        }
    }, [value]);

    const selectedDate = value ? parseISO(value) : null;

    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }),
        end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 })
    });

    const nextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
    const prevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));

    const handleSelectDate = (date: Date, close: () => void) => {
        onChange(format(date, 'yyyy-MM-dd'));
        close();
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
    };

    const weekDays = ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá'];

    return (
        <div className={`space-y-1 ${className}`}>
            {label && (
                <span className="text-[9px] font-bold text-gray-400 ml-1 uppercase">{label}</span>
            )}
            <Popover className="relative">
                {({ open, close }) => (
                    <>
                        <Popover.Button 
                            disabled={disabled}
                            className={`
                                w-full flex items-center justify-between px-3 py-2 
                                bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 
                                transition-all group
                                ${open ? 'border-nutrition-500 ring-2 ring-nutrition-500/20' : ''}
                                ${disabled 
                                    ? 'bg-gray-100 cursor-not-allowed opacity-60' 
                                    : 'hover:border-nutrition-300 focus:ring-2 focus:ring-nutrition-500 focus:outline-none'
                                }
                            `}
                        >
                            <span className={`truncate ${!value ? 'text-gray-400 font-medium' : ''}`}>
                                {value ? format(parseISO(value), 'dd/MM/yyyy') : placeholder}
                            </span>
                            <div className="flex items-center gap-2">
                                {value && (
                                    <div 
                                        role="button"
                                        onClick={handleClear}
                                        className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                    </div>
                                )}
                                <CalendarIcon className={`w-3.5 h-3.5 ${open ? 'text-nutrition-500' : 'text-gray-400 group-hover:text-nutrition-500'} transition-colors`} />
                            </div>
                        </Popover.Button>

                        <Transition
                            as={Fragment}
                            enter="transition ease-out duration-200"
                            enterFrom="opacity-0 translate-y-1"
                            enterTo="opacity-100 translate-y-0"
                            leave="transition ease-in duration-150"
                            leaveFrom="opacity-100 translate-y-0"
                            leaveTo="opacity-0 translate-y-1"
                        >
                            <Popover.Panel className="absolute z-50 w-[280px] mt-2 transform left-0 sm:left-auto sm:right-0 lg:left-0 lg:right-auto bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-4 border border-gray-100">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <button 
                                        onClick={prevMonth}
                                        className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-500 hover:text-nutrition-600 transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-sm font-black text-gray-800 capitalize">
                                        {format(currentMonth, 'MMMM yyyy', { locale: es })}
                                    </span>
                                    <button 
                                        onClick={nextMonth}
                                        className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-500 hover:text-nutrition-600 transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Weekday Headers */}
                                <div className="grid grid-cols-7 mb-2">
                                    {weekDays.map(day => (
                                        <div key={day} className="text-center text-[10px] uppercase font-black text-gray-400 py-1">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Days */}
                                <div className="grid grid-cols-7 gap-1">
                                    {days.map((day, _) => {
                                        const isSelected = selectedDate && isSameDay(day, selectedDate);
                                        const isCurrentMonth = isSameMonth(day, currentMonth);
                                        const isTodayDate = isToday(day);

                                        return (
                                            <button
                                                key={day.toISOString()}
                                                onClick={() => handleSelectDate(day, close)}
                                                className={`
                                                    aspect-square text-xs font-medium rounded-lg flex items-center justify-center
                                                    transition-all relative
                                                    ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700 hover:bg-nutrition-50 hover:text-nutrition-700'}
                                                    ${isSelected ? 'bg-nutrition-500 text-white shadow-lg shadow-nutrition-500/30 hover:bg-nutrition-600 font-bold' : ''}
                                                    ${isTodayDate && !isSelected ? 'ring-1 ring-nutrition-500 text-nutrition-600 font-bold' : ''}
                                                `}
                                            >
                                                {format(day, 'd')}
                                                {isTodayDate && !isSelected && (
                                                    <div className="absolute bottom-1 w-1 h-1 rounded-full bg-nutrition-500" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Footer Actions */}
                                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between">
                                    <button 
                                        onClick={(e) => {
                                            handleClear(e as any);
                                            close();
                                        }}
                                        className="text-[10px] font-bold text-gray-400 hover:text-red-500 uppercase tracking-widest transition-colors"
                                    >
                                        Borrar
                                    </button>
                                    <button 
                                        onClick={() => handleSelectDate(new Date(), close)}
                                        className="text-[10px] font-bold text-nutrition-600 hover:text-nutrition-700 uppercase tracking-widest transition-colors"
                                    >
                                        Hoy
                                    </button>
                                </div>
                            </Popover.Panel>
                        </Transition>
                    </>
                )}
            </Popover>
        </div>
    );
}
