
import React from 'react';
import { User, Target, AlertCircle, FileText } from 'lucide-react';

interface PatientSnapshotCardProps {
    client: {
        name: string;
        profile_picture?: string;
        medical_conditions?: string;
        gender?: string | null;
    } | null;
    nextGoal: string;
    latestMetrics?: {
        weight?: number;
        bodyFat?: number;
        muscleMass?: number;
    };
    onOpenHistory: () => void;
    onOpenGoals: () => void;
}

export const PatientSnapshotCard: React.FC<PatientSnapshotCardProps> = ({
    client,
    nextGoal,
    latestMetrics,
    onOpenHistory,
    onOpenGoals
}) => {
    return (
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center relative overflow-hidden shrink-0">
             {/* Background Decoration */}
             <div className="absolute top-0 left-0 w-full h-20 bg-linear-to-b from-gray-50 to-transparent z-0" />

            <div className="relative z-10 mb-3">
                <div className="relative">
                    <img
                        src={client?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(client?.name || 'U')}&background=random&size=128`}
                        alt={client?.name}
                        className="w-24 h-24 rounded-3xl object-cover shadow-lg shadow-gray-200 border-4 border-white"
                    />
                    <div className="absolute -bottom-2 -right-2 bg-white p-1.5 rounded-xl shadow-md border border-gray-100">
                        <div className="bg-nutrition-100 text-nutrition-600 p-1 rounded-lg">
                            <User className="w-3.5 h-3.5" />
                        </div>
                    </div>
                </div>
            </div>

            <h2 className="text-xl font-black text-gray-900 leading-tight mb-0.5 relative z-10">
                {client?.name || 'Cargando...'}
            </h2>
            <div className="flex items-center gap-2 justify-center mb-4 relative z-10">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Nutrición
                </p>
                {client?.gender && (
                    <>
                        <span className="text-gray-300">•</span>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                            {['M', 'Male', 'Masculino', 'man', 'hombre'].includes(client.gender) ? 'Masculino' : 
                             ['F', 'Female', 'Femenino', 'woman', 'mujer'].includes(client.gender) ? 'Femenino' : 
                             client.gender}
                        </p>
                    </>
                )}
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 w-full mb-4">
                <div className="bg-gray-50 rounded-2xl p-2 flex flex-col items-center justify-center border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Peso</span>
                    <span className="text-sm font-black text-gray-800">
                        {latestMetrics?.weight ? `${latestMetrics.weight}kg` : '-'}
                    </span>
                </div>
                <div className="bg-gray-50 rounded-2xl p-2 flex flex-col items-center justify-center border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">% Grasa</span>
                    <span className="text-sm font-black text-gray-800">
                        {latestMetrics?.bodyFat ? `${latestMetrics.bodyFat}%` : '-'}
                    </span>
                </div>
                <div className="bg-gray-50 rounded-2xl p-2 flex flex-col items-center justify-center border border-gray-100">
                     <span className="text-[10px] font-bold text-gray-400 uppercase">Musc.</span>
                    <span className="text-sm font-black text-gray-800">
                        {latestMetrics?.muscleMass ? `${latestMetrics.muscleMass}kg` : '-'}
                    </span>
                </div>
            </div>

            {/* Actions / Context */}
            <div className="flex gap-2 w-full">
                <button 
                    onClick={onOpenHistory}
                    className="flex-1 bg-white border border-gray-100 hover:border-nutrition-200 hover:shadow-md hover:shadow-nutrition-100/50 rounded-2xl p-2.5 flex flex-col items-center gap-1 transition-all group"
                >
                    <FileText className="w-4 h-4 text-gray-400 group-hover:text-nutrition-500 transition-colors" />
                    <span className="text-[10px] font-bold text-gray-600 group-hover:text-nutrition-700">
                        Expediente
                    </span>
                </button>
                <button 
                    onClick={onOpenGoals}
                    className="flex-1 bg-white border border-gray-100 hover:border-blue-200 hover:shadow-md hover:shadow-blue-100/50 rounded-2xl p-2.5 flex flex-col items-center gap-1 transition-all group"
                    title={nextGoal}
                >
                    <Target className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    <span className="text-[10px] font-bold text-gray-600 group-hover:text-blue-700 truncate w-full">
                        Objetivo
                    </span>
                </button>
            </div>

            {/* Medical Warning */}
            {client?.medical_conditions && (
                <div className="w-full mt-3 bg-red-50/50 border border-red-100 rounded-2xl p-3 flex items-center gap-3">
                    <div className="p-1.5 bg-red-100 text-red-600 rounded-lg shrink-0">
                        <AlertCircle className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-left overflow-hidden">
                        <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest leading-none mb-0.5">
                            Alerta Médica
                        </p>
                        <p className="text-xs font-bold text-gray-800 line-clamp-3">
                            {client.medical_conditions}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
