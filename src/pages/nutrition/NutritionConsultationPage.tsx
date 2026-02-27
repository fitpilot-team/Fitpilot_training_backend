import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock,
    ChevronLeft,
    ChevronRight,
    Pause,
    Play,
    Square,
    Save,
    FileText,
    Activity,
    AlertCircle,
    Calendar,
    Zap
} from 'lucide-react';
import { PatientSnapshotCard } from '@/components/consultation/PatientSnapshotCard';
import { ConsultationStepper } from '@/components/consultation/ConsultationStepper';
import { TmbCalculator } from '@/components/consultation/TmbCalculator';
import { DatePicker } from '@/components/common/DatePicker';
import { ConsultationProgress } from '@/components/consultation/ConsultationProgress';
import { ConsultationHistorySidebar } from '@/components/consultation/ConsultationHistorySidebar';

import { useGetAppointments, useStartConsultation, useFinishConsultation, useCreateAppointmentDraft, useUpdateAppointmentDraft, useGetAppointmentDraft } from '@/features/appointments/queries';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { useAuthStore } from '@/store/newAuthStore';
import { useProfessionalClients } from '@/features/professional-clients/queries';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClientHistoryPanel } from '@/components/ClientHistoryPanel';
import { Modal } from '@/components/common/Modal';
import { useClientHistory, useSaveClientMetric } from '@/features/client-history/queries';
import { useAudioRecorder } from '@/features/consultation/hooks/useAudioRecorder';
import { useTranscribeAudio } from '@/features/consultation/queries';
import { Loader2, Mic } from 'lucide-react';


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

    // Fetch client history for medical conditions
    const { data: clientHistory } = useClientHistory(appointment?.client_id);

    const medicalConditions = clientHistory?.client_records?.[0]?.medical_conditions;
    const hasConditions = medicalConditions && medicalConditions !== 'Ninguna' && medicalConditions.trim() !== '';

    // Extract goals
    const clientGoals = clientHistory?.client_goals?.map(g => g.goals.name).join(', ') || 'Sin objetivos definidos';

    // Calculate Last Session
    const clientAppointments = appointments?.filter(a => Number(a.client_id) === Number(appointment?.client_id)) || [];
    
    // Filter for past appointments (excluding current one if needed, or just previous dates)
    // Assuming status 'completed' or just date check. Let's use date check and exclude current.
    const pastAppointments = clientAppointments
        .filter(a => a.id !== appointment?.id && new Date(a.scheduled_at) < new Date())
        .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

    const upcomingAppointments = clientAppointments
        .filter(a => a.id !== appointment?.id && new Date(a.scheduled_at) > new Date())
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

    const [seconds, setSeconds] = useState(0);
    const [isActive, setIsActive] = useState(true);
    // Notes Sections State
    const [noteSections, setNoteSections] = useState({
        motivo: '',
        evolucion: '',
        indicaciones: '',
        acuerdos: ''
    });

    const [activeSection, setActiveSection] = useState<keyof typeof noteSections | null>(null);
    const [isTimerExpanded, setIsTimerExpanded] = useState(false);
    const [showEndConfirmation, setShowEndConfirmation] = useState(false);

    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyViewed] = useState(false);
    const [completedSteps, setCompletedSteps] = useState({
        measurements: false,
        progress: false,
        notes: false,
        plan: false
    });
    const [view, setView] = useState<'notes' | 'progress' | 'metrics' | 'planning'>('notes');

    const [metrics, setMetrics] = useState({
        weight: '',
        height: '',
        body_fat_pct: '',
        muscle_mass_kg: '',
        waist_cm: '',
        hip_cm: '',
        visceral_fat: '',
        water_pct: '',
        chest_cm: '',
        arm_left_cm: '',
        arm_right_cm: '',
        thigh_left_cm: '',
        thigh_right_cm: '',
        calf_left_cm: '',
        calf_right_cm: ''
    });

    const startMutation = useStartConsultation();
    const finishMutation = useFinishConsultation();
    const saveMetricMutation = useSaveClientMetric();
    const createDraftMutation = useCreateAppointmentDraft();
    const updateDraftMutation = useUpdateAppointmentDraft();

    // Voice Dictation
    const { startRecording, stopRecording, isRecording } = useAudioRecorder();
    const transcribeMutation = useTranscribeAudio();
    const [isTranscribing, setIsTranscribing] = useState(false);

    const handleSaveMetrics = () => {
        if (!appointment?.client_id) return;

        // Convert metrics to numbers or null if empty
        const processedMetrics = Object.entries(metrics).reduce((acc, [key, value]) => {
            acc[key] = value === '' ? null : Number(value);
            return acc;
        }, {} as any);

        const metricData = {
            user_id: Number(appointment.client_id),
            date: new Date().toISOString().split('T')[0],
            recorded_at: new Date().toISOString(),
            ...processedMetrics
        };

        // Remove null keys if the backend doesn't like them
        Object.keys(metricData).forEach(key => {
            if (metricData[key] === null) {
                delete metricData[key];
            }
        });

        saveMetricMutation.mutate(metricData, {
            onSuccess: () => {
                alert('Medidas guardadas correctamente');
            },
            onError: () => {
                alert('Error al guardar las medidas');
            }
        });
    };

    // --- Goal-Based Calculations ---
    const [calculatedTdee, setCalculatedTdee] = useState(0);
    const [targetMacros, setTargetMacros] = useState({
        calories: 0,
        proteins: 0,
        carbs: 0,
        fats: 0
    });

    // Plan Duration State
    const [planStartDate, setPlanStartDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    });

    const [planEndDate, setPlanEndDate] = useState(() => {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 15); // Tomorrow + 14 days
        return endDate.toISOString().split('T')[0];
    });

    const [mealsPerDay, setMealsPerDay] = useState(5);


    // Plan Duration State
    const activeGoal = clientHistory?.client_goals?.find(g => g.is_primary) || clientHistory?.client_goals?.[0]; // Added activeGoal logic
    const [modalTab, setModalTab] = useState<'history' | 'upcoming'>('history');
    const [selectedAppointmentDate, setSelectedAppointmentDate] = useState<string | null>(null);
    const finishConsultationMutation = finishMutation;

    // Effect to recalculate
    useEffect(() => {
        if (calculatedTdee > 0 && clientHistory?.client_goals?.length) {
            const primaryGoal = clientHistory.client_goals.find(g => g.is_primary) || clientHistory.client_goals[0];
            const goalData = primaryGoal.goals;
            
            let targetCals = calculatedTdee;

            // Apply adjustment (e.g. -20% or +500)
            if (goalData.adjustment_value) {
                if (goalData.adjustment_type === 'percent') {
                     targetCals = calculatedTdee * (1 + (goalData.adjustment_value / 100));
                } else if (goalData.adjustment_type === 'fixed') {
                     targetCals = calculatedTdee + goalData.adjustment_value;
                }
            }

            targetCals = Math.round(targetCals);

            // Calculate macros based on ratios
            let pRatio = Number(goalData.protein_ratio) || 0.3;
            let cRatio = Number(goalData.carbs_ratio) || 0.4;
            let fRatio = Number(goalData.fat_ratio) || 0.3;

            // Handle if ratios are actually percentages (e.g. 30 instead of 0.3)
            if (pRatio > 1) pRatio /= 100;
            if (cRatio > 1) cRatio /= 100;
            if (fRatio > 1) fRatio /= 100;

            const proteins = Math.round((targetCals * pRatio) / 4);
            const carbs = Math.round((targetCals * cRatio) / 4);
            const fats = Math.round((targetCals * fRatio) / 9);
            
            setTargetMacros({
                calories: targetCals,
                proteins,
                carbs,
                fats
            });
        }
    }, [calculatedTdee, clientHistory?.client_goals]);

    const updateMacro = (type: 'proteins' | 'carbs' | 'fats', delta: number) => {
        setTargetMacros(prev => {
            const newValue = Math.max(0, prev[type] + delta);
            // Recalculate calories
            const newCalories = (
                (type === 'proteins' ? newValue : prev.proteins) * 4 +
                (type === 'carbs' ? newValue : prev.carbs) * 4 +
                (type === 'fats' ? newValue : prev.fats) * 9
            );
            
            return {
                ...prev,
                [type]: newValue,
                calories: Math.round(newCalories)
            };
        });
    };

    const handleMacroKeyDown = (e: React.KeyboardEvent, type: 'proteins' | 'carbs' | 'fats') => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            updateMacro(type, 5);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            updateMacro(type, -5);
        }
    };

    const handleMacroInputChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'proteins' | 'carbs' | 'fats') => {
        const val = parseInt(e.target.value) || 0;
        const newValue = Math.max(0, val);
        setTargetMacros(prev => {
             const newCalories = (
                (type === 'proteins' ? newValue : prev.proteins) * 4 +
                (type === 'carbs' ? newValue : prev.carbs) * 4 +
                (type === 'fats' ? newValue : prev.fats) * 9
            );
            return {
                ...prev,
                [type]: newValue,
                calories: Math.round(newCalories)
            };
        });
    };

    const handleMicClick = async (section: keyof typeof noteSections) => {
        if (isRecording) {
            if (activeSection === section) {
                const audioBlob = await stopRecording();
                if (audioBlob) {
                    setIsTranscribing(true);
                    transcribeMutation.mutate(audioBlob, {
                        onSuccess: (data) => {
                            setNoteSections((prev) => ({
                                ...prev,
                                [section]: prev[section] + (prev[section] ? ' ' : '') + data
                            }));
                            setIsTranscribing(false);
                            setActiveSection(null);
                        },
                        onError: (error) => {
                            console.error('Transcription failed', error);
                            setIsTranscribing(false);
                            setActiveSection(null);
                        }
                    });
                }
            }
        } else {
            setActiveSection(section);
            startRecording();
        }
    };

    const handleNextStep = () => {
        if (view === 'metrics') {
            setCompletedSteps(prev => ({ ...prev, measurements: true }));
             setView('progress');
        } else if (view === 'progress') {
             setCompletedSteps(prev => ({...prev, progress: true}));
             setView('notes');
        } else if (view === 'notes') {
            setCompletedSteps(prev => ({ ...prev, notes: true }));
            setView('planning');
        } else if (view === 'planning') {
            setCompletedSteps(prev => ({ ...prev, plan: true }));
            setShowEndConfirmation(true);
        }
    };

    // Start consultation automatically if it hasn't started yet
    useEffect(() => {
        if (appointment && !appointment.start_date && !startMutation.isPending) {
            startMutation.mutate(appointment.id);
        }
    }, [appointment?.id, appointment?.start_date]);

    // Draft Retrieval and Creation Logic
    const { data: existingDraft, isLoading: isLoadingDraft } = useGetAppointmentDraft(Number(id));

    // Populate form with existing draft data
    useEffect(() => {
        if (existingDraft) {
            
            // Prioritize json_state if available
            if (existingDraft.json_state) {
                const state = existingDraft.json_state;
                
                if (state.stage) setView(state.stage as any);
                if (state.noteSections) setNoteSections(state.noteSections);
                if (state.metrics) setMetrics(state.metrics);
                if (state.targetMacros) setTargetMacros(state.targetMacros);
                if (state.seconds) setSeconds(state.seconds);

            } else {
                // Fallback to legacy fields
                if (existingDraft.stage) setView(existingDraft.stage as any);
                
                if (existingDraft.notes) {
                    const sections = {
                        motivo: '',
                        evolucion: '',
                        indicaciones: '',
                        acuerdos: ''
                    };
                    
                    const parts = existingDraft.notes.split('\n\n---\n\n');
                    parts.forEach((part: string) => {
                         if (part.startsWith('MOTIVO DE LA CONSULTA:')) sections.motivo = part.replace('MOTIVO DE LA CONSULTA:\n', '');
                         else if (part.startsWith('EVOLUCIÓN DESDE LA ÚLTIMA SESIÓN:')) sections.evolucion = part.replace('EVOLUCIÓN DESDE LA ÚLTIMA SESIÓN:\n', '');
                         else if (part.startsWith('INDICACIONES DADAS:')) sections.indicaciones = part.replace('INDICACIONES DADAS:\n', '');
                         else if (part.startsWith('ACUERDOS / PRÓXIMOS PASOS:')) sections.acuerdos = part.replace('ACUERDOS / PRÓXIMOS PASOS:\n', '');
                    });
                    setNoteSections(sections);
                }

                if (existingDraft.metrics) {
                    const metricsSource = existingDraft.metrics.metric || existingDraft.metrics;
                    const loadedMetrics = { ...metrics };
                    Object.keys(metricsSource).forEach(key => {
                        if (metricsSource[key] !== null && metricsSource[key] !== undefined) {
                            loadedMetrics[key as keyof typeof metrics] = String(metricsSource[key]);
                        }
                    });
                    setMetrics(loadedMetrics);
                }

                if (existingDraft.target_macros) {
                     setTargetMacros({
                        calories: existingDraft.target_macros.calories || 0,
                        proteins: existingDraft.target_macros.protein || 0,
                        carbs: existingDraft.target_macros.carbs || 0,
                        fats: existingDraft.target_macros.fats || 0
                     });
                }
            }
        }
    }, [existingDraft]);

    // Create Draft on Entry if not present
    useEffect(() => {
        if (appointment?.id && !isLoadingDraft && !existingDraft && !createDraftMutation.isPending && !createDraftMutation.isSuccess) {
            createDraftMutation.mutate({
                appointment_id: appointment.id,
                stage: view,
                notes: '',
                metrics: { metric: {} },
                target_macros: {
                    calories: 0,
                    protein: 0,
                    carbs: 0,
                    fats: 0
                },
                json_state: {
                    stage: view,
                    noteSections: {
                        motivo: '',
                        evolucion: '',
                        indicaciones: '',
                        acuerdos: ''
                    },
                    metrics: {},
                    targetMacros: {
                        calories: 0,
                        proteins: 0,
                        carbs: 0,
                        fats: 0
                    },
                    seconds: 0
                }
            });
        }
    }, [appointment?.id, existingDraft, isLoadingDraft]);
    
    // ... (rest of code) ...

    // Auto-save draft
    useEffect(() => {
        if (!appointment?.id) return;

        const timer = setTimeout(() => {
            const formattedNotes = Object.entries(noteSections)
                .map(([key, value]) => {
                    const labels: Record<string, string> = {
                        motivo: 'Motivo de la consulta',
                        evolucion: 'Evolución desde la última sesión',
                        indicaciones: 'Indicaciones dadas',
                        acuerdos: 'Acuerdos / próximos pasos'
                    };
                    return `${labels[key] || key.toUpperCase()}:\n${value}`;
                })
                .join('\n\n---\n\n');

            // Process metrics to remove empty strings
            const processedMetrics = Object.entries(metrics).reduce((acc, [key, value]) => {
                acc[key] = value === '' ? null : Number(value);
                return acc;
            }, {} as any);

            updateDraftMutation.mutate({
                appointmentId: appointment.id,
                data: {
                    stage: view,
                    notes: formattedNotes,
                    metrics: { metric: processedMetrics },
                    target_macros: {
                        calories: targetMacros.calories,
                        protein: targetMacros.proteins,
                        carbs: targetMacros.carbs,
                        fats: targetMacros.fats
                    },
                    json_state: {
                        stage: view,
                        noteSections,
                        metrics, // Saving raw metrics state strings to preserve input state
                        targetMacros
                    }
                }
            });
        }, 2000); // Debounce 2s

        return () => clearTimeout(timer);
    }, [noteSections, metrics, view, targetMacros, appointment?.id]);

    // Refs for state
    const stateRef = useRef({
        view,
        noteSections,
        metrics,
        targetMacros,
        seconds
    });

    useEffect(() => {
        stateRef.current = {
            view,
            noteSections,
            metrics,
            targetMacros,
            seconds
        };
    }, [view, noteSections, metrics, targetMacros, seconds]);

    const saveDraft = () => {
        if (!appointment?.id) return;
        const state = stateRef.current;

        const formattedNotes = Object.entries(state.noteSections)
            .map(([key, value]) => {
                const labels: Record<string, string> = {
                    motivo: 'Motivo de la consulta',
                    evolucion: 'Evolución desde la última sesión',
                    indicaciones: 'Indicaciones dadas',
                    acuerdos: 'Acuerdos / próximos pasos'
                };
                return `${labels[key] || key.toUpperCase()}:\n${value}`;
            })
            .join('\n\n---\n\n');

        const processedMetrics = Object.entries(state.metrics).reduce((acc, [key, value]) => {
            acc[key] = value === '' ? null : Number(value);
            return acc;
        }, {} as any);

        updateDraftMutation.mutate({
            appointmentId: appointment.id,
            data: {
                stage: state.view,
                notes: formattedNotes,
                metrics: { metric: processedMetrics },
                target_macros: {
                    calories: state.targetMacros.calories,
                    protein: state.targetMacros.proteins,
                    carbs: state.targetMacros.carbs,
                    fats: state.targetMacros.fats
                },
                json_state: {
                    stage: state.view,
                    noteSections: state.noteSections,
                    metrics: state.metrics,
                    targetMacros: state.targetMacros,
                    seconds: state.seconds
                }
            }
        });
    };

    // Timer Tick
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

    // Timer Sync (every 3 seconds when active)
    useEffect(() => {
        let interval: any = null;
        if (isActive && appointment?.id) {
            interval = setInterval(() => {
                saveDraft();
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isActive, appointment?.id]);

    // Warning when closing the window/tab
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isActive) {
                e.preventDefault();
                e.returnValue = ''; 
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

    const timerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleTimerMouseEnter = () => {
        if (timerTimeoutRef.current) {
            clearTimeout(timerTimeoutRef.current);
            timerTimeoutRef.current = null;
        }
        setIsTimerExpanded(true);
    };

    const handleTimerMouseLeave = () => {
        timerTimeoutRef.current = setTimeout(() => {
            setIsTimerExpanded(false);
        }, 3000);
    };

    if (!professionalId || isLoadingAppointments) {
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
                    <p className="text-gray-900 font-bold text-xl mb-4">Sesión no encontrada</p>
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
                <div className="w-full mx-auto flex items-center justify-between">
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
                        {/* Session Timer - Discreet & Collapsible */}
                        <div className="relative group/timer">
                            <motion.div 
                                layout
                                className={`flex items-center gap-3 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all cursor-pointer ${isTimerExpanded ? 'pr-2' : ''}`}
                                onClick={() => setIsTimerExpanded(!isTimerExpanded)}
                                onMouseEnter={handleTimerMouseEnter}
                                onMouseLeave={handleTimerMouseLeave}
                            >
                                <Clock className={`w-4 h-4 ${isActive ? 'text-nutrition-500 animate-pulse' : 'text-gray-400'}`} />
                                <span className={`font-mono font-bold tracking-tight text-gray-700 tabular-nums ${isTimerExpanded ? 'text-sm' : 'text-xs'}`}>
                                    {formatTime(seconds)}
                                </span>
                                
                                <AnimatePresence>
                                    {isTimerExpanded && (
                                        <motion.div
                                            initial={{ opacity: 0, width: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, width: 'auto', scale: 1 }}
                                            exit={{ opacity: 0, width: 0, scale: 0.8 }}
                                            className="flex items-center gap-1 ml-2 border-l border-gray-200 pl-2 overflow-hidden"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsActive(!isActive);
                                                }}
                                                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
                                                title={isActive ? "Pausar" : "Reanudar"}
                                            >
                                                {isActive ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowEndConfirmation(true);
                                                }}
                                                className="p-1.5 rounded-full hover:bg-red-50 text-red-500 transition-colors"
                                                title="Finalizar (Detener)"
                                            >
                                                <Square className="w-3.5 h-3.5 fill-current" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsTimerExpanded(false);
                                                }}
                                                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors ml-1"
                                                title="Ocultar controles"
                                            >
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>

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

            <main className="w-full mx-auto px-4 mt-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column - Client Info & Main Actions */}
                    <div className="lg:col-span-3 flex flex-col gap-6 h-[calc(100vh-140px)] sticky top-24 overflow-y-auto custom-scrollbar pr-2 pb-4">
                        <ConsultationHistorySidebar 
                            appointments={clientAppointments} 
                            currentAppointmentId={appointment?.id}
                            onViewHistory={() => setShowHistoryModal(true)}
                        />
                        <PatientSnapshotCard 
                            client={{
                                name: client?.name || 'Cargando...',
                                profile_picture: client?.profile_picture,
                                medical_conditions: hasConditions ? medicalConditions : undefined,
                                gender: clientHistory?.genre || client?.gender || client?.genre || null
                            }}
                            nextGoal={clientGoals}
                            latestMetrics={{
                                weight: clientHistory?.client_metrics?.[0]?.weight_kg ? Number(clientHistory.client_metrics[0].weight_kg) : undefined,
                                bodyFat: clientHistory?.client_metrics?.[0]?.body_fat_pct ? Number(clientHistory.client_metrics[0].body_fat_pct) : undefined,
                                muscleMass: clientHistory?.client_metrics?.[0]?.muscle_mass_kg ? Number(clientHistory.client_metrics[0].muscle_mass_kg) : undefined
                            }}
                            onOpenHistory={() => setShowHistoryModal(true)}
                            onOpenGoals={() => {}}
                        />

                        <ConsultationStepper 
                            currentStep={view as 'notes' | 'progress' | 'metrics' | 'planning'}
                            onStepChange={(step: 'notes' | 'progress' | 'metrics' | 'planning') => setView(step)}
                            progress={{
                                measurements: completedSteps.measurements || !!(metrics.weight || metrics.height), 
                                progress: completedSteps.progress,
                                notes: completedSteps.notes || Object.values(noteSections).some(val => val.length > 5),
                                plan: completedSteps.plan, 
                                history: historyViewed
                            }}
                        />
                    </div>

                    {/* Right Column - Notes & Plan */}
                    <div className="lg:col-span-9 flex flex-col gap-8">
                        {view === 'progress' && (
                             <motion.div
                                key="progress"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-6 flex flex-col min-h-[500px]"
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-nutrition-50 text-nutrition-600 rounded-xl">
                                            <Activity className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900">Progreso del Paciente</h3>
                                            <p className="text-xs text-gray-500 font-medium">Análisis de evolución histórica</p>
                                        </div>
                                    </div>
                                     <button
                                        onClick={handleNextStep}
                                        className="px-4 py-2 bg-nutrition-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-nutrition-200 hover:bg-nutrition-700 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        Siguiente Paso
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex-1">
                                    <ConsultationProgress clientHistory={clientHistory} />
                                </div>
                            </motion.div>
                        )}
                        {view === 'notes' && (
                            <motion.div
                                key="notes"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-6 flex flex-col"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-nutrition-50 text-nutrition-600 rounded-xl">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900">Notas de la Consulta</h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 font-medium italic">Se guarda automáticamente</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-6 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
                                    {(['motivo', 'evolucion', 'indicaciones', 'acuerdos'] as const).map((section) => {
                                        const labels = {
                                            motivo: 'Motivo de la consulta',
                                            evolucion: 'Evolución desde la última sesión',
                                            indicaciones: 'Indicaciones dadas',
                                            acuerdos: 'Acuerdos / próximos pasos'
                                        };

                                        return (
                                            <div key={section} className="flex flex-col gap-2">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => handleMicClick(section)}
                                                        disabled={isTranscribing || (isRecording && activeSection !== section)}
                                                        className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 font-bold shadow-sm active:scale-95 ${
                                                            isRecording && activeSection === section
                                                            ? 'bg-red-500 text-white ring-4 ring-red-100 hover:bg-red-600' 
                                                            : isTranscribing && activeSection === section
                                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                            : 'bg-nutrition-600 text-white hover:bg-nutrition-700 shadow-nutrition-200'
                                                        }`}
                                                        title={isRecording && activeSection === section ? 'Detener grabación' : 'Iniciar dictado'}
                                                    >
                                                        {isTranscribing && activeSection === section ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : isRecording && activeSection === section ? (
                                                            <Square className="w-4 h-4 fill-current" />
                                                        ) : (
                                                            <Mic className="w-4 h-4" />
                                                        )}
                                                        <span className="text-xs">
                                                            {isRecording && activeSection === section ? 'Detener' : 'Dictar'}
                                                        </span>
                                                    </button>
                                                    <label className="text-sm font-bold text-gray-700">
                                                        {labels[section]}
                                                    </label>
                                                </div>
                                                <textarea
                                                    value={noteSections[section]}
                                                    onChange={(e) => setNoteSections(prev => ({ ...prev, [section]: e.target.value }))}
                                                    placeholder={`Escribe ${labels[section].toLowerCase()}...`}
                                                    className="w-full h-32 bg-gray-50/50 rounded-2xl p-4 border border-transparent focus:border-nutrition-200 focus:bg-white focus:outline-none text-gray-700 leading-relaxed text-sm resize-none transition-all placeholder:text-gray-400"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-6 flex justify-end">
                                    <button
                                        onClick={handleNextStep}
                                        className="flex items-center gap-2 px-6 py-3 bg-nutrition-600 text-white rounded-2xl font-bold shadow-lg shadow-nutrition-200 hover:bg-nutrition-700 transition-all active:scale-95"
                                    >
                                        Siguiente: Planificación
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>

                        )}
                        
                        {view === 'metrics' && (
                            <motion.div
                                key="measurements"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex-1 bg-white rounded-[40px] shadow-sm border border-gray-100 p-8 flex flex-col"
                            >
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                                            <Activity className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900">Registro de Medidas</h3>
                                            <p className="text-sm text-gray-500">Ingresa los datos antropométricos del paciente</p>
                                        </div>
                                    </div>
                                    <button className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors">
                                        Ver Historial
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Peso (kg)</label>
                                        <input
                                            type="number"
                                            value={metrics.weight}
                                            onChange={(e) => setMetrics({ ...metrics, weight: e.target.value })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-blue-200 focus:bg-white outline-none transition-all font-bold text-gray-900"
                                            placeholder="0.0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Altura (cm)</label>
                                        <input
                                            type="number"
                                            value={metrics.height}
                                            onChange={(e) => setMetrics({ ...metrics, height: e.target.value })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-blue-200 focus:bg-white outline-none transition-all font-bold text-gray-900"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">% Grasa</label>
                                        <input
                                            type="number"
                                            value={metrics.body_fat_pct}
                                            onChange={(e) => setMetrics({ ...metrics, body_fat_pct: e.target.value })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-blue-200 focus:bg-white outline-none transition-all font-bold text-gray-900"
                                            placeholder="0.0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Masa Muscular (kg)</label>
                                        <input
                                            type="number"
                                            value={metrics.muscle_mass_kg}
                                            onChange={(e) => setMetrics({ ...metrics, muscle_mass_kg: e.target.value })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-blue-200 focus:bg-white outline-none transition-all font-bold text-gray-900"
                                            placeholder="0.0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Cintura (cm)</label>
                                        <input
                                            type="number"
                                            value={metrics.waist_cm}
                                            onChange={(e) => setMetrics({ ...metrics, waist_cm: e.target.value })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-blue-200 focus:bg-white outline-none transition-all font-bold text-gray-900"
                                            placeholder="0.0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Cadera (cm)</label>
                                        <input
                                            type="number"
                                            value={metrics.hip_cm}
                                            onChange={(e) => setMetrics({ ...metrics, hip_cm: e.target.value })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-blue-200 focus:bg-white outline-none transition-all font-bold text-gray-900"
                                            placeholder="0.0"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Grasa Visceral</label>
                                         <input
                                            type="number"
                                            value={metrics.visceral_fat}
                                            onChange={(e) => setMetrics({ ...metrics, visceral_fat: e.target.value })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-blue-200 focus:bg-white outline-none transition-all font-bold text-gray-900"
                                            placeholder="0.0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Agua (%)</label>
                                         <input
                                            type="number"
                                            value={metrics.water_pct}
                                            onChange={(e) => setMetrics({ ...metrics, water_pct: e.target.value })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-blue-200 focus:bg-white outline-none transition-all font-bold text-gray-900"
                                            placeholder="0.0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Pecho (cm)</label>
                                         <input
                                            type="number"
                                            value={metrics.chest_cm}
                                            onChange={(e) => setMetrics({ ...metrics, chest_cm: e.target.value })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-blue-200 focus:bg-white outline-none transition-all font-bold text-gray-900"
                                            placeholder="0.0"
                                        />
                                    </div>
                                </div>
                                
                                <div className="mb-4">
                                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Extremidades</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    {/* Arms */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Brazo Izquierdo (cm)</label>
                                         <input
                                            type="number"
                                            value={metrics.arm_left_cm}
                                            onChange={(e) => setMetrics({ ...metrics, arm_left_cm: e.target.value })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-blue-200 focus:bg-white outline-none transition-all font-bold text-gray-900"
                                            placeholder="0.0"
                                        />
                                    </div>
                                     <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Brazo Derecho (cm)</label>
                                         <input
                                            type="number"
                                            value={metrics.arm_right_cm}
                                            onChange={(e) => setMetrics({ ...metrics, arm_right_cm: e.target.value })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-blue-200 focus:bg-white outline-none transition-all font-bold text-gray-900"
                                            placeholder="0.0"
                                        />
                                    </div>

                                    {/* Thighs */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Muslo Izquierdo (cm)</label>
                                         <input
                                            type="number"
                                            value={metrics.thigh_left_cm}
                                            onChange={(e) => setMetrics({ ...metrics, thigh_left_cm: e.target.value })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-blue-200 focus:bg-white outline-none transition-all font-bold text-gray-900"
                                            placeholder="0.0"
                                        />
                                    </div>
                                     <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Muslo Derecho (cm)</label>
                                         <input
                                            type="number"
                                            value={metrics.thigh_right_cm}
                                            onChange={(e) => setMetrics({ ...metrics, thigh_right_cm: e.target.value })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-blue-200 focus:bg-white outline-none transition-all font-bold text-gray-900"
                                            placeholder="0.0"
                                        />
                                    </div>

                                     {/* Calves */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Pantorrilla Izquierda (cm)</label>
                                         <input
                                            type="number"
                                            value={metrics.calf_left_cm}
                                            onChange={(e) => setMetrics({ ...metrics, calf_left_cm: e.target.value })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-blue-200 focus:bg-white outline-none transition-all font-bold text-gray-900"
                                            placeholder="0.0"
                                        />
                                    </div>
                                     <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Pantorrilla Derecha (cm)</label>
                                         <input
                                            type="number"
                                            value={metrics.calf_right_cm}
                                            onChange={(e) => setMetrics({ ...metrics, calf_right_cm: e.target.value })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-blue-200 focus:bg-white outline-none transition-all font-bold text-gray-900"
                                            placeholder="0.0"
                                        />
                                    </div>
                                </div>
                                <div className="mt-auto flex justify-end gap-2">
                                    <button 
                                        onClick={handleSaveMetrics}
                                        disabled={saveMetricMutation.isPending}
                                        className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50"
                                    >
                                        {saveMetricMutation.isPending ? 'Guardando...' : 'Guardar Medidas'}
                                    </button>
                                    <button
                                        onClick={handleNextStep}
                                        className="px-6 py-3 bg-white border-2 border-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-50 hover:border-gray-200 transition-all flex items-center gap-2"
                                    >
                                        Siguiente
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        )}


                        {view === 'planning' && (
                            <motion.div
                                key="plan"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="bg-white rounded-[40px] shadow-sm border border-gray-100 p-8"
                            >
                                <TmbCalculator
                                    weight={Number(metrics.weight) || (clientHistory?.client_metrics?.[0]?.weight_kg ? Number(clientHistory.client_metrics[0].weight_kg) : 0)}
                                    height={Number(metrics.height) || (clientHistory?.client_metrics?.[0]?.height_cm ? Number(clientHistory.client_metrics[0].height_cm) : 0)}
                                    bodyFat={Number(metrics.body_fat_pct) || (clientHistory?.client_metrics?.[0]?.body_fat_pct ? Number(clientHistory.client_metrics[0].body_fat_pct) : 0)}
                                    gender={clientHistory?.genre || client?.gender || client?.genre || undefined}
                                    dateOfBirth={client?.date_of_birth}
                                    onTdeeChange={setCalculatedTdee}
                                />
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
                                        <Activity className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900">Ajustes del Próximo Plan</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                    <DatePicker
                                        label="Inicio del Plan"
                                        value={planStartDate}
                                        onChange={setPlanStartDate}
                                    />
                                    <DatePicker
                                        label="Fin del Plan"
                                        value={planEndDate}
                                        onChange={setPlanEndDate}
                                    />
                                    <div>
                                        <label className="text-[9px] font-bold text-gray-400 ml-1 uppercase block mb-1">Comidas al Día</label>
                                        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-2 h-[42px]">
                                            <button 
                                                onClick={() => setMealsPerDay(prev => Math.max(1, prev - 1))}
                                                className="w-8 h-full flex items-center justify-center text-gray-400 hover:text-nutrition-600 hover:bg-nutrition-50 rounded-lg transition-colors"
                                            >
                                                -
                                            </button>
                                            <span className="flex-1 text-center font-bold text-gray-700 text-sm">
                                                {mealsPerDay} comidas
                                            </span>
                                            <button 
                                                onClick={() => setMealsPerDay(prev => Math.min(8, prev + 1))}
                                                className="w-8 h-full flex items-center justify-center text-gray-400 hover:text-nutrition-600 hover:bg-nutrition-50 rounded-lg transition-colors"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                
                                {planStartDate && planEndDate && (
                                    <div className="mb-6 flex justify-end">
                                        <span className="text-xs font-bold text-nutrition-600 bg-nutrition-50 px-3 py-1 rounded-full border border-nutrition-100">
                                            Duración: {differenceInDays(new Date(planEndDate), new Date(planStartDate)) + 1} días
                                        </span>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div 
                                        className="p-4 rounded-3xl bg-gray-50 border border-transparent hover:border-gray-200 focus-within:border-nutrition-400 focus-within:ring-2 focus-within:ring-nutrition-100 transition-all group"
                                    >
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Proteínas</p>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-baseline gap-0.5">
                                                <input
                                                    type="number"
                                                    value={targetMacros.proteins}
                                                    onChange={(e) => handleMacroInputChange(e, 'proteins')}
                                                    onKeyDown={(e) => handleMacroKeyDown(e, 'proteins')}
                                                    className="text-2xl font-black text-gray-800 bg-transparent w-[4.5ch] text-right outline-none border-b-2 border-transparent focus:border-nutrition-500 transition-colors p-0 m-0 leading-none hover:border-gray-300 placeholder-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                />
                                                <span className="text-sm font-bold text-gray-400">g</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={(e) => { e.stopPropagation(); updateMacro('proteins', -5); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-nutrition-600 hover:border-nutrition-200 transition-all disabled:opacity-50 active:scale-95 text-lg font-bold">-</button>
                                                <button onClick={(e) => { e.stopPropagation(); updateMacro('proteins', 5); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-nutrition-600 hover:border-nutrition-200 transition-all disabled:opacity-50 active:scale-95 text-lg font-bold">+</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div 
                                        className="p-4 rounded-3xl bg-gray-50 border border-transparent hover:border-gray-200 focus-within:border-nutrition-400 focus-within:ring-2 focus-within:ring-nutrition-100 transition-all group"
                                    >
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Carbohidratos</p>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-baseline gap-0.5">
                                                <input
                                                    type="number"
                                                    value={targetMacros.carbs}
                                                    onChange={(e) => handleMacroInputChange(e, 'carbs')}
                                                    onKeyDown={(e) => handleMacroKeyDown(e, 'carbs')}
                                                    className="text-2xl font-black text-gray-800 bg-transparent w-[4.5ch] text-right outline-none border-b-2 border-transparent focus:border-nutrition-500 transition-colors p-0 m-0 leading-none hover:border-gray-300 placeholder-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                />
                                                <span className="text-sm font-bold text-gray-400">g</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={(e) => { e.stopPropagation(); updateMacro('carbs', -5); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-nutrition-600 hover:border-nutrition-200 transition-all disabled:opacity-50 active:scale-95 text-lg font-bold">-</button>
                                                <button onClick={(e) => { e.stopPropagation(); updateMacro('carbs', 5); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-nutrition-600 hover:border-nutrition-200 transition-all disabled:opacity-50 active:scale-95 text-lg font-bold">+</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div 
                                        className="p-4 rounded-3xl bg-gray-50 border border-transparent hover:border-gray-200 focus-within:border-nutrition-400 focus-within:ring-2 focus-within:ring-nutrition-100 transition-all group"
                                    >
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Grasas</p>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-baseline gap-0.5">
                                                <input
                                                    type="number"
                                                    value={targetMacros.fats}
                                                    onChange={(e) => handleMacroInputChange(e, 'fats')}
                                                    onKeyDown={(e) => handleMacroKeyDown(e, 'fats')}
                                                    className="text-2xl font-black text-gray-800 bg-transparent w-[4.5ch] text-right outline-none border-b-2 border-transparent focus:border-nutrition-500 transition-colors p-0 m-0 leading-none hover:border-gray-300 placeholder-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                />
                                                <span className="text-sm font-bold text-gray-400">g</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={(e) => { e.stopPropagation(); updateMacro('fats', -5); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-nutrition-600 hover:border-nutrition-200 transition-all disabled:opacity-50 active:scale-95 text-lg font-bold">-</button>
                                                <button onClick={(e) => { e.stopPropagation(); updateMacro('fats', 5); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-nutrition-600 hover:border-nutrition-200 transition-all disabled:opacity-50 active:scale-95 text-lg font-bold">+</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                    <div className="mt-4 p-4 rounded-3xl bg-nutrition-50 border border-nutrition-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Zap className="w-5 h-5 text-nutrition-600" />
                                            <div className="flex flex-col">
                                                <span className="font-bold text-nutrition-800">Objetivo Calórico</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-2xl font-black text-nutrition-700">{targetMacros.calories} kcal</span>
                                            <div className="flex flex-col items-end gap-1">
                                                <p className="text-[10px] text-nutrition-500 font-medium">
                                                    TDEE: {calculatedTdee}
                                                </p>
                                                {activeGoal && (
                                                    <div className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                                                        (activeGoal.goals.adjustment_value || 0) > 0 
                                                        ? 'bg-blue-100 text-blue-700' 
                                                        : 'bg-orange-100 text-orange-700'
                                                    }`}>
                                                        <span>{activeGoal.goals.name}:</span>
                                                        <span>
                                                            {(activeGoal.goals.adjustment_value || 0) > 0 ? '+' : ''}
                                                            {activeGoal.goals.adjustment_value}
                                                            {activeGoal.goals.adjustment_type === 'percent' ? '%' : ' kcal'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
    
                                    {/* Calculation Explanation */}
                                    {calculatedTdee > 0 && (
                                        <div className="mt-4 p-4 rounded-3xl bg-gray-50 border border-gray-100 text-xs text-gray-500 space-y-2">
                                            <div className="flex justify-between">
                                                <span>Mantenimiento (TDEE):</span>
                                                <span className="font-bold">{calculatedTdee} kcal</span>
                                            </div>
                                            
                                            {activeGoal ? (
                                                <>
                                                    <div className="flex justify-between items-center">
                                                        <span>Ajuste por Objetivo ({activeGoal.goals.name}):</span>
                                                        <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                                                            (activeGoal.goals.adjustment_value || 0) > 0 
                                                            ? 'bg-blue-100 text-blue-700' 
                                                            : 'bg-orange-100 text-orange-700'
                                                        }`}>
                                                            {(activeGoal.goals.adjustment_value || 0) > 0 ? '+' : ''}
                                                            {activeGoal.goals.adjustment_value}
                                                            {activeGoal.goals.adjustment_type === 'percent' ? '%' : ' kcal'}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="bg-white/50 p-2 rounded-lg border border-gray-100 mt-1">
                                                        <p className="text-[10px] leading-relaxed text-gray-500">
                                                            Según el objetivo <span className="font-bold text-gray-700">{activeGoal.goals.name}</span>, 
                                                            se aplicó un {(activeGoal.goals.adjustment_value || 0) > 0 ? 'aumento' : 'descuento'} del
                                                            <span className="font-bold mx-1">
                                                                {Math.abs(activeGoal.goals.adjustment_value || 0)}
                                                                {activeGoal.goals.adjustment_type === 'percent' ? '%' : ' kcal'}
                                                            </span>
                                                            sobre tu TDEE para alinear tu plan nutricional.
                                                        </p>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-center py-2 text-gray-400 italic">
                                                    No hay objetivo seleccionado
                                                </div>
                                            )}
    
                                            <div className="pt-2 border-t border-gray-200 flex justify-between text-gray-700">
                                                <span className="font-bold">Total Objetivo:</span>
                                                <span className="font-black">{targetMacros.calories} kcal</span>
                                            </div>
                                        </div>
                                    )}
                                <div className="mt-8 flex justify-end">
                                    <button
                                        onClick={() => setShowEndConfirmation(true)}
                                        className="flex items-center gap-2 px-6 py-3 bg-nutrition-600 text-white rounded-2xl font-bold shadow-lg shadow-nutrition-200 hover:bg-nutrition-700 transition-all active:scale-95"
                                    >
                                        <Save className="w-4 h-4" />
                                        Guardar
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </main>

            {/* Custom Confirmation Modal */}
            <AnimatePresence>
                {showEndConfirmation && (
                    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
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
                                        finishConsultationMutation.mutate({ 
                                            id: Number(appointment.id), 
                                            durationSeconds: seconds,
                                            notes: Object.entries(noteSections)
                                                .map(([key, value]) => `${key.toUpperCase()}: ${value}`)
                                                .join('\n\n')
                                        });
                                        setShowEndConfirmation(false);
                                    }}
                                    className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-bold shadow-lg shadow-red-200 hover:bg-red-600 transition-colors"
                                >
                                    Finalizar
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Client History (Expediente) Modal */}
            <Modal
                isOpen={showHistoryModal}
                onClose={() => setShowHistoryModal(false)}
                title="Expediente del Paciente"
                panelClassName="!max-w-[70vw]"
            >
                <div className="h-[70vh] overflow-y-auto custom-scrollbar p-1">
                     <ClientHistoryPanel clientId={Number(appointment.client_id)} />
                </div>
            </Modal>

            {/* Previous Sessions Modal */}
             <Modal
                isOpen={!!selectedAppointmentDate}
                onClose={() => setSelectedAppointmentDate(null)}
                title="Historial de Sesiones"
                size="lg"
            >
                <div>
                   <div className="p-1">
                        <div className="flex gap-2 mb-6 bg-gray-50 p-1 rounded-xl">
                            <button
                                onClick={() => setModalTab('history')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${
                                    modalTab === 'history' 
                                    ? 'bg-white text-gray-800 shadow-sm' 
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                Sesiones Anteriores
                            </button>
                            <button
                                onClick={() => setModalTab('upcoming')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${
                                    modalTab === 'upcoming' 
                                    ? 'bg-white text-blue-600 shadow-sm' 
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                Próximas Citas
                            </button>
                        </div>

                        {modalTab === 'history' ? (
                            pastAppointments.length > 0 ? (
                                <div className="space-y-4">
                                    {pastAppointments.map((apt) => (
                                        <div key={apt.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-gray-900">
                                                    {format(new Date(apt.scheduled_at), "EEEE d 'de' MMMM, yyyy", { locale: es })}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {format(new Date(apt.scheduled_at), "h:mm a")} • {apt.duration_minutes} min
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                                                    apt.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                                                    apt.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {apt.status === 'completed' ? 'Completada' : apt.status === 'cancelled' ? 'Cancelada' : 'Pendiente'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                 <div className="text-center py-8">
                                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                                        <Clock className="w-6 h-6" />
                                    </div>
                                    <p className="text-gray-500 font-medium">No hay sesiones anteriores</p>
                                    <p className="text-xs text-gray-400">Esta es la primera sesión registrada</p>
                                </div>
                            )
                        ) : (
                            upcomingAppointments.length > 0 ? (
                                <div className="space-y-4">
                                    {upcomingAppointments.map((apt) => (
                                        <div key={apt.id} className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-gray-900">
                                                    {format(new Date(apt.scheduled_at), "EEEE d 'de' MMMM, yyyy", { locale: es })}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {format(new Date(apt.scheduled_at), "h:mm a")} • {apt.duration_minutes} min
                                                </p>
                                                <div className="flex gap-2 mt-2">
                                                    <span className="text-[10px] bg-white border border-blue-100 text-blue-600 px-2 py-0.5 rounded-md font-bold uppercase tracking-wide">
                                                        Próximamente
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-blue-500 shadow-sm border border-blue-100">
                                                    <Calendar className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                                        <Calendar className="w-6 h-6" />
                                    </div>
                                    <p className="text-gray-500 font-medium">No hay próximas sesiones</p>
                                    <p className="text-xs text-gray-400">Agenda una nueva cita para verla aquí</p>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
}
