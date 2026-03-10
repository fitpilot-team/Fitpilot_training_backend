import { useState, useEffect } from 'react';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';

export interface MesocycleFormData {
  name: string;
  block_number: number;
  description: string;
  start_date: string;
  end_date: string;
  focus: string;
  notes: string;
}

interface MesocycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MesocycleFormData) => void;
  nextBlockNumber: number;
}

const INITIAL_FORM_DATA: Omit<MesocycleFormData, 'block_number'> = {
  name: '',
  description: '',
  start_date: '',
  end_date: '',
  focus: '',
  notes: '',
};

const FOCUS_OPTIONS = [
  { value: '', label: 'Select focus' },
  { value: 'Hypertrophy', label: 'Hypertrophy' },
  { value: 'Strength', label: 'Strength' },
  { value: 'Power', label: 'Power' },
  { value: 'Peaking', label: 'Peaking' },
  { value: 'Deload', label: 'Deload' },
  { value: 'General Fitness', label: 'General Fitness' },
];

export function MesocycleModal({
  isOpen,
  onClose,
  onSubmit,
  nextBlockNumber,
}: MesocycleModalProps) {
  const [formData, setFormData] = useState<MesocycleFormData>({
    ...INITIAL_FORM_DATA,
    block_number: nextBlockNumber,
  });

  useEffect(() => {
    if (isOpen) {
      setFormData((prev) => ({ ...prev, block_number: nextBlockNumber }));
    }
  }, [isOpen, nextBlockNumber]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ ...INITIAL_FORM_DATA, block_number: nextBlockNumber });
  };

  const updateField = <K extends keyof MesocycleFormData>(
    key: K,
    value: MesocycleFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Add Mesocycle (Training Block)</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Name"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g., Hypertrophy Block"
              required
            />
            <Input
              type="number"
              label="Block Number"
              value={formData.block_number}
              onChange={(e) => updateField('block_number', parseInt(e.target.value))}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Focus</label>
            <select
              value={formData.focus}
              onChange={(e) => updateField('focus', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {FOCUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
              placeholder="Describe this training block..."
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              Add Mesocycle
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MesocycleModal;
