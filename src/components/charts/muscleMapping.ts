import type { MuscleName } from '../../types';

/**
 * Mapping of SVG element IDs to muscle groups.
 * IDs updated to English naming convention for consistency
 *
 * Total: 52 SVG elements mapped to 16 muscle groups
 */
export const MUSCLE_ID_TO_GROUP: Record<string, MuscleName> = {
  // =====================================
  // ANTERIOR VIEW - Chest (2 elements)
  // =====================================
  'chest_left': 'chest',
  'chest_right': 'chest',

  // =======================================
  // ANTERIOR VIEW - Anterior Deltoid (2 elements)
  // =====================================
  'anterior_deltoid_left': 'anterior_deltoid',
  'anterior_deltoid_right': 'anterior_deltoid',

  // =====================================
  // ANTERIOR VIEW - Biceps (6 elements)
  // =====================================
  'biceps_left_long_head': 'biceps',
  'biceps_left_short_head': 'biceps',
  'biceps_left_brachialis': 'biceps',
  'biceps_right_long_head': 'biceps',
  'biceps_right_short_head': 'biceps',
  'biceps_right_brachialis': 'biceps',

  // =====================================
  // ANTERIOR VIEW - Abs (1 element)
  // =====================================
  'abs_rectus': 'abs',

  // =====================================
  // ANTERIOR VIEW - Obliques (2 elements)
  // =====================================
  'obliques_left': 'obliques',
  'obliques_right': 'obliques',

  // =====================================
  // ANTERIOR VIEW - Quadriceps (6 elements)
  // =====================================
  'quadriceps_left_rectus_femoris': 'quadriceps',
  'quadriceps_right_rectus_femoris': 'quadriceps',
  'quadriceps_left_vastus_medialis': 'quadriceps',
  'quadriceps_right_vastus_medialis': 'quadriceps',
  'quadriceps_left_vastus_lateralis': 'quadriceps',
  'quadriceps_right_vastus_lateralis': 'quadriceps',

  // =====================================
  // ANTERIOR VIEW - Adductors (2 elements)
  // =====================================
  'adductors_left': 'adductors',
  'adductors_right': 'adductors',

  // =====================================
  // ANTERIOR VIEW - Tibialis Anterior (2 elements)
  // =====================================
  'tibialis_left': 'tibialis',
  'tibialis_right': 'tibialis',

  // =====================================
  // POSTERIOR VIEW - Trapezius → upper_back (2 elements)
  // =====================================
  'trapezius_left': 'upper_back',
  'trapezius_right': 'upper_back',

  // =====================================
  // POSTERIOR VIEW - Teres/Infraspinatus → upper_back (6 elements)
  // =====================================
  'teres_major_left': 'upper_back',
  'teres_major_right': 'upper_back',
  'teres_minor_left': 'upper_back',
  'teres_minor_right': 'upper_back',
  'infraspinatus_left': 'upper_back',
  'infraspinatus_right': 'upper_back',

  // =====================================
  // POSTERIOR VIEW - Lats (2 elements)
  // =====================================
  'lats_left': 'lats',
  'lats_right': 'lats',

  // =====================================
  // POSTERIOR VIEW - Lower Back (2 elements)
  // =====================================
  'lower_back_left': 'lower_back',
  'lower_back_right': 'lower_back',

  // =====================================
  // POSTERIOR VIEW - Posterior Deltoid (2 elements)
  // =====================================
  'posterior_deltoid_left': 'posterior_deltoid',
  'posterior_deltoid_right': 'posterior_deltoid',

  // =====================================
  // POSTERIOR VIEW - Triceps (4 elements)
  // =====================================
  'triceps_left_long_head': 'triceps',
  'triceps_left_lateral_head': 'triceps',
  'triceps_right_long_head': 'triceps',
  'triceps_right_lateral_head': 'triceps',

  // =====================================
  // POSTERIOR VIEW - Glutes (3 elements)
  // =====================================
  'glutes_left_maximus': 'glutes',
  'glutes_right_maximus': 'glutes',
  'glutes_left_minimus': 'glutes',

  // =====================================
  // POSTERIOR VIEW - Hamstrings (5 elements)
  // =====================================
  'hamstrings_left_semitendinosus': 'hamstrings',
  'hamstrings_right_semitendinosus': 'hamstrings',
  'hamstrings_left_semimembranosus': 'hamstrings',
  'hamstrings_right_semimembranosus': 'hamstrings',
  'hamstrings_right_biceps_femoris': 'hamstrings',

  // =====================================
  // POSTERIOR VIEW - Adductors (2 elements)
  // =====================================
  'adductors_left_posterior': 'adductors',
  'adductors_right_posterior': 'adductors',

  // =====================================
  // POSTERIOR VIEW - Vasto Lateral (1 element)
  // =====================================
  'quadriceps_left_vastus_lateralis_posterior': 'quadriceps',

  // =====================================
  // POSTERIOR VIEW - Calves (4 elements)
  // =====================================
  'calves_left_gastrocnemius_medial': 'calves',
  'calves_right_gastrocnemius_medial': 'calves',
  'calves_left_gastrocnemius_lateral': 'calves',
  'calves_right_gastrocnemius_lateral': 'calves',
};

/**
 * Human-readable labels for SVG elements (muscle-specific)
 */
