import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useMesocycleStore } from '../../store/mesocycleStore';
import { MagnifyingGlassIcon, CheckIcon } from '@heroicons/react/24/outline';
import type { Exercise } from '../../types';
import { getExerciseName, getExerciseDescription } from '../../utils/exerciseHelpers';

interface ExerciseSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise, config: ExerciseConfig) => void;
  trainingDayId: string;
}

export interface ExerciseConfig {
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_seconds?: number;
  tempo?: string;
  set_type?: string | null;
  effort_type: 'RIR' | 'RPE' | 'percentage';
  effort_value: number;
  notes?: string;
}

export function ExerciseSelector({
  isOpen,
  onClose,
  onSelect,
  trainingDayId: _trainingDayId,
}: ExerciseSelectorProps) {
  const { exercises, isLoadingExercises, loadExercises } = useMesocycleStore();

  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterMuscleGroup, setFilterMuscleGroup] = useState('');

  // Configuration state
  const [config, setConfig] = useState<ExerciseConfig>({
    sets: 3,
    reps_min: 8,
    reps_max: 12,
    rest_seconds: 60,
    effort_type: 'RIR',
    effort_value: 2,
  });

  useEffect(() => {
    if (isOpen) {
      loadExercises();
      setSelectedExercise(null);
      setConfig({
        sets: 3,
        reps_min: 8,
        reps_max: 12,
        rest_seconds: 60,
        effort_type: 'RIR',
        effort_value: 2,
      });
    }
  }, [isOpen, loadExercises]);

  const filteredExercises = exercises.filter((exercise) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      searchTerm === '' ||
      exercise.name_en.toLowerCase().includes(searchLower) ||
      exercise.name_es?.toLowerCase().includes(searchLower);
    const matchesType = filterType === '' || exercise.type === filterType;
    // Filter by primary muscle's category
    const primaryMuscleCategory = exercise.primary_muscles?.[0]?.muscle_category;
    const matchesMuscleGroup =
      filterMuscleGroup === '' || primaryMuscleCategory === filterMuscleGroup;

    return matchesSearch && matchesType && matchesMuscleGroup;
  });

  const handleAdd = () => {
    if (!selectedExercise) return;

    onSelect(selectedExercise, config);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Exercise" size="lg">
      <div className="flex gap-6 h-[600px]">
        {/* Left: Exercise Library */}
        <div className="flex-1 flex flex-col">
          <div className="space-y-3 mb-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search exercises..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Types</option>
                <option value="multiarticular">Multiarticular</option>
                <option value="monoarticular">Monoarticular</option>
              </select>

              <select
                value={filterMuscleGroup}
                onChange={(e) => setFilterMuscleGroup(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Muscle Groups</option>
                <option value="chest">Chest</option>
                <option value="back">Back</option>
                <option value="shoulders">Shoulders</option>
                <option value="arms">Arms</option>
                <option value="legs">Legs</option>
                <option value="core">Core</option>
                <option value="cardio">Cardio</option>
              </select>
            </div>
          </div>

          {/* Exercise List */}
          <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg">
            {isLoadingExercises ? (
              <div className="flex items-center justify-center h-full">
                <LoadingSpinner />
              </div>
            ) : filteredExercises.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No exercises found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredExercises.map((exercise) => (
                  <button
                    key={exercise.id}
                    onClick={() => setSelectedExercise(exercise)}
                    className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
                      selectedExercise?.id === exercise.id
                        ? 'bg-primary-50 border-l-4 border-primary-500'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{getExerciseName(exercise)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                            {exercise.type}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded capitalize">
                            {exercise.primary_muscles?.[0]?.muscle_name?.replace('_', ' ') || 'N/A'}
                          </span>
                        </div>
                      </div>
                      {selectedExercise?.id === exercise.id && (
                        <CheckIcon className="h-5 w-5 text-primary-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Configuration */}
        {selectedExercise && (
          <div className="w-80 flex flex-col">
            <div className="flex-1 space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  {getExerciseName(selectedExercise)}
                </h4>
                {getExerciseDescription(selectedExercise) && (
                  <p className="text-sm text-gray-600">{getExerciseDescription(selectedExercise)}</p>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4 space-y-4">
                <h5 className="font-medium text-gray-900">Configuration</h5>

                <Input
                  type="number"
                  label="Sets"
                  value={config.sets}
                  onChange={(e) =>
                    setConfig({ ...config, sets: parseInt(e.target.value) || 0 })
                  }
                  min="1"
                />

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    label="Min Reps"
                    value={config.reps_min}
                    onChange={(e) =>
                      setConfig({ ...config, reps_min: parseInt(e.target.value) || 0 })
                    }
                    min="1"
                  />
                  <Input
                    type="number"
                    label="Max Reps"
                    value={config.reps_max}
                    onChange={(e) =>
                      setConfig({ ...config, reps_max: parseInt(e.target.value) || 0 })
                    }
                    min="1"
                  />
                </div>

                <Input
                  type="number"
                  label="Rest (seconds)"
                  value={config.rest_seconds || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      rest_seconds: parseInt(e.target.value) || undefined,
                    })
                  }
                />

                <Input
                  type="text"
                  label="Tempo"
                  value={config.tempo || ''}
                  onChange={(e) => setConfig({ ...config, tempo: e.target.value })}
                  placeholder="e.g., 3-1-1-0"
                  helperText="Eccentric-Pause-Concentric-Pause"
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Effort Type
                    </label>
                    <select
                      value={config.effort_type}
                      onChange={(e) =>
                        setConfig({ ...config, effort_type: e.target.value as any })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="RIR">RIR</option>
                      <option value="RPE">RPE</option>
                      <option value="percentage">% 1RM</option>
                    </select>
                  </div>
                  <Input
                    type="number"
                    label="Effort Value"
                    value={config.effort_value}
                    onChange={(e) =>
                      setConfig({ ...config, effort_value: parseFloat(e.target.value) || 0 })
                    }
                    step="0.5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={config.notes || ''}
                    onChange={(e) => setConfig({ ...config, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows={3}
                    placeholder="Additional notes or instructions..."
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-gray-200 mt-4">
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button variant="primary" onClick={handleAdd} className="flex-1">
                Add Exercise
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
