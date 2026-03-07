import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import { BodyMap } from './BodyMap';
import { CardioChart } from './CardioChart';
import type { TrainingDay, Exercise } from '../../types';
import {
  calculateMicrocycleMetrics,
  calculateMicrocycleCardioMetrics,
  getStressIndexColor,
  getStressIndexLabel,
  getVolumeLevel,
  getVolumeLevelRP,
  getVolumeLevelColorRP,
  VOLUME_THRESHOLDS,
  RP_VOLUME_LANDMARKS,
  type MicrocycleMetrics,
  type VolumeCalculationOptions,
} from '../../utils/metricsCalculations';

interface MicrocycleChartsProps {
  weekNumber: number;
  trainingDays: TrainingDay[];
  exercises?: Exercise[];
}

export function MicrocycleCharts({ weekNumber, trainingDays, exercises }: MicrocycleChartsProps) {
  const { t } = useTranslation();

  // Toggle state for counting secondary muscles
  const [countSecondaryMuscles, setCountSecondaryMuscles] = useState(true);

  // Memoize calculation options
  const calculationOptions: VolumeCalculationOptions = useMemo(() => ({
    countSecondaryMuscles,
  }), [countSecondaryMuscles]);

  // Calculate metrics with options
  const metrics: MicrocycleMetrics = useMemo(() =>
    calculateMicrocycleMetrics(weekNumber, trainingDays, exercises, calculationOptions),
    [weekNumber, trainingDays, exercises, calculationOptions]
  );

  // Data for Effective Sets by Muscle Group chart (RP Volume Landmarks)
  const setsBarData = useMemo(() => metrics.volumeByMuscleGroup.map((item) => {
    const level = getVolumeLevelRP(item.muscleGroup, item.effectiveSets);
    const landmarks = RP_VOLUME_LANDMARKS[item.muscleGroup] || { mv: 0, mev: 6, mav: [10, 20], mrv: 25 };
    return {
      name: item.label,
      muscleGroup: item.muscleGroup,
      effectiveSets: item.effectiveSets,
      totalSets: item.totalSets,
      color: getVolumeLevelColorRP(level),
      mv: landmarks.mv,
      mev: landmarks.mev,
      mavLow: landmarks.mav[0],
      mavHigh: landmarks.mav[1],
      mrv: landmarks.mrv,
    };
  }), [metrics.volumeByMuscleGroup]);

  // Data for Effective Reps by Muscle Group chart (Beardsley theory)
  const repsBarData = useMemo(() => metrics.volumeByMuscleGroup.map((item) => {
    const thresholds = VOLUME_THRESHOLDS[item.muscleGroup] || { low: 40, high: 80 };
    const level = getVolumeLevel(item.muscleGroup, item.effectiveReps);
    return {
      name: item.label,
      muscleGroup: item.muscleGroup,
      effectiveReps: item.effectiveReps,
      totalSets: item.totalSets,
      color: getVolumeLevelColorRP(getVolumeLevelRP(item.muscleGroup, item.totalSets)),
      minOptimal: thresholds.low,
      maxOptimal: thresholds.high,
      level, // Include for potential tooltip use
    };
  }), [metrics.volumeByMuscleGroup]);

  // Data for Cardio Summary chart
  const cardioMetrics = calculateMicrocycleCardioMetrics(trainingDays);

  const hasData = trainingDays.length > 0 && metrics.totalEffectiveReps > 0;

  if (!hasData) {
    return (
      <Card className="bg-gray-50">
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">Add exercises to the microcycle to see metrics</p>
        </div>
      </Card>
    );
  }

  // Calculate max for Y axis of sets chart (using MRV as upper limit)
  const maxSets = Math.max(
    ...setsBarData.map((d) => Math.max(d.effectiveSets, d.mrv)),
    25
  );

  // Calculate max for Y axis of reps chart
  const maxReps = Math.max(
    ...repsBarData.map((d) => Math.max(d.effectiveReps, d.maxOptimal)),
    125
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
      {/* Metrics Summary */}
      <Card className="lg:col-span-2">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-700">{t('metrics.title', 'Microcycle Metrics')}</h4>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={countSecondaryMuscles}
                onChange={(e) => setCountSecondaryMuscles(e.target.checked)}
                className="rounded text-primary-600 focus:ring-primary-500 h-3.5 w-3.5"
              />
              {t('metrics.countSecondaryMuscles', 'Count secondary muscles (0.5x)')}
            </label>
            <span className="text-xs text-gray-500">{t('metrics.week', 'Week')} {weekNumber}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{metrics.totalEffectiveReps}</p>
            <p className="text-xs text-gray-600">Effective Reps</p>
            <span className="text-xs text-gray-400">from {metrics.totalSets} sets</span>
          </div>
          <div className="text-center p-2 bg-orange-50 rounded-lg">
            <p className="text-2xl font-bold" style={{ color: getStressIndexColor(metrics.averageStressIndex) }}>
              {metrics.averageStressIndex}
            </p>
            <p className="text-xs text-gray-600">Stress Index</p>
            <span className="text-xs" style={{ color: getStressIndexColor(metrics.averageStressIndex) }}>
              ({getStressIndexLabel(metrics.averageStressIndex)})
            </span>
          </div>
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{metrics.trainingDays}</p>
            <p className="text-xs text-gray-600">Training Days</p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-600">{metrics.restDays}</p>
            <p className="text-xs text-gray-600">Rest Days</p>
          </div>
        </div>
      </Card>

      {/* Body Map - Stress Index (Tuchscherer) */}
      <Card>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Muscle Stress Map</h4>
        <BodyMap volumeByMuscleGroup={metrics.volumeByMuscleGroup} />
      </Card>

      {/* Effective Sets by Muscle Group Chart (Traditional method) */}
      <Card>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Effective Sets by Muscle Group</h4>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={setsBarData}
              margin={{ top: 5, right: 5, left: -20, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                domain={[0, maxSets]}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value: number, name: string, props) => {
                  if (name === 'effectiveSets' && props?.payload) {
                    const payload = props.payload as typeof setsBarData[0];
                    return [
                      `${value} sets | MV:${payload.mv} MEV:${payload.mev} MAV:${payload.mavLow}-${payload.mavHigh} MRV:${payload.mrv}`,
                      'RP Volume',
                    ];
                  }
                  return [value, name];
                }}
              />
              <Bar
                dataKey="effectiveSets"
                radius={[4, 4, 0, 0]}
                barSize={10}
              >
                {setsBarData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-1">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f59e0b' }}></div>
            <span className="text-xs text-gray-500">&lt;MEV</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#84cc16' }}></div>
            <span className="text-xs text-gray-500">&lt;MAV</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }}></div>
            <span className="text-xs text-gray-500">MAV</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f97316' }}></div>
            <span className="text-xs text-gray-500">&gt;MAV</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
            <span className="text-xs text-gray-500">&gt;MRV</span>
          </div>
        </div>
      </Card>

      {/* Effective Reps by Muscle Group Chart (Beardsley theory) */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <h4 className="text-sm font-semibold text-gray-700">Effective Reps by Muscle Group</h4>
          <div className="relative group">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 text-gray-400 cursor-help"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="absolute hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg p-3 w-64 -left-28 top-6 z-20 shadow-lg">
              <strong className="block mb-1">Beardsley Theory</strong>
              <p className="text-gray-300 mb-2">
                Only the last reps near muscular failure generate enough stimulus for hypertrophy.
              </p>
              <ul className="text-gray-300 space-y-0.5">
                <li>• RIR 0-1: 5 effective reps/set</li>
                <li>• RIR 2: 4 effective reps/set</li>
                <li>• RIR 3: 3 effective reps/set</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={repsBarData}
              margin={{ top: 5, right: 5, left: -20, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                domain={[0, maxReps]}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value: number, name: string, props) => {
                  if (name === 'effectiveReps' && props?.payload) {
                    const payload = props.payload as typeof repsBarData[0];
                    return [
                      `${value} reps (optimal: ${payload.minOptimal}-${payload.maxOptimal})`,
                      'Effective Reps',
                    ];
                  }
                  return [value, name];
                }}
              />
              <Bar
                dataKey="effectiveReps"
                radius={[4, 4, 0, 0]}
                barSize={10}
              >
                {repsBarData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-1">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs text-gray-500">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-xs text-gray-500">Optimal</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs text-gray-500">High</span>
          </div>
        </div>
      </Card>

      {/* Cardio Summary Chart */}
      <CardioChart cardioMetrics={cardioMetrics} />
    </div>
  );
}
