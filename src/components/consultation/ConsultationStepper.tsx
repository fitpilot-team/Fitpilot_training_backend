
import React from 'react';
import { CheckCircle2, FileText, Activity, ChevronRight, Target, TrendingUp } from 'lucide-react';

interface ConsultationStepperProps {
    currentStep: 'metrics' | 'progress' | 'notes' | 'planning';
    onStepChange: (step: 'metrics' | 'progress' | 'notes' | 'planning') => void;
    progress: {
        measurements: boolean;
        progress: boolean;
        notes: boolean;
        plan: boolean;
        history?: boolean;
    };
}

export const ConsultationStepper: React.FC<ConsultationStepperProps> = ({
    currentStep,
    onStepChange,
    progress
}) => {
    const steps = [
        {
            id: 'metrics' as const,
            label: 'Biometría',
            subLabel: 'Medidas corporales',
            icon: Activity,
            isCompleted: progress.measurements
        },
        {
            id: 'progress' as const,
            label: 'Progreso',
            subLabel: 'Evolución gráfica',
            icon: TrendingUp,
            isCompleted: progress.progress
        },
        {
            id: 'notes' as const,
            label: 'Evolución',
            subLabel: 'Notas clínicas',
            icon: FileText,
            isCompleted: progress.notes
        },
        {
            id: 'planning' as const,
            label: 'Planificación',
            subLabel: 'Metas prox. semana',
            icon: Target,
            isCompleted: progress.plan
        }
    ];

    // Calculate total progress
    const completedCount = steps.filter(s => s.isCompleted).length;
    const progressPercentage = (completedCount / steps.length) * 100;

    return (
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col shrink-0">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-gray-900">Flujo de Consulta</h3>
                <span className="text-xs font-bold text-nutrition-600 bg-nutrition-50 px-2 py-1 rounded-lg">
                    {Math.round(progressPercentage)}%
                </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1 bg-gray-100 rounded-full mb-8">
                <div 
                    className="h-full bg-nutrition-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercentage}%` }}
                />
            </div>

            <div className="space-y-3 relative">
                {/* Vertical Line */}
                <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gray-100 z-0" />

                {steps.map((step) => {
                    const isActive = currentStep === step.id;
                    const isCompleted = step.isCompleted;
                    const Icon = step.icon;

                    return (
                        <div 
                            key={step.id}
                            onClick={() => onStepChange(step.id)}
                            className={`relative z-10 flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all duration-300 group ${
                                isActive 
                                ? 'bg-white shadow-lg shadow-gray-100 border border-gray-100 scale-105' 
                                : 'hover:bg-gray-50/50 border border-transparent'
                            }`}
                        >
                            {/* Circle Indicator */}
                            <div className={`
                                w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-300
                                ${isActive 
                                    ? 'bg-nutrition-600 border-nutrition-600 text-white shadow-md' 
                                    : isCompleted
                                    ? 'bg-emerald-100 border-emerald-100 text-emerald-600'
                                    : 'bg-white border-gray-200 text-gray-400 group-hover:border-gray-300'
                                }
                            `}>
                                {isCompleted && !isActive ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                    <Icon className="w-4 h-4" />
                                )}
                            </div>

                            <div className="flex-1">
                                <p className={`text-sm font-bold transition-colors ${
                                    isActive ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'
                                }`}>
                                    {step.label}
                                </p>
                                <p className={`text-[10px] font-medium transition-colors ${
                                    isActive ? 'text-nutrition-600' : 'text-gray-400'
                                }`}>
                                    {step.subLabel}
                                </p>
                            </div>

                            {isActive && (
                                <div className="text-nutrition-600">
                                    <ChevronRight className="w-4 h-4" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
