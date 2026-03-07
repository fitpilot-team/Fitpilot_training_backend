import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { Moon, Dumbbell } from 'lucide-react';

export interface TrainingDayFormData {
  day_number: number;
  date: string;
  name: string;
  focus: string;
  notes: string;
  rest_day: boolean;
}

interface TrainingDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TrainingDayFormData) => void;
}

const INITIAL_FORM_DATA: TrainingDayFormData = {
  day_number: 1,
  date: '',
  name: '',
  focus: '',
  notes: '',
  rest_day: false,
};

export function TrainingDayModal({
  isOpen,
  onClose,
  onSubmit,
}: TrainingDayModalProps) {
  const { t } = useTranslation('training');
  const [formData, setFormData] = useState<TrainingDayFormData>(INITIAL_FORM_DATA);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Si es día de descanso, establecer nombre por defecto
    const dataToSubmit = formData.rest_day
      ? { ...formData, name: formData.name || t('trainingDay.restDay'), focus: '' }
      : formData;
    onSubmit(dataToSubmit);
    setFormData(INITIAL_FORM_DATA);
  };

  const updateField = <K extends keyof TrainingDayFormData>(
    key: K,
    value: TrainingDayFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleRestDay = () => {
    setFormData((prev) => ({
      ...prev,
      rest_day: !prev.rest_day,
      // Limpiar campos si se marca como día de descanso
      name: !prev.rest_day ? t('trainingDay.restDay') : '',
      focus: !prev.rest_day ? '' : prev.focus,
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">{t('trainingDay.add')}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Toggle Día de Descanso */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => formData.rest_day && toggleRestDay()}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all ${
                !formData.rest_day
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              <Dumbbell className="w-5 h-5" />
              <span className="font-medium">{t('trainingDay.title')}</span>
            </button>
            <button
              type="button"
              onClick={() => !formData.rest_day && toggleRestDay()}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all ${
                formData.rest_day
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              <Moon className="w-5 h-5" />
              <span className="font-medium">{t('trainingDay.restDay')}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              label={t('trainingDay.dayNumber')}
              value={formData.day_number}
              onChange={(e) => updateField('day_number', parseInt(e.target.value))}
              min="1"
              max="7"
              required
            />
            <Input
              type="date"
              label={t('trainingDay.date')}
              value={formData.date}
              onChange={(e) => updateField('date', e.target.value)}
              required
            />
          </div>

          {/* Campos condicionales - Solo si NO es día de descanso */}
          {!formData.rest_day && (
            <>
              <Input
                label={t('trainingDay.name')}
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder={t('trainingDay.namePlaceholder')}
                required
              />
              <Input
                label={`${t('trainingDay.focus')} (${t('configModal.cardio.optional')})`}
                value={formData.focus}
                onChange={(e) => updateField('focus', e.target.value)}
                placeholder={t('trainingDay.focusPlaceholder')}
              />
            </>
          )}

          {/* Mensaje informativo si es día de descanso */}
          {formData.rest_day && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
              <Moon className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
              <p className="text-emerald-700 font-medium">{t('trainingDay.restDay')}</p>
              <p className="text-emerald-600 text-sm mt-1">
                {t('trainingDay.restDayDescription')}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('trainingDay.notes')}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={3}
              placeholder={formData.rest_day ? t('trainingDay.restDayPlaceholder') : ''}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              {t('configModal.cancel')}
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              {t('trainingDay.add')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TrainingDayModal;
