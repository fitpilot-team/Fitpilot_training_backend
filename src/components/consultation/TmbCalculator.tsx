import React, { useState, useEffect } from 'react';
import { Calculator, Zap, Activity, Info } from 'lucide-react';
import { differenceInYears } from 'date-fns';

interface TmbCalculatorProps {
    weight?: number;
    height?: number;
    bodyFat?: number;
    gender?: string; // Expecting 'man', 'woman', 'M', 'F', etc.
    dateOfBirth?: string | null;
    onTdeeChange?: (tdee: number) => void;
}

type Formula = 'MIFFLIN' | 'HARRIS' | 'KATCH';

export const TmbCalculator: React.FC<TmbCalculatorProps> = ({
    weight = 0,
    height = 0,
    bodyFat,
    gender,
    dateOfBirth,
    onTdeeChange
}) => {
    const [age, setAge] = useState<number | ''>('');
    const [selectedFormula, setSelectedFormula] = useState<Formula>('MIFFLIN');
    
    // New State for Advanced TDEE
    const [jobType, setJobType] = useState<'SEDENTARY' | 'LIGHT' | 'ACTIVE' | 'VERY_ACTIVE'>('SEDENTARY');
    const [exerciseHours, setExerciseHours] = useState<number>(0);
    
    const [tmb, setTmb] = useState<number>(0);
    const [tdee, setTdee] = useState<number>(0);

    // Normalize gender
    const isMale = ['man', 'hombre', 'm', 'male', 'masculino'].includes(gender?.toLowerCase() || '');

    useEffect(() => {
        if (dateOfBirth) {
            const calculatedAge = differenceInYears(new Date(), new Date(dateOfBirth));
            setAge(calculatedAge);
        }
    }, [dateOfBirth]);

    useEffect(() => {
        calculateTmb();
    }, [weight, height, age, bodyFat, isMale, selectedFormula]);

    useEffect(() => {
        calculateTdee();
    }, [tmb, jobType, exerciseHours]);

    useEffect(() => {
        if (onTdeeChange) {
            onTdeeChange(tdee);
        }
    }, [tdee, onTdeeChange]);

    const calculateTmb = () => {
        if (!weight || !height || (selectedFormula !== 'KATCH' && !age)) {
            setTmb(0);
            return;
        }

        let calculatedTmb = 0;
        const infoAge = Number(age);

        switch (selectedFormula) {
            case 'MIFFLIN':
                // Mifflin-St Jeor
                // Men: (10 × weight) + (6.25 × height) - (5 × age) + 5
                // Women: (10 × weight) + (6.25 × height) - (5 × age) - 161
                calculatedTmb = (10 * weight) + (6.25 * height) - (5 * infoAge) + (isMale ? 5 : -161);
                break;
            case 'HARRIS':
                // Harris-Benedict (Revised)
                // Men: 88.36 + (13.4 × weight) + (4.8 × height) - (5.7 × age)
                // Women: 447.6 + (9.2 × weight) + (3.1 × height) - (4.3 × age)
                if (isMale) {
                    calculatedTmb = 88.36 + (13.4 * weight) + (4.8 * height) - (5.7 * infoAge);
                } else {
                    calculatedTmb = 447.6 + (9.2 * weight) + (3.1 * height) - (4.3 * infoAge);
                }
                break;
            case 'KATCH':
                // Katch-McArdle
                // 370 + (21.6 × Lean Body Mass)
                // LBM = weight - (weight * (bodyFat / 100))
                if (bodyFat) {
                    const lbm = weight - (weight * (bodyFat / 100));
                    calculatedTmb = 370 + (21.6 * lbm);
                }
                break;
        }

        setTmb(Math.round(calculatedTmb));
    };

    const calculateTdee = () => {
        // NEAT (Non-Exercise Activity Thermogenesis) - Job/Daily Activity
        let neatMultiplier = 0.15; // Sedentary default
        if (jobType === 'LIGHT') neatMultiplier = 0.25;
        if (jobType === 'ACTIVE') neatMultiplier = 0.40;
        if (jobType === 'VERY_ACTIVE') neatMultiplier = 0.50;

        const neat = tmb * neatMultiplier;

        // EAT (Exercise Activity Thermogenesis) - Weekly Exercise
        // Est. 400 kcal per hour of moderate/intense exercise
        // Daily EAT = (Hours * 400) / 7
        const eat = (exerciseHours * 400) / 7;

        // TEF (Thermic Effect of Food) ~ 10% of Total
        // TDEE = TMB + NEAT + EAT + TEF
        // TDEE = TMB + NEAT + EAT + 0.10*TDEE
        // 0.9 * TDEE = TMB + NEAT + EAT
        // TDEE = (TMB + NEAT + EAT) / 0.9

        const totalTdee = (tmb + neat + eat) / 0.9;

        setTdee(Math.round(totalTdee));
    };

    return (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <Calculator className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Calculadora Energética</h3>
                    <p className="text-sm text-gray-500">
                        {isMale ? 'Masculino' : 'Femenino'} • {weight}kg • {height}cm • {age ? `${age} años` : 'Edad no definida'} {bodyFat ? `• ${bodyFat}% min grasa` : ''}
                    </p>
                    <div className="flex gap-2 mt-2">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">Peso: {weight}kg</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">Altura: {height}cm</span>
                         <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">Edad: {age ? age : '-'}</span>
                         {!!bodyFat && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">Grasa: {bodyFat}%</span>}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Inputs Section */}
                <div className="space-y-6">
                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-2">Edad del Paciente</label>
                        <input
                            type="number"
                            value={age}
                            onChange={(e) => setAge(Number(e.target.value) || '')}
                            placeholder="Ej. 30"
                            className="w-full p-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-gray-900"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-2">Fórmula TMB</label>
                        <div className="grid grid-cols-1 gap-2">
                            <button
                                onClick={() => setSelectedFormula('MIFFLIN')}
                                className={`p-3 rounded-xl text-left border transition-all flex items-center justify-between ${
                                    selectedFormula === 'MIFFLIN' 
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-1 ring-indigo-200' 
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                <span className="font-bold text-sm">Mifflin-St Jeor</span>
                                {selectedFormula === 'MIFFLIN' && <Zap className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={() => setSelectedFormula('HARRIS')}
                                className={`p-3 rounded-xl text-left border transition-all flex items-center justify-between ${
                                    selectedFormula === 'HARRIS' 
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-1 ring-indigo-200' 
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                <span className="font-bold text-sm">Harris-Benedict</span>
                                {selectedFormula === 'HARRIS' && <Zap className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={() => setSelectedFormula('KATCH')}
                                disabled={!bodyFat}
                                className={`p-3 rounded-xl text-left border transition-all flex items-center justify-between ${
                                    selectedFormula === 'KATCH' 
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-1 ring-indigo-200' 
                                    : !bodyFat ? 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed' 
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm">Katch-McArdle</span>
                                    {!bodyFat && <span className="text-[10px]">Requiere % Grasa</span>}
                                </div>
                                {selectedFormula === 'KATCH' && <Zap className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* New Inputs for Advanced TDEE */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-sm font-bold text-gray-700 block mb-2">Tipo de Trabajo (NEAT)</label>
                            <select
                                value={jobType}
                                onChange={(e) => setJobType(e.target.value as any)}
                                className="w-full p-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-indigo-500 outline-none text-sm font-medium text-gray-700"
                            >
                                <option value="SEDENTARY">Sedentario (Oficina/Sentado)</option>
                                <option value="LIGHT">Poco Activo (De pie/Ventas)</option>
                                <option value="ACTIVE">Activo (Caminar/Mesero)</option>
                                <option value="VERY_ACTIVE">Muy Activo (Construcción)</option>
                            </select>
                        </div>
                        <div className="flex-1">
                             <label className="text-sm font-bold text-gray-700 block mb-2">Ejercicio Semanal (EAT)</label>
                             <select
                                value={exerciseHours}
                                onChange={(e) => setExerciseHours(Number(e.target.value))}
                                className="w-full p-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-indigo-500 outline-none text-sm font-medium text-gray-700"
                            >
                                <option value={0}>0 horas</option>
                                <option value={1}>1 hora</option>
                                <option value={2}>2 horas</option>
                                <option value={3}>3 horas</option>
                                <option value={4}>4 horas</option>
                                <option value={5}>5 horas</option>
                                <option value={6}>6 horas</option>
                                <option value={7}>7+ horas</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Results Section */}
                <div className="bg-gray-900 rounded-3xl p-6 text-white flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Activity className="w-48 h-48" />
                    </div>

                    <div className="space-y-8 relative z-10">
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-gray-400">
                                <span className="text-xs font-bold uppercase tracking-widest">Metabolismo Basal (TMB)</span>
                                <Info className="w-3.5 h-3.5" />
                            </div>
                            <div className="text-4xl font-black tracking-tight">
                                {tmb > 0 ? tmb.toLocaleString() : '---'}
                                <span className="text-lg text-gray-500 font-bold ml-1">kcal</span>
                            </div>
                        </div>

                        <div className="h-px bg-gray-800" />

                        <div>
                            <div className="flex items-center gap-2 mb-2 text-indigo-400">
                                <span className="text-xs font-bold uppercase tracking-widest">Gasto Total (TDEE)</span>
                                <Zap className="w-3.5 h-3.5" />
                            </div>
                            <div className="text-5xl font-black tracking-tight text-white">
                                {tdee > 0 ? tdee.toLocaleString() : '---'}
                                <span className="text-lg text-gray-500 font-bold ml-1">kcal</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-2 font-medium">
                                TMB + NEAT (Trabajo) + EAT (Ejercicio) + TEF (Digestión)
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
