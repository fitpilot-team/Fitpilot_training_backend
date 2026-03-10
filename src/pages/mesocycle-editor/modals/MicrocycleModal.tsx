import { useState, useEffect } from 'react';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';

export type IntensityLevel = 'low' | 'medium' | 'high' | 'deload';

export interface MicrocycleFormData {
  name: string;
  week_number: number;
  start_date: string;
  end_date: string;
  intensity_level: IntensityLevel;
  notes: string;
}

interface MicrocycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MicrocycleFormData) => void;
  nextWeekNumber: number;
}

const INITIAL_FORM_DATA: Omit<MicrocycleFormData, 'week_number'> = {
  name: '',
  start_date: '',
  end_date: '',
  intensity_level: 'medium',
  notes: '',
};

const INTENSITY_OPTIONS: { value: IntensityLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'deload', label: 'Deload' },
];

export function MicrocycleModal({
  isOpen,
  onClose,
  onSubmit,
  nextWeekNumber,
}: MicrocycleModalProps) {
  const [formData, setFormData] = useState<MicrocycleFormData>({
    ...INITIAL_FORM_DATA,
    week_number: nextWeekNumber,
  });

  useEffect(() => {
    if (isOpen) {
      setFormData((prev) => ({ ...prev, week_number: nextWeekNumber }));
    }
  }, [isOpen, nextWeekNumber]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ ...INITIAL_FORM_DATA, week_number: nextWeekNumber });
  };

  const updateField = <K extends keyof MicrocycleFormData>(
    key: K,
    value: MicrocycleFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Add Microcycle</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Name"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g., Foundation Phase"
              required
            />
            <Input
              type="number"
              label="Microcycle Number"
              value={formData.week_number}
              onChange={(e) => updateField('week_number', parseInt(e.target.value))}
              min="1"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="date"
              label="Start Date"
              value={formData.start_date}
              onChange={(e) => updateField('start_date', e.target.value)}
              required
            />
            <Input
              type="date"
              label="End Date"
              value={formData.end_date}
              onChange={(e) => updateField('end_date', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Intensity Level
            </label>
            <select
              value={formData.intensity_level}
              onChange={(e) => updateField('intensity_level', e.target.value as IntensityLevel)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {INTENSITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
              placeholder="Optional notes for this microcycle..."
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              Add Microcycle
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MicrocycleModal;
