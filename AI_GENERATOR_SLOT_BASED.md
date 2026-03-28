# AI Generator Slot-Based Transition

## Resumen

El generador IA de training ya no depende exclusivamente de un catalogo plano para programas completos.

La implementacion actual mantiene compatibilidad hacia atras en el contrato principal de `AIWorkoutResponse`, pero introduce una capa interna basada en `slot candidates` para mejorar:

- estabilidad de ejercicios entre semanas
- calidad de remapeo de `exercise_id`
- ahorro de tokens en programas de varias semanas
- fallbacks mas robustos cuando falla el flujo estructurado

## Comportamiento por endpoint

### `/api/ai/preview`

- Sigue siendo una preview rapida y barata.
- Sigue limitado a 1 microciclo.
- No intenta forzar la ruta slot-based completa.
- Si la generacion falla, mantiene el flujo simple de preview.

### `/api/ai/generate`

- Ya no fuerza `program_duration.total_weeks = 1`.
- Ya no recorta el `macrocycle` a un solo microciclo.
- Respeta la duracion completa solicitada.
- Usa un `generation_scope` interno:
  - `full_short`: programa completo de 1 semana
  - `full_standard`: programas de 2-3 semanas
  - `full_phased`: programas de 4+ semanas cuando `AI_USE_PHASED_GENERATION=true`

### `/api/ai/save`

- Ya no trunca el macrocycle antes de persistir.
- Persiste todos los mesociclos y microciclos generados.
- Remapea ejercicios invalidos sobre el macrocycle completo antes de guardar.
- Ignora metadata opcional de slots al persistir en DB.

## Arquitectura nueva

### 1. Capa interna de slot candidates

Se agrego [ai_slotting.py](/c:/Users/ale_o/Fit-pilot1.0/fitpilot-training-backend/services/ai_slotting.py) con estructuras internas para modelar la seleccion de ejercicios por funcion:

- `ExerciseSlotDefinition`
- `SlotCandidate`
- `SlotCandidateGroup`
- `SlotProgramTemplate`
- `SlotSwapRule`

La inferencia actual usa heuristicas sobre:

- `exercise_class`
- `cardio_subclass`
- `type`
- `category`
- `primary_muscles`
- `secondary_muscles`
- `difficulty_level`
- `equipment_needed`
- `resistance_profile`
- nombre del ejercicio

Slots iniciales soportados:

- `primary_horizontal_press`
- `secondary_horizontal_press`
- `vertical_pull_primary`
- `horizontal_pull_primary`
- `knee_dominant_primary`
- `hip_hinge_primary`
- `chest_isolation`
- `lateral_delts`
- `triceps_extension`
- `biceps_flexion`
- `calves`
- `core_stability`
- `cardio_liss`
- `cardio_interval`

El modo slot-based solo se activa si el builder encuentra al menos:

- 4 candidate groups poblados
- 2 candidate groups compuestos primarios

Si no se cumple ese umbral, el sistema cae al catalogo filtrado tradicional.

### 2. Prompts scope-aware

Se agrego una segunda capa de builders en [workout_generator.py](/c:/Users/ale_o/Fit-pilot1.0/fitpilot-training-backend/prompts/workout_generator.py):

- `assemble_program_prompt_v2`
- `assemble_optimized_program_prompt`
- `assemble_base_week_prompt_v2`
- `build_progression_prompt_v2`
- `build_slot_candidate_catalog`
- `build_slot_selection_prompt`
- `build_mesocycle_template_prompt`
- `build_swap_rules_prompt`

Reglas nuevas del prompt:

- `preview` genera solo 1 microciclo
- `generate` respeta `total_weeks`
- para hipertrofia se instruye mantener ejercicios estables a lo largo del mesociclo
- los cambios entre semanas deben priorizar:
  - sets
  - reps
  - `effort_value`
  - intensidad
  - deload
- los cambios de ejercicio solo se justifican por:
  - restriccion
  - equipo
  - monotonia solicitada
  - dolor o intolerancia
  - variante claramente mas tolerable

