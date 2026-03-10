// Exercise configuration constants for tempo and set types

export interface TempoOption {
  value: string;
  label: string;
  labelEn: string;
  tempo: string;
  description: string;
  descriptionEn: string;
}

export interface SetTypeOption {
  value: string;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
}

export const TEMPO_OPTIONS: TempoOption[] = [
  {
    value: 'controlled',
    label: 'Controlado',
    labelEn: 'Controlled',
    tempo: '3-1-2-0',
    description: 'Énfasis en fase excéntrica. Mayor daño muscular y activación de fibras.',
    descriptionEn: 'Emphasis on eccentric phase. Greater muscle damage and fiber activation.',
  },
  {
    value: 'explosive',
    label: 'Explosivo',
    labelEn: 'Explosive',
    tempo: '2-0-1-0',
    description: 'Velocidad máxima en concéntrico. Ideal para potencia y fuerza.',
    descriptionEn: 'Maximum speed on concentric. Ideal for power and strength.',
  },
  {
    value: 'tut',
    label: 'Tiempo bajo tensión',
    labelEn: 'Time Under Tension',
    tempo: '4-1-3-1',
    description: 'Máximo TUT. Excelente para hipertrofia y conexión mente-músculo.',
    descriptionEn: 'Maximum TUT. Excellent for hypertrophy and mind-muscle connection.',
  },
  {
    value: 'standard',
    label: 'Estándar',
    labelEn: 'Standard',
    tempo: '2-0-2-0',
    description: 'Ritmo equilibrado. Bueno para trabajo general.',
    descriptionEn: 'Balanced rhythm. Good for general work.',
  },
  {
    value: 'pause_rep',
    label: 'Pausa-Rep',
    labelEn: 'Pause Rep',
    tempo: '2-2-2-0',
    description: 'Pausa en punto de máxima tensión. Elimina el rebote y aumenta dificultad.',
    descriptionEn: 'Pause at maximum tension point. Eliminates bounce and increases difficulty.',
  },
];

export const SET_TYPE_OPTIONS: SetTypeOption[] = [
  {
    value: 'straight',
    label: 'Serie normal',
    labelEn: 'Straight Set',
    description: 'Series estándar con descanso completo entre cada una.',
    descriptionEn: 'Standard sets with full rest between each one.',
  },
  {
    value: 'rest_pause',
    label: 'Rest-Pause',
    labelEn: 'Rest-Pause',
    description: 'Breves pausas (10-15s) para extender el set. Mayor volumen efectivo.',
    descriptionEn: 'Brief pauses (10-15s) to extend the set. Greater effective volume.',
  },
  {
    value: 'drop_set',
    label: 'Drop Set',
    labelEn: 'Drop Set',
    description: 'Reducción de peso sin descanso. Máxima fatiga muscular.',
    descriptionEn: 'Weight reduction without rest. Maximum muscle fatigue.',
  },
  {
    value: 'top_set',
    label: 'Top Set',
    labelEn: 'Top Set',
    description: 'Serie principal con máximo esfuerzo. Base para calcular backoffs.',
    descriptionEn: 'Main set with maximum effort. Base for calculating backoffs.',
  },
  {
    value: 'backoff',
    label: 'Backoff Set',
    labelEn: 'Backoff Set',
    description: 'Series de descarga con menor peso. Volumen adicional post-top set.',
    descriptionEn: 'Unloading sets with less weight. Additional volume post-top set.',
  },
  {
    value: 'myo_reps',
    label: 'Myo-Reps',
    labelEn: 'Myo-Reps',
    description: 'Serie activadora + mini-series. Alta eficiencia de tiempo.',
    descriptionEn: 'Activation set + mini-sets. High time efficiency.',
  },
  {
    value: 'cluster',
    label: 'Cluster Set',
    labelEn: 'Cluster Set',
    description: 'Micro-pausas intra-set. Permite más reps con cargas pesadas.',
    descriptionEn: 'Intra-set micro-pauses. Allows more reps with heavy loads.',
  },
];

// Helper to get tempo string from value
export function getTempoString(value: string | null): string {
  if (!value) return '';
  const option = TEMPO_OPTIONS.find(opt => opt.value === value);
  return option?.tempo || value;
}

// Helper to get tempo value from tempo string
export function getTempoValue(tempo: string | null): string | null {
  if (!tempo) return null;
  const option = TEMPO_OPTIONS.find(opt => opt.tempo === tempo);
  return option?.value || null;
}
