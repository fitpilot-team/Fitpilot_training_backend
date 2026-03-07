import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { CheckCircleIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { TrainingQuestionnaire } from '../../components/ai';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useAIStore } from '../../store/aiStore';
import type { Client } from '../../types/client';
import type { QuestionnaireAnswers } from '../../types/ai';
import { clientInterviewsApi } from '../../services/client-interviews';

interface ClientContext {
  client: Client;
}

export function ClientInterviewPage() {
  const { t } = useTranslation(['ai', 'common']);
  const { client } = useOutletContext<ClientContext>();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasExistingInterview, setHasExistingInterview] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const { answers, setAnswers, reset, goToStep, config, loadConfig } = useAIStore();

  // Load existing interview data on mount
  useEffect(() => {
    const loadInterview = async () => {
      try {
        reset();
        const interview = await clientInterviewsApi.getInterview(client.id);

        if (interview) {
          setHasExistingInterview(true);
          // Map interview data to questionnaire answers
          setAnswers({
            // Profile
            fitness_level: interview.experience_level as any,
            age: interview.age ?? undefined,
            gender: interview.gender as any,
            weight_kg: interview.weight_kg ?? undefined,
            height_cm: interview.height_cm ?? undefined,
            training_experience_months: interview.training_experience_months ?? undefined,
            // Goals
            primary_goal: interview.primary_goal as any,
            specific_goals: interview.specific_goals_text ?? '',
            target_muscle_groups: interview.target_muscle_groups as any ?? [],
            // Availability
            days_per_week: interview.days_per_week ?? undefined,
            session_duration_minutes: interview.session_duration_minutes ?? undefined,
            preferred_days: interview.preferred_days ?? [],
            // Equipment
            has_gym_access: interview.has_gym_access ?? undefined,
            available_equipment: interview.available_equipment as any ?? [],
            equipment_notes: interview.equipment_notes ?? '',
            // Restrictions
            injuries: interview.injury_areas?.join(', ') ?? '',
            excluded_exercises: interview.excluded_exercises?.join(', ') ?? '',
            medical_conditions: interview.medical_conditions?.join(', ') ?? '',
            mobility_limitations: interview.mobility_limitations ?? '',
          });
        }
      } catch {
        // 404 is expected if no interview exists yet - that's fine
      } finally {
        setIsLoading(false);
      }
    };

    loadInterview();
  }, [client.id, reset, setAnswers]);

  // Ensure questionnaire config is loaded
  useEffect(() => {
    if (!config) {
      loadConfig().catch(() => {
        toast.error(t('ai:errors.configLoadFailed', { defaultValue: 'No pudimos cargar el cuestionario.' }));
      });
    }
  }, [config, loadConfig, t]);

  // Map questionnaire answers to interview update format
  const mapAnswersToInterviewData = (data: QuestionnaireAnswers) => {
    return {
      // Profile
      experience_level: data.fitness_level as 'beginner' | 'intermediate' | 'advanced' | undefined,
      age: data.age,
      gender: data.gender as 'male' | 'female' | 'other' | 'prefer_not_to_say' | undefined,
      weight_kg: data.weight_kg,
      height_cm: data.height_cm,
      training_experience_months: data.training_experience_months,
      // Goals
      primary_goal: data.primary_goal,
      specific_goals_text: data.specific_goals || undefined,
      target_muscle_groups: data.target_muscle_groups,
      // Availability
      days_per_week: data.days_per_week,
      session_duration_minutes: data.session_duration_minutes,
      preferred_days: data.preferred_days,
      // Equipment
      has_gym_access: data.has_gym_access,
      available_equipment: data.available_equipment,
      equipment_notes: data.equipment_notes || undefined,
      // Restrictions
      injury_areas: data.injuries
        ? data.injuries.split(',').map((s) => s.trim()).filter(Boolean) as any
        : undefined,
      excluded_exercises: data.excluded_exercises
        ? data.excluded_exercises.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      medical_conditions: data.medical_conditions
        ? data.medical_conditions.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      mobility_limitations: data.mobility_limitations || undefined,
    };
  };

  const handleComplete = async (data: QuestionnaireAnswers) => {
    setIsSaving(true);
    try {
      const interviewData = mapAnswersToInterviewData(data);
      await clientInterviewsApi.updateInterview(client.id, interviewData);
      setHasExistingInterview(true);
      setLastSaved(new Date());
      toast.success(t('ai:interview.saved'));
      // Reset to step 0 after saving
      goToStep(0);
    } catch (error: any) {
      toast.error(error.message || t('ai:interview.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardDocumentListIcon className="w-8 h-8 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('ai:interview.title')}
            </h1>
            <p className="mt-1 text-gray-600">
              {t('ai:interview.subtitle', { name: client.full_name })}
            </p>
          </div>
        </div>

        {/* Status indicator */}
        {hasExistingInterview && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
            <span className="text-sm text-green-700">
              {t('ai:interview.hasData')}
            </span>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          {t('ai:interview.infoText')}
        </p>
      </div>

      {/* Last saved indicator */}
      {lastSaved && (
        <div className="text-sm text-gray-500 text-right">
          {t('ai:interview.lastSaved', {
            time: lastSaved.toLocaleTimeString(),
          })}
        </div>
      )}

      {/* Questionnaire in interview mode */}
      <TrainingQuestionnaire
        mode="interview"
        initialData={answers}
        onComplete={handleComplete}
        isLoading={isSaving}
        config={config || undefined}
        submitButtonText={t('ai:interview.saveButton')}
      />
    </div>
  );
}
