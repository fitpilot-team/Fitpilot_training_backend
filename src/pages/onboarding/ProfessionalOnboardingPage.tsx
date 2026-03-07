import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  CheckCircle2,
  Clock3,
  LogOut,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { createClient } from '@/api/api.client';
import { getUserRequest, logoutRequest } from '@/api/auth/auth.api';
import { AvailableSlot } from '@/components/profile/availableSlot';
import { ProfileAvatarUploader } from '@/components/profile/ProfileAvatarUploader';
import {
  useAvailableSlots,
} from '@/features/professional-clients/queries';
import type { IAvailableSlots } from '@/features/professional-clients/types';
import { useUpdateProfilePicture } from '@/features/users/queries';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { useAuthStore } from '@/store/newAuthStore';

const DAYS = [
  { id: 1, label: 'Lunes' },
  { id: 2, label: 'Martes' },
  { id: 3, label: 'Miercoles' },
  { id: 4, label: 'Jueves' },
  { id: 5, label: 'Viernes' },
  { id: 6, label: 'Sabado' },
  { id: 7, label: 'Domingo' },
];

const STEPS = [
  { id: 'personal', label: 'Datos personales', icon: UserRound },
  { id: 'schedule', label: 'Horarios', icon: Clock3 },
  { id: 'profile', label: 'Perfil profesional', icon: Briefcase },
  { id: 'review', label: 'Confirmacion', icon: ShieldCheck },
] as const;

type StepId = (typeof STEPS)[number]['id'];

type ProfessionalProfileForm = {
  title: string;
  biography: string;
  specialties: string;
  license_number: string;
  work_address: string;
  website: string;
  instagram: string;
  linkedin: string;
  facebook: string;
};

const EMPTY_PROFILE_FORM: ProfessionalProfileForm = {
  title: '',
  biography: '',
  specialties: '',
  license_number: '',
  work_address: '',
  website: '',
  instagram: '',
  linkedin: '',
  facebook: '',
};

const api = createClient({ baseURL: import.meta.env.VITE_NUTRITION_API_URL });
const PROFESSIONAL_PROFILE_ENDPOINT = '/v1/professional-profiles/me';
const PROFESSIONAL_ONBOARDING_SUBMIT_ENDPOINT = '/v1/professional-profiles/onboarding';
const WEEKDAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTH_OPTIONS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const GENDER_OPTIONS = [
  { value: 'female', label: 'Femenino' },
  { value: 'male', label: 'Masculino' },
  { value: 'non_binary', label: 'No binario' },
  { value: 'prefer_not_to_say', label: 'Prefiero no decirlo' },
] as const;