export const MUSCLE_LABELS: Record<string, string> = {
  // Anterior View - Chest
  'chest_left': 'Left Pectoral',
  'chest_right': 'Right Pectoral',

  // Anterior View - Deltoids
  'anterior_deltoid_left': 'Left Anterior Deltoid',
  'anterior_deltoid_right': 'Right Anterior Deltoid',

  // Anterior View - Biceps
  'biceps_left_long_head': 'Left Biceps (Long Head)',
  'biceps_left_short_head': 'Left Biceps (Short Head)',
  'biceps_left_brachialis': 'Left Brachialis',
  'biceps_right_long_head': 'Right Biceps (Long Head)',
  'biceps_right_short_head': 'Right Biceps (Short Head)',
  'biceps_right_brachialis': 'Right Brachialis',

  // Anterior View - Core
  'abs_rectus': 'Rectus Abdominis',
  'obliques_left': 'Left Oblique',
  'obliques_right': 'Right Oblique',

  // Anterior View - Legs
  'quadriceps_left_rectus_femoris': 'Left Rectus Femoris',
  'quadriceps_right_rectus_femoris': 'Right Rectus Femoris',
  'quadriceps_left_vastus_medialis': 'Left Vastus Medialis',
  'quadriceps_right_vastus_medialis': 'Right Vastus Medialis',
  'quadriceps_left_vastus_lateralis': 'Left Vastus Lateralis',
  'quadriceps_right_vastus_lateralis': 'Right Vastus Lateralis',
  'adductors_left': 'Left Adductor',
  'adductors_right': 'Right Adductor',
  'tibialis_left': 'Left Tibialis Anterior',
  'tibialis_right': 'Right Tibialis Anterior',

  // Posterior View - Back
  'trapezius_left': 'Left Trapezius',
  'trapezius_right': 'Right Trapezius',
  'teres_major_left': 'Left Teres Major',
  'teres_major_right': 'Right Teres Major',
  'teres_minor_left': 'Left Teres Minor',
  'teres_minor_right': 'Right Teres Minor',
  'infraspinatus_left': 'Left Infraspinatus',
  'infraspinatus_right': 'Right Infraspinatus',
  'lats_left': 'Left Latissimus Dorsi',
  'lats_right': 'Right Latissimus Dorsi',
  'lower_back_left': 'Left Lower Back',
  'lower_back_right': 'Right Lower Back',

  // Posterior View - Deltoids
  'posterior_deltoid_left': 'Left Posterior Deltoid',
  'posterior_deltoid_right': 'Right Posterior Deltoid',

  // Posterior View - Triceps
  'triceps_left_long_head': 'Left Triceps (Long Head)',
  'triceps_left_lateral_head': 'Left Triceps (Lateral Head)',
  'triceps_right_long_head': 'Right Triceps (Long Head)',
  'triceps_right_lateral_head': 'Right Triceps (Lateral Head)',

  // Posterior View - Glutes
  'glutes_left_maximus': 'Left Gluteus Maximus',
  'glutes_right_maximus': 'Right Gluteus Maximus',
  'glutes_left_minimus': 'Left Gluteus Minimus',

  // Posterior View - Hamstrings
  'hamstrings_left_semitendinosus': 'Left Semitendinosus',
  'hamstrings_right_semitendinosus': 'Right Semitendinosus',
  'hamstrings_left_semimembranosus': 'Left Semimembranosus',
  'hamstrings_right_semimembranosus': 'Right Semimembranosus',
  'hamstrings_right_biceps_femoris': 'Right Biceps Femoris',

  // Posterior View - Adductors (posterior view)
  'adductors_left_posterior': 'Left Adductor',
  'adductors_right_posterior': 'Right Adductor',

  // Posterior View - Vastus Lateralis
  'quadriceps_left_vastus_lateralis_posterior': 'Left Vastus Lateralis',

  // Posterior View - Calves
  'calves_left_gastrocnemius_medial': 'Left Gastrocnemius (Medial)',
  'calves_right_gastrocnemius_medial': 'Right Gastrocnemius (Medial)',
  'calves_left_gastrocnemius_lateral': 'Left Gastrocnemius (Lateral)',
  'calves_right_gastrocnemius_lateral': 'Right Gastrocnemius (Lateral)',
};

/**
 * Muscle groups WITHOUT SVG representation.
 * Currently ALL 16 muscle groups have SVG representation.
 */
export const UNMAPPED_MUSCLE_GROUPS: MuscleName[] = [];

/**
 * Muscle groups WITH SVG visualization (16 muscles - 100% coverage)
 */
export const MAPPED_MUSCLE_GROUPS: MuscleName[] = [
  'chest',              // Pectorals (anterior view)
  'anterior_deltoid',   // Anterior deltoid (anterior view)
  'biceps',             // Biceps (anterior view)
  'abs',                // Abdominals (anterior view)
  'obliques',           // Obliques (anterior view)
  'quadriceps',         // Quadriceps (anterior and posterior views)
  'adductors',          // Adductors (anterior and posterior views)
  'tibialis',           // Tibialis anterior (anterior view)
  'upper_back',         // Trapezius + Teres + Infraspinatus (posterior view)
  'lats',               // Latissimus dorsi (posterior view)
  'lower_back',         // Lower back (posterior view)
  'posterior_deltoid',  // Posterior deltoid (posterior view)
  'triceps',            // Triceps (posterior view)
  'glutes',             // Glutes (posterior view)
  'hamstrings',         // Hamstrings (posterior view)
  'calves',             // Calves (posterior view)
];