### 3. Orquestacion de generacion

La orquestacion vive en [ai_generator.py](/c:/Users/ale_o/Fit-pilot1.0/fitpilot-training-backend/services/ai_generator.py).

Flujos actuales:

- `preview`:
  - 1 llamada
  - 1 microciclo
  - sin expansion larga

- `full_short`:
  - 1 llamada
  - programa completo de 1 semana

- `full_standard`:
  - 2 llamadas
  - semana base
  - progression matrix
  - expansion local del macrocycle

- `full_phased`:
  - misma estructura base que `full_standard`
  - se marca como `used_phased_generation=true`
  - reservada para 4+ semanas

La expansion local ahora puede aplicar progresion por:

- `day_number + slot_role` cuando el output trae metadata de slot
- `day_number + ex_idx` como fallback legacy

### 4. Metadata publica opcional

El contrato principal sigue siendo compatible, pero se agregaron campos opcionales no breaking en [schemas/ai_generator.py](/c:/Users/ale_o/Fit-pilot1.0/fitpilot-training-backend/schemas/ai_generator.py):

En `AIWorkoutResponse`:

- `generation_metadata`

Campos actuales de `generation_metadata`:

- `generation_scope`
- `used_slot_based_generation`
- `used_phased_generation`
- `progression_model`
- `template_version`
- `candidate_group_count`
- `flat_catalog_size`
- `slot_candidate_count`

En `GeneratedDayExercise`:

- `slot_role`
- `slot_candidate_ids`

Estos campos son solo para trazabilidad y debug. El frontend actual puede ignorarlos.

## Remapeo de ejercicios

`ExerciseMapper` ahora intenta remapear en este orden:

1. dentro de `slot_candidate_ids`
2. dentro de ejercicios que infieren el mismo `slot_role`
3. busqueda global por nombre

Esto mejora la calidad cuando la IA devuelve un `exercise_id` invalido pero el slot ya estaba bien definido.

## Fallbacks

Los fallbacks actuales estan pensados para no romper produccion:

- si slot inference no es elegible: usar catalogo filtrado tradicional
- si falla la generacion de semana base estructurada: caer a `one_shot`
- si falla la llamada de progression: caer a `one_shot`
- si falla el parseo de progression: usar `_default_progression(...)`
- si el output no trae metadata de slot: usar indices legacy de ejercicio

## Observabilidad

Se agregaron logs de contexto de generacion con:

- `generation_scope`
- `total_weeks`
- `used_slot_based_generation`
- `used_phased_generation`
- `candidate_group_count`
- `flat_catalog_size`
- `slot_candidate_count`
- `cacheable_chars`
- `specific_chars`
- estimacion de tokens por chars

## Pruebas agregadas

Se agrego [test_ai_generator.py](/c:/Users/ale_o/Fit-pilot1.0/fitpilot-training-backend/tests/test_ai_generator.py) para validar:

- preview sigue siendo de 1 microciclo
- generate de 2-3 semanas ya no se trunca
- 4+ semanas usan ruta phased cuando esta activa
- el builder crea `slot candidate groups`
- los prompts usan candidate groups cuando existen
- el prompt cae al catalogo plano cuando no hay slot groups suficientes
- `ExerciseMapper` remapea primero dentro del slot
- save persiste mas de 1 microciclo
- el response model acepta metadata opcional

Comando usado:

```bash
python -m pytest fitpilot-training-backend\tests\test_ai_generator.py -q
```

## Limites actuales

- la inferencia de slots sigue siendo heuristica
- no hay persistencia de metadata de slots en DB
- no hay taxonomia completa por tolerancia articular
- la validacion con proveedor real no forma parte de los tests unitarios actuales

## Proximos pasos recomendados

- reforzar la inferencia con datos reales del catalogo productivo
- enriquecer la progression matrix para soportar swaps justificados con mas detalle
- exponer metricas de uso de tokens del proveedor en logging estructurado si el SDK las entrega siempre
- mover esta arquitectura a una documentacion operativa mas amplia si el flujo IA sigue creciendo