function parseIsoDateLocal(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toIsoDateLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildMonthGrid(viewDate: Date) {
  const first = startOfMonth(viewDate);
  const firstWeekDayMondayFirst = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];

  for (let i = 0; i < firstWeekDayMondayFirst; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatBirthdayDisplay(value?: string) {
  if (!value) return 'Selecciona una fecha';
  const date = parseIsoDateLocal(value);
  if (!date) return 'Selecciona una fecha';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function getGenderLabel(value?: string) {
  return GENDER_OPTIONS.find((option) => option.value === value)?.label ?? 'Selecciona una opcion';
}

function formatMonthTitle(date: Date) {
  const raw = new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric',
  }).format(date);
  return raw.replace(/\b\w/g, (match) => match.toUpperCase());
}

function BirthDatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  type PickerStage = 'day' | 'month' | 'year';

  const today = new Date();
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedDate = value ? parseIsoDateLocal(value) : null;
  const fallbackDate = selectedDate || new Date(today.getFullYear() - 25, today.getMonth(), Math.min(today.getDate(), 28));
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(
    startOfMonth(fallbackDate)
  );
  const [stage, setStage] = useState<PickerStage>('day');
  const [draftDay, setDraftDay] = useState<number>(fallbackDate.getDate());
  const [draftMonth, setDraftMonth] = useState<number>(fallbackDate.getMonth());
  const [draftYear, setDraftYear] = useState<number>(fallbackDate.getFullYear());
  const [yearPageStart, setYearPageStart] = useState<number>(
    Math.floor(fallbackDate.getFullYear() / 12) * 12
  );
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const parsed = value ? parseIsoDateLocal(value) : null;
    const source = parsed || new Date(today.getFullYear() - 25, today.getMonth(), Math.min(today.getDate(), 28));
    setViewDate(startOfMonth(source));
    setDraftDay(source.getDate());
    setDraftMonth(source.getMonth());
    setDraftYear(source.getFullYear());
    setYearPageStart(Math.floor(source.getFullYear() / 12) * 12);
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const source = selectedDate || new Date(today.getFullYear() - 25, today.getMonth(), Math.min(today.getDate(), 28));
    setStage('day');
    setViewDate(startOfMonth(source));
    setDraftDay(source.getDate());
    setDraftMonth(source.getMonth());
    setDraftYear(source.getFullYear());
    setYearPageStart(Math.floor(source.getFullYear() / 12) * 12);
  }, [isOpen]); // reset flujo al abrir

  const monthGrid = buildMonthGrid(viewDate);
  const maxMonth = startOfMonth(today);
  const canGoNextMonth = viewDate.getTime() < maxMonth.getTime();
  const stepLabels: Array<{ key: PickerStage; label: string }> = [
    { key: 'day', label: 'Dia' },
    { key: 'month', label: 'Mes' },
    { key: 'year', label: 'Año' },
  ];
  const yearOptions = Array.from({ length: 12 }, (_, index) => yearPageStart + index);

  const finalizeSelection = (nextYear: number, nextMonth = draftMonth, nextDay = draftDay) => {
    const maxDays = new Date(nextYear, nextMonth + 1, 0).getDate();
    const safeDay = Math.min(nextDay, maxDays);
    let finalDate = new Date(nextYear, nextMonth, safeDay);
    if (finalDate > todayDateOnly) finalDate = todayDateOnly;
    onChange(toIsoDateLocal(finalDate));
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-blue-300 focus:outline-none focus:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Fecha</p>
          <p className={`truncate text-sm font-medium ${value ? 'text-gray-900' : 'text-gray-400'}`}>
            {formatBirthdayDisplay(value)}
          </p>
        </div>
        <span className="ml-3 grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <Calendar className="h-4 w-4" />
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-[calc(100%+10px)] z-30 w-[320px] max-w-[92vw] rounded-3xl border border-gray-100 bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.14)]">
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50/70 p-1">
            {stepLabels.map((item) => {
              const isActive = item.key === stage;
              const isDone =
                (item.key === 'day' && stage !== 'day') ||
                (item.key === 'month' && stage === 'year');
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    if (item.key === 'day') setStage('day');
                    if (item.key === 'month' && draftDay) setStage('month');
                    if (item.key === 'year' && draftDay) setStage('year');
                  }}
                  className={`flex-1 rounded-xl px-2 py-2 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-white text-blue-700 shadow-sm'
                      : isDone
                        ? 'text-blue-700'
                        : 'text-gray-500'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mb-3 rounded-2xl border border-gray-100 bg-gray-50/70 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Flujo</p>
            <p className="mt-1 text-xs text-gray-700">
              Dia: <span className="font-semibold text-blue-700">{draftDay}</span> · Mes:{' '}
              <span className="font-semibold text-blue-700">{MONTH_OPTIONS[draftMonth]}</span> · Año:{' '}
              <span className="font-semibold text-blue-700">{draftYear}</span>
            </p>
          </div>

          {stage === 'day' && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setViewDate((prev) => addMonths(prev, -1))}
                  className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-base font-bold text-gray-900">{formatMonthTitle(viewDate)}</p>
                <button
                  type="button"
                  onClick={() => canGoNextMonth && setViewDate((prev) => addMonths(prev, 1))}
                  disabled={!canGoNextMonth}
                  className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Mes siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-2 grid grid-cols-7 gap-1">
                {WEEKDAY_HEADERS.map((label) => (
                  <div key={label} className="py-2 text-center text-xs font-semibold text-gray-400">
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {monthGrid.map((dateCell, index) => {
                  if (!dateCell) {
                    return <div key={`empty-${index}`} className="h-9" />;
                  }

                  const isFuture = dateCell > todayDateOnly;
                  const isActiveDay = dateCell.getDate() === draftDay;
                  const isToday = isSameDay(dateCell, todayDateOnly);

                  return (
                    <button
                      key={toIsoDateLocal(dateCell)}
                      type="button"
                      disabled={isFuture}
                      onClick={() => {
                        setDraftDay(dateCell.getDate());
                        setDraftMonth(viewDate.getMonth());
                        setDraftYear(viewDate.getFullYear());
                        setStage('month');
                      }}
                      className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold transition ${
                        isActiveDay
                          ? 'bg-blue-500 text-white shadow-[0_8px_20px_rgba(59,130,246,0.35)]'
                          : isToday
                            ? 'border border-blue-200 bg-blue-50 text-blue-700'
                            : 'text-gray-800 hover:bg-blue-50 hover:text-blue-700'
                      } disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent`}
                    >
                      {dateCell.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {stage === 'month' && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStage('day')}
                  className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Volver a dia"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-base font-bold text-gray-900">Selecciona el mes</p>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-600">
                  {draftYear}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {MONTH_OPTIONS.map((monthLabel, monthIndex) => (
                  <button
                    key={monthLabel}
                    type="button"
                    onClick={() => {
                      setDraftMonth(monthIndex);
                      setViewDate(new Date(draftYear, monthIndex, 1));
                      setStage('year');
                    }}
                    className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                      monthIndex === draftMonth
                        ? 'bg-blue-500 text-white shadow-[0_10px_22px_rgba(59,130,246,0.28)]'
                        : 'border border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                  >
                    {monthLabel.slice(0, 3)}
                  </button>
                ))}
              </div>
            </>
          )}

          {stage === 'year' && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStage('month')}
                  className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Volver a mes"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-base font-bold text-gray-900">Selecciona el año</p>
                <button
                  type="button"
                  onClick={() => setYearPageStart((prev) => Math.max(1900, prev - 12))}
                  className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Años anteriores"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[86px] text-center text-xs font-semibold text-gray-500">
                  {yearPageStart} - {Math.min(yearPageStart + 11, todayDateOnly.getFullYear())}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setYearPageStart((prev) => {
                      const next = prev + 12;
                      return next > todayDateOnly.getFullYear() ? prev : next;
                    })
                  }
                  className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={yearPageStart + 12 > todayDateOnly.getFullYear()}
                  aria-label="Años siguientes"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {yearOptions.map((yearValue) => {
                  const disabled = yearValue > todayDateOnly.getFullYear() || yearValue < 1900;
                  return (
                    <button
                      key={yearValue}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setDraftYear(yearValue);
                        finalizeSelection(yearValue, draftMonth, draftDay);
                      }}
                      className={`rounded-2xl px-2 py-3 text-sm font-semibold transition ${
                        yearValue === draftYear
                          ? 'bg-blue-500 text-white shadow-[0_10px_22px_rgba(59,130,246,0.28)]'
                          : 'border border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                      } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-gray-700`}
                    >
                      {yearValue}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-gray-500 transition hover:bg-gray-100"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => finalizeSelection(draftYear, draftMonth, draftDay)}
              className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GenderPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-blue-300 focus:outline-none focus:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Genero</p>
          <p className={`truncate text-sm font-medium ${value ? 'text-gray-900' : 'text-gray-400'}`}>
            {getGenderLabel(value)}
          </p>
        </div>
        <span className="ml-3 flex items-center gap-1 rounded-xl bg-blue-50 px-2.5 py-2 text-blue-600">
          <UserRound className="h-4 w-4" />
          <ChevronDown className={`h-4 w-4 transition ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-[calc(100%+10px)] z-30 w-full min-w-[260px] rounded-3xl border border-gray-100 bg-white p-3 shadow-[0_18px_48px_rgba(15,23,42,0.14)]">
          <div className="mb-2 rounded-2xl border border-blue-100 bg-blue-50/70 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
              Selecciona genero
            </p>
            <p className="mt-1 text-xs text-blue-700/90">
              Elige la opcion que mejor represente tu perfil.
            </p>
          </div>

          <div className="space-y-1">
            {GENDER_OPTIONS.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                    selected
                      ? 'bg-blue-500 text-white shadow-[0_10px_22px_rgba(59,130,246,0.28)]'
                      : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  <span>{option.label}</span>
                  {selected && <Check className="h-4 w-4" />}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-gray-500 transition hover:bg-gray-100"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDateForInput(value?: string | null) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTimeForInput(time: string) {
  if (!time) return '09:00';
  if (time.includes('T')) {
    const d = new Date(time);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
  }
  return time.substring(0, 5);
}

function normalizeSlots(slots?: IAvailableSlots[]) {
  return DAYS.map((day) => {
    const existing = slots?.find((s) => Number(s.day_of_week) === day.id);
    if (existing) {
      return {
        ...existing,
        day_of_week: day.id,
        start_time: formatTimeForInput(existing.start_time),
        end_time: formatTimeForInput(existing.end_time),
      };
    }
    return { day_of_week: day.id, start_time: '09:00', end_time: '17:00', is_active: false } as IAvailableSlots;
  });
}

function mapSocialMedia(form: ProfessionalProfileForm) {
  return {
    website: form.website || null,
    instagram: form.instagram || null,
    linkedin: form.linkedin || null,
    facebook: form.facebook || null,
  };
}

function specialtiesToText(value: unknown) {
  return Array.isArray(value) ? value.filter(Boolean).join(', ') : typeof value === 'string' ? value : '';
}

function draftKey(userId?: string | number) {
  return `fitpilot:onboarding:profile:${userId ?? 'anon'}`;
}

function onboardingDraftKey(userId?: string | number) {
  return `fitpilot:onboarding:json:${userId ?? 'anon'}`;
}

async function fetchProfessionalProfile() {
  try {
    const { data } = await api.get(PROFESSIONAL_PROFILE_ENDPOINT);
    return data as Record<string, any>;
  } catch (error: any) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
}

export function ProfessionalOnboardingPage() {
  const navigate = useNavigate();
  const { professional, refreshProfessional } = useProfessional();
  const { user, setUser, logout } = useAuthStore();
  const updateProfilePictureMutation = useUpdateProfilePicture();

  const professionalId = useMemo(() => {
    const v = Number(professional?.sub ?? user?.id);
    return Number.isFinite(v) && v > 0 ? v : null;
  }, [professional?.sub, user?.id]);

  const { data: fetchedSlots, isLoading: isLoadingSlots } = useAvailableSlots(professionalId?.toString() || '');

  const [stepIndex, setStepIndex] = useState(0);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [avatarTouched, setAvatarTouched] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [personalForm, setPersonalForm] = useState({
    date_of_birth: formatDateForInput(user?.date_of_birth),
    genre: user?.genre || user?.gender || '',
  });
  const [workSlots, setWorkSlots] = useState<IAvailableSlots[]>(() => normalizeSlots());
  const [professionalForm, setProfessionalForm] = useState<ProfessionalProfileForm>(EMPTY_PROFILE_FORM);

  useEffect(() => {
    setPersonalForm({
      date_of_birth: formatDateForInput(user?.date_of_birth),
      genre: user?.genre || user?.gender || '',
    });
  }, [user?.date_of_birth, user?.genre, user?.gender]);

  useEffect(() => {
    setWorkSlots(normalizeSlots(fetchedSlots));
  }, [fetchedSlots]);

  useEffect(() => {
    if (!user?.id || profileLoaded) return;
    (async () => {
      try {
        const profile = await fetchProfessionalProfile();
        if (profile) {
          setProfessionalForm({
            title: profile.title || '',
            biography: profile.biography || '',
            specialties: specialtiesToText(profile.specialties),
            license_number: profile.license_number || '',
            work_address: profile.work_address || '',
            website: profile.social_media?.website || '',
            instagram: profile.social_media?.instagram || '',
            linkedin: profile.social_media?.linkedin || '',
            facebook: profile.social_media?.facebook || '',
          });
        } else {
          const raw = localStorage.getItem(draftKey(user.id));
          if (raw) setProfessionalForm((prev) => ({ ...prev, ...JSON.parse(raw) }));
        }
      } catch {
        const raw = localStorage.getItem(draftKey(user.id));
        if (raw) setProfessionalForm((prev) => ({ ...prev, ...JSON.parse(raw) }));
      } finally {
        setProfileLoaded(true);
      }
    })();
  }, [profileLoaded, user?.id]);

  const currentStep = STEPS[stepIndex];
  const progress = ((stepIndex + 1) / STEPS.length) * 100;
  const activeWorkDays = workSlots.filter((s) => s.is_active).length;

  const canContinue = useMemo(() => {
    if (currentStep.id === 'personal') return Boolean(personalForm.date_of_birth && personalForm.genre);
    if (currentStep.id === 'profile') {
      return Boolean(
        professionalForm.title.trim() &&
          professionalForm.biography.trim() &&
          professionalForm.specialties.trim()
      );
    }
    return true;
  }, [currentStep.id, personalForm, professionalForm]);

  const onboardingPayload = useMemo(() => {
    const normalizedSlots = workSlots.map((slot) => ({
      day_of_week: Number(slot.day_of_week),
      is_active: Boolean(slot.is_active),
      start_time: slot.start_time.length === 5 ? `${slot.start_time}:00` : slot.start_time,
      end_time: slot.end_time.length === 5 ? `${slot.end_time}:00` : slot.end_time,
    }));

    return {
      onboarding_status: 'completed',
      personal_information: {
        date_of_birth: personalForm.date_of_birth || null,
        genre: personalForm.genre || null,
        profile_picture: user?.profile_picture || null,
      },
      work_schedule: normalizedSlots,
      professional_profile: {
        title: professionalForm.title.trim() || null,
        biography: professionalForm.biography.trim() || null,
        specialties: professionalForm.specialties
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        license_number: professionalForm.license_number.trim() || null,
        work_address: professionalForm.work_address.trim() || null,
        social_media: mapSocialMedia(professionalForm),
      },
      meta: {
        professional_id: professionalId,
        user_id: user?.id ? Number(user.id) : null,
        source: 'professional_onboarding_stepper',
      },
    };
  }, [personalForm, workSlots, professionalForm, user?.profile_picture, user?.id, professionalId]);

  useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(onboardingDraftKey(user.id), JSON.stringify(onboardingPayload));
  }, [onboardingPayload, user?.id]);

  const syncUserFromApi = async () => {
    try {
      setUser(await getUserRequest());
    } catch {}
  };

  const handleExit = async () => {
    try {
      await logoutRequest();
    } catch {
      // Keep local logout path even if backend logout request fails.
    }

    logout();
    navigate('/auth/login', { replace: true });
  };

  const handleAvatarSave = async (blob: Blob) => {
    await updateProfilePictureMutation.mutateAsync(blob);
    setAvatarTouched(true);
    await syncUserFromApi();
    toast.success('Foto de perfil actualizada');
  };

  const handleToggleDay = async (index: number) => {
    setWorkSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], is_active: !next[index].is_active };
      return next;
    });
  };

  const handleTimeChange = async (index: number, field: 'start_time' | 'end_time', value: string) => {
    setWorkSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const onNext = async () => {
    if (!canContinue || isSavingStep) return;
    if (currentStep.id !== 'review') {
      setStepIndex((s) => s + 1);
      return;
    }

    setIsSavingStep(true);
    try {
      await api.post(PROFESSIONAL_ONBOARDING_SUBMIT_ENDPOINT, onboardingPayload);
      if (user?.id) {
        localStorage.removeItem(draftKey(user.id));
        localStorage.removeItem(onboardingDraftKey(user.id));
      }
      await syncUserFromApi();
      await refreshProfessional();
      toast.success('Onboarding enviado correctamente');
      navigate('/', { replace: true });
    } catch (error: any) {
      toast.error(
        error?.message ||
          'No se pudo enviar el onboarding final. Verifica el endpoint configurado en frontend.'
      );
    } finally {
      setIsSavingStep(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50">
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-600 shadow-sm">
          Cargando onboarding...
        </div>
      </div>
    );
  }

  const titleByStep: Record<StepId, string> = {
    personal: 'Completa tu informacion personal',
    schedule: 'Define tus horarios de trabajo',
    profile: 'Configura tu perfil profesional',
    review: 'Revisa y finaliza',
  };

  const subtitleByStep: Record<StepId, string> = {
    personal: 'Necesitamos estos datos para personalizar tu cuenta profesional.',
    schedule: 'Estos horarios se reflejaran en tu agenda y disponibilidad.',
    profile: 'Agrega una presentacion y datos profesionales de tu perfil.',
    review: 'Revisa tu informacion antes de finalizar la configuracion inicial.',
  };

  const renderStep = () => {
    if (currentStep.id === 'personal') {
      return (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_360px]">
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Fecha de nacimiento
                </label>
                <BirthDatePicker
                  value={personalForm.date_of_birth}
                  onChange={(nextDate) => setPersonalForm((p) => ({ ...p, date_of_birth: nextDate }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Genero</label>
                <GenderPicker
                  value={personalForm.genre}
                  onChange={(nextValue) => setPersonalForm((p) => ({ ...p, genre: nextValue }))}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <UserRound className="h-4 w-4 text-blue-600" />
                Cuenta
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Nombre</p>
                  <p className="mt-1 text-sm font-medium text-gray-800">
                    {[user.name, user.lastname].filter(Boolean).join(' ') || user.full_name || 'Sin nombre'}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Email</p>
                  <p className="mt-1 break-all text-sm font-medium text-gray-800">{user.email}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-linear-to-b from-white to-gray-50 p-5">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900">Foto de perfil</h3>
              <p className="mt-1 text-sm text-gray-500">Opcional. Puedes subirla ahora o despues.</p>
            </div>
            <div className="flex justify-center">
              <ProfileAvatarUploader
                firstName={user.name}
                lastName={user.lastname || undefined}
                imageUrl={user.profile_picture || null}
                onSave={handleAvatarSave}
                isSaving={updateProfilePictureMutation.isPending}
              />
            </div>
            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
              {avatarTouched ? 'Tu foto ya se guardo correctamente.' : 'Si omites este paso, se usara un avatar con iniciales.'}
            </div>
          </div>
        </div>
      );
    }

    if (currentStep.id === 'schedule') {
      return (
        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-gray-200 bg-white p-5">
              <div className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Calendar className="h-5 w-5 text-emerald-600" />
                Horarios de trabajo
              </div>
              <p className="text-sm leading-relaxed text-gray-500">
                Define los intervalos en los que estaras disponible para sesiones.
              </p>
            </div>
            <div className="rounded-3xl border border-blue-100 bg-blue-50/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Resumen rapido</p>
              <p className="mt-2 text-sm text-blue-900">
                {activeWorkDays > 0 ? `${activeWorkDays} dia(s) activos configurados` : 'Aun no tienes dias activos'}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-blue-700">
                Los cambios se usaran en agenda y disponibilidad.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {isLoadingSlots
              ? Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-3xl border border-gray-100 bg-gray-50" />
                ))
              : workSlots.map((slot, index) => (
                  <AvailableSlot
                    key={slot.day_of_week}
                    slot={slot}
                    index={index}
                    dayName={DAYS[index].label}
                    isSaving={isSavingStep}
                    handleToggleDay={handleToggleDay}
                    handleTimeChange={handleTimeChange}
                  />
                ))}
          </div>
        </div>
      );
    }

    if (currentStep.id === 'profile') {
      return (
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Titulo profesional</label>
              <input
                value={professionalForm.title}
                onChange={(e) => setProfessionalForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Ej. Nutriologa clinica y deportiva"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Cedula / licencia</label>
              <input
                value={professionalForm.license_number}
                onChange={(e) => setProfessionalForm((p) => ({ ...p, license_number: e.target.value }))}
                placeholder="Opcional"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Biografia</label>
            <textarea
              rows={5}
              value={professionalForm.biography}
              onChange={(e) => setProfessionalForm((p) => ({ ...p, biography: e.target.value }))}
              placeholder="Describe tu enfoque, experiencia y tipo de pacientes que atiendes."
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Especialidades</label>
              <input
                value={professionalForm.specialties}
                onChange={(e) => setProfessionalForm((p) => ({ ...p, specialties: e.target.value }))}
                placeholder="Nutricion deportiva, recomposicion corporal, salud metabolica"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]"
              />
              <p className="text-xs text-gray-500">Separa con comas.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Direccion de trabajo</label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={professionalForm.work_address}
                  onChange={(e) => setProfessionalForm((p) => ({ ...p, work_address: e.target.value }))}
                  placeholder="Consultorio, ciudad o modalidad online"
                  className="w-full rounded-2xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]"
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Redes sociales</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {([
                ['website', 'Sitio web'],
                ['instagram', 'Instagram'],
                ['linkedin', 'LinkedIn'],
                ['facebook', 'Facebook'],
              ] as const).map(([key, label]) => (
                <input
                  key={key}
                  value={professionalForm[key]}
                  onChange={(e) => setProfessionalForm((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder={label}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                />
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <UserRound className="h-4 w-4 text-blue-600" />
            Informacion personal
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <p><span className="font-medium text-gray-900">Fecha de nacimiento:</span> {personalForm.date_of_birth || 'No definida'}</p>
            <p><span className="font-medium text-gray-900">Genero:</span> {personalForm.genre || 'No definido'}</p>
            <p><span className="font-medium text-gray-900">Foto de perfil:</span> {(user.profile_picture || avatarTouched) ? 'Configurada' : 'Pendiente (opcional)'}</p>
          </div>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Calendar className="h-4 w-4 text-emerald-600" />
            Horarios
          </div>
          <p className="text-sm text-gray-600"><span className="font-medium text-gray-900">Dias activos:</span> {activeWorkDays}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {workSlots.filter((s) => s.is_active).length > 0 ? (
              workSlots.filter((s) => s.is_active).map((slot) => (
                <span key={slot.day_of_week} className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  {DAYS.find((d) => d.id === Number(slot.day_of_week))?.label}: {slot.start_time} - {slot.end_time}
                </span>
              ))
            ) : (
              <span className="text-xs italic text-gray-500">Sin horarios activos configurados</span>
            )}
          </div>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Briefcase className="h-4 w-4 text-violet-600" />
            Perfil profesional
          </div>
          <div className="grid gap-3 text-sm text-gray-600 md:grid-cols-2">
            <p><span className="font-medium text-gray-900">Titulo:</span> {professionalForm.title || 'No definido'}</p>
            <p><span className="font-medium text-gray-900">Cedula/licencia:</span> {professionalForm.license_number || 'No definida'}</p>
            <p className="md:col-span-2"><span className="font-medium text-gray-900">Especialidades:</span> {professionalForm.specialties || 'No definidas'}</p>
            <p className="md:col-span-2"><span className="font-medium text-gray-900">Biografia:</span> {professionalForm.biography || 'No definida'}</p>
          </div>
        </div>
        <div className="rounded-3xl border border-blue-100 bg-linear-to-r from-blue-50 to-cyan-50 p-5 lg:col-span-2">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-blue-900">Ya casi terminas</p>
              <p className="mt-1 text-sm text-blue-700">
                Al finalizar guardaremos tu configuracion inicial y te llevaremos a tu panel principal.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f7fb]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 -top-24 h-72 w-72 rounded-full bg-blue-200/45 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-emerald-100/60 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-sky-100/70 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-white/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
              <span>Paso {stepIndex + 1} de {STEPS.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleExit}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" />
            Salir
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-10">
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-3xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Configuracion inicial
            </div>
            <div className="space-y-2">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === stepIndex;
                const isDone = index < stepIndex;
                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition ${
                      isActive
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : isDone
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-transparent bg-gray-50 text-gray-500'
                    }`}
                  >
                    <div
                      className={`grid h-8 w-8 place-items-center rounded-xl ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : isDone
                            ? 'bg-emerald-600 text-white'
                            : 'border border-gray-200 bg-white text-gray-500'
                      }`}
                    >
                      {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{step.label}</p>
                      <p className="text-xs opacity-80">Paso {index + 1}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="rounded-[28px] border border-white/90 bg-white/90 p-4 shadow-xl shadow-gray-200/40 backdrop-blur sm:p-6 lg:p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                {titleByStep[currentStep.id]}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{subtitleByStep[currentStep.id]}</p>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setStepIndex((s) => Math.max(s - 1, 0))}
                disabled={stepIndex === 0 || isSavingStep}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Anterior
              </button>

              <button
                type="button"
                onClick={onNext}
                disabled={!canContinue || isSavingStep}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:shadow-xl hover:shadow-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingStep ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Guardando...
                  </>
                ) : currentStep.id === 'review' ? (
                  <>
                    Finalizar onboarding
                    <CheckCircle2 className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Siguiente paso
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
