"""
Sistema de Prompts Modulares para Generación de Entrenamientos con IA

Este módulo contiene funciones especializadas (skills) para construir
prompts de alta calidad que generan programas de entrenamiento consistentes.
"""

import json
from typing import List, Dict, Any, Optional, Literal
from schemas.ai_generator import (
    AIWorkoutRequest,
    FitnessLevel,
    PrimaryGoal,
    ExerciseVariety,
    PatientContext,
)
from services.ai_slotting import (
    SlotCatalogBuildResult,
    build_slot_candidate_groups as infer_slot_candidate_groups,
    render_slot_candidate_groups,
)


def build_system_prompt() -> str:
    """
    Construye el prompt del sistema con el rol y principios de entrenamiento.
    """
    return """Eres un entrenador personal certificado y experto en programación de entrenamiento con más de 15 años de experiencia. Tu especialidad es crear programas de entrenamiento personalizados basados en principios científicos.

## PRINCIPIOS FUNDAMENTALES QUE DEBES SEGUIR:

### 1. Periodización
- Organiza el entrenamiento en bloques con objetivos específicos
- Alterna entre fases de acumulación (volumen) y intensificación (intensidad)
- Incluye semanas de descarga (deload) cada 3-4 semanas de entrenamiento intenso
- Progresión ondulante dentro de cada mesociclo

### 2. Sobrecarga Progresiva
- Incrementa gradualmente el volumen o la intensidad
- Usa rangos de repeticiones apropiados para cada objetivo
- Ajusta el esfuerzo (RIR/RPE) según la fase del mesociclo

### 3. Especificidad
- Selecciona ejercicios que trabajen los grupos musculares objetivo
- Prioriza ejercicios multiarticulares como base
- Complementa con ejercicios monoarticulares para trabajo específico

### 4. Recuperación
- Permite 48-72 horas entre sesiones del mismo grupo muscular
- Ajusta el volumen total según la capacidad de recuperación
- Los días de descanso son parte integral del programa

### 5. Individualización
- Adapta el programa al nivel de experiencia del usuario
- Considera las limitaciones y restricciones físicas
- Respeta la disponibilidad de tiempo y equipamiento

## RANGOS DE REFERENCIA POR OBJETIVO:

| Objetivo | Series/músculo/semana | Reps | RIR | Descanso |
|----------|----------------------|------|-----|----------|
| Hipertrofia | 10-20 | 6-12 | 1-3 | 60-90s |
| Fuerza | 6-12 | 3-6 | 2-4 | 2-3min |
| Potencia | 4-8 | 1-5 | 3-5 | 3-5min |
| Resistencia | 12-20 | 12-20+ | 1-2 | 30-60s |
| Pérdida grasa | 10-15 | 8-15 | 2-3 | 45-60s |
| Fitness general | 8-12 | 8-12 | 2-3 | 60-90s |

## DISTRIBUCIÓN SEMANAL RECOMENDADA:

- 2 días/semana: Full Body x2
- 3 días/semana: Full Body x3 o Push/Pull/Legs
- 4 días/semana: Upper/Lower x2 o Push/Pull/Legs + Full Body
- 5 días/semana: Upper/Lower/Push/Pull/Legs o Push/Pull/Legs/Upper/Lower
- 6 días/semana: Push/Pull/Legs x2

## CLASIFICACIÓN DE EJERCICIOS POR TIPO:

Cada ejercicio tiene una CLASE que determina cómo se parametriza:

### STRENGTH (Fuerza)
- Usar reps_min/reps_max (típicamente 1-20)
- Esfuerzo: RIR o RPE (0-5)
- Incluir tempo cuando sea relevante
- REQUIERE músculos primarios

### CARDIO
- Usar duration_seconds (NO reps)
- Sub-clases:
  - **LISS** (Low Intensity Steady State): 1200-3600 seg (20-60 min), zona HR 1-2, esfuerzo bajo
  - **HIIT** (High Intensity Interval Training): 600-1800 seg (10-30 min), zona HR 4-5, intervalos
  - **MISS** (Moderate Intensity Steady State): 1200-1800 seg (20-30 min), zona HR 2-3, moderado
- Campo intensity_zone (iz): 1-5 para indicar zona de frecuencia cardíaca

### PLYOMETRIC (Pliométricos)
- Sets bajos (2-4)
- Reps bajos (3-8)
- Descansos largos (2-3 min)
- RIR alto (3-5)
- REQUIERE músculos primarios

### FLEXIBILITY (Flexibilidad)
- Usar duration_seconds para estiramientos
- Sin esfuerzo medido (RPE bajo o nulo)
- Descansos cortos

### MOBILITY (Movilidad)
- Usar duration_seconds o reps
- Bajo esfuerzo
- Enfoque en rango de movimiento

### WARMUP (Calentamiento)
- Bajo volumen, sin esfuerzo medido
- Preparación para la sesión

### CONDITIONING (Acondicionamiento)
- Alta intensidad, volumen moderado
- Combina fuerza y cardio
- Usar duration_seconds o reps según el ejercicio

### BALANCE (Equilibrio)
- Bajo volumen, enfoque técnico
- Duration_seconds para ejercicios estáticos"""


def build_user_context(request: AIWorkoutRequest) -> str:
    """
    Construye el contexto del usuario basado en sus respuestas al cuestionario.
    """
    profile = request.user_profile
    goals = request.goals
    availability = request.availability
    equipment = request.equipment
    restrictions = request.restrictions
    preferences = request.preferences
    duration = request.program_duration

    context_parts = []

    # Perfil del usuario
    context_parts.append("## PERFIL DEL USUARIO")
    context_parts.append(f"- Nivel de fitness: {profile.fitness_level.value}")

    if profile.age:
        context_parts.append(f"- Edad: {profile.age} años")
    if profile.gender:
        context_parts.append(f"- Género: {profile.gender.value}")
    if profile.weight_kg:
        context_parts.append(f"- Peso: {profile.weight_kg} kg")
    if profile.height_cm:
        context_parts.append(f"- Altura: {profile.height_cm} cm")
    if profile.training_experience_months:
        years = profile.training_experience_months // 12
        months = profile.training_experience_months % 12
        if years > 0:
            context_parts.append(f"- Experiencia: {years} años y {months} meses")
        else:
            context_parts.append(f"- Experiencia: {months} meses")

    # Objetivos
    context_parts.append("\n## OBJETIVOS")
    context_parts.append(f"- Objetivo principal: {_translate_goal(goals.primary_goal)}")

    if goals.specific_goals:
        context_parts.append(f"- Objetivos específicos: {', '.join(goals.specific_goals)}")
    if goals.target_muscle_groups:
        muscles = [m.value for m in goals.target_muscle_groups]
        context_parts.append(f"- Grupos musculares a enfatizar: {', '.join(muscles)}")

    # Disponibilidad
    context_parts.append("\n## DISPONIBILIDAD")
    context_parts.append(f"- Días por semana: {availability.days_per_week}")
    context_parts.append(f"- Duración por sesión: {availability.session_duration_minutes} minutos")

    if availability.preferred_days:
        days_map = {1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves",
                    5: "Viernes", 6: "Sábado", 7: "Domingo"}
        preferred = [days_map.get(d, str(d)) for d in availability.preferred_days]
        context_parts.append(f"- Días preferidos: {', '.join(preferred)}")

    # Equipamiento
    context_parts.append("\n## EQUIPAMIENTO")
    context_parts.append(f"- Acceso a gimnasio: {'Sí' if equipment.has_gym_access else 'No'}")
    equip_list = [e.value.replace('_', ' ').title() for e in equipment.available_equipment]
    context_parts.append(f"- Equipamiento disponible: {', '.join(equip_list)}")

    if equipment.equipment_notes:
        context_parts.append(f"- Notas de equipamiento: {equipment.equipment_notes}")

    # Restricciones
    if restrictions:
        context_parts.append("\n## RESTRICCIONES Y LIMITACIONES")
        if restrictions.injuries:
            context_parts.append(f"- Lesiones: {', '.join(restrictions.injuries)}")
        if restrictions.excluded_exercises:
            context_parts.append(f"- Ejercicios a evitar: {', '.join(restrictions.excluded_exercises)}")
        if restrictions.medical_conditions:
            context_parts.append(f"- Condiciones médicas: {', '.join(restrictions.medical_conditions)}")
        if restrictions.mobility_limitations:
            context_parts.append(f"- Limitaciones de movilidad: {restrictions.mobility_limitations}")

    # Preferencias
    if preferences:
        context_parts.append("\n## PREFERENCIAS")
        context_parts.append(f"- Variedad de ejercicios: {preferences.exercise_variety.value}")
        context_parts.append(f"- Incluir cardio: {'Sí' if preferences.include_cardio else 'No'}")
        context_parts.append(f"- Incluir calentamiento: {'Sí' if preferences.include_warmup else 'No'}")

        if preferences.preferred_training_style:
            context_parts.append(f"- Estilo preferido: {preferences.preferred_training_style}")

    # Duración del programa
    context_parts.append("\n## DURACIÓN DEL PROGRAMA")
    context_parts.append(f"- Duración total: {duration.total_weeks} semanas")
    context_parts.append(f"- Duración de cada mesociclo: {duration.mesocycle_weeks} semanas")
    context_parts.append(f"- Incluir semanas de descarga: {'Sí' if duration.include_deload else 'No'}")
    context_parts.append(f"- Fecha de inicio: {duration.start_date.isoformat()}")

    # Notas adicionales
    if request.additional_notes:
        context_parts.append(f"\n## NOTAS ADICIONALES\n{request.additional_notes}")

    return "\n".join(context_parts)


def build_patient_context_block(patient_context: Optional[PatientContext]) -> str:
    """
    Construye un bloque compacto con el contexto clínico/paciente.
    Mantiene solo la información mínima necesaria para no inflar tokens.
    """
    if not patient_context:
        return ""

    lines: List[str] = ["## CONTEXTO DEL PACIENTE (COMPACTO)"]

    # Antropometría
    if patient_context.anthropometrics and patient_context.anthropometrics.latest:
        latest = patient_context.anthropometrics.latest
        compact = []
        for key, payload in latest.items():
            val = payload.get("value")
            if val is None:
                continue
            unit = payload.get("unit") or ""
            compact.append(f"{key}:{val}{unit}")
        if compact:
            lines.append(f"- Medidas recientes: {', '.join(compact[:8])}")

    # Historia médica
    if patient_context.medical_history:
        mh = patient_context.medical_history
        if mh.conditions:
            conds = [c.name for c in mh.conditions if getattr(c, "name", None)]
            if conds:
                lines.append(f"- Condiciones: {', '.join(conds[:5])}")
        if mh.medications:
            meds = [m.name for m in mh.medications if getattr(m, "name", None)]
            if meds:
                lines.append(f"- Medicación: {', '.join(meds[:5])}")
        if mh.allergies:
            allergies = [a.substance for a in mh.allergies if getattr(a, "substance", None)]
            if allergies:
                lines.append(f"- Alergias: {', '.join(allergies[:5])}")
        if mh.contraindications:
            lines.append(f"- Contraindicaciones: {', '.join(mh.contraindications[:5])}")

    # Lesiones
    if patient_context.injuries:
        injuries = [i.area for i in patient_context.injuries if getattr(i, "area", None)]
        if injuries:
            lines.append(f"- Lesiones: {', '.join(injuries[:5])}")

    # Estilo de vida
    if patient_context.lifestyle:
        lf = patient_context.lifestyle
        lifestyle_bits = []
        if lf.sleep_hours:
            lifestyle_bits.append(f"sueño:{lf.sleep_hours}h")
        if lf.stress_level:
            lifestyle_bits.append(f"estrés:{lf.stress_level}")
        if lf.activity_outside_gym:
            lifestyle_bits.append(f"actividad:{lf.activity_outside_gym}")
        if lf.diet_pattern:
            lifestyle_bits.append(f"dieta:{lf.diet_pattern}")
        if lifestyle_bits:
            lines.append(f"- Estilo de vida: {', '.join(lifestyle_bits[:4])}")

    # Preferencias y restricciones adicionales
    if patient_context.preferences and patient_context.preferences.avoid_exercises:
        lines.append(f"- Evitar ejercicios: {', '.join(patient_context.preferences.avoid_exercises[:5])}")

    if patient_context.constraints:
        c = patient_context.constraints
        constraint_bits = []
        if c.session_time_min:
            constraint_bits.append(f"tiempo_sesion:{c.session_time_min}min")
        if c.days_per_week:
            constraint_bits.append(f"días:{c.days_per_week}")
        if c.equipment:
            constraint_bits.append(f"equipo:{', '.join(c.equipment[:4])}")
        if c.mobility_limitations:
            constraint_bits.append(f"movilidad:{c.mobility_limitations}")
        if constraint_bits:
            lines.append(f"- Restricciones: {', '.join(constraint_bits)}")

    if len(lines) == 1:
        return ""

    return "\n".join(lines)


def build_exercise_catalog(exercises: List[Dict[str, Any]]) -> str:
    """
    Construye el catálogo de ejercicios disponibles para la IA.
    Los ejercicios se agrupan por categoría para facilitar la selección.
    Incluye información detallada de músculos primarios y secundarios.
    """
    if not exercises:
        return "## CATÁLOGO DE EJERCICIOS\n\nNo hay ejercicios disponibles en la base de datos."

    # Agrupar ejercicios por categoría
    grouped: Dict[str, List[Dict]] = {}
    for ex in exercises:
        category = ex.get("category", "other")
        if category not in grouped:
            grouped[category] = []
        grouped[category].append(ex)

    catalog_parts = ["## CATÁLOGO DE EJERCICIOS DISPONIBLES"]
    catalog_parts.append("\n**IMPORTANTE**: Solo puedes usar ejercicios de este catálogo.")
    catalog_parts.append("Usa el `id` exacto del ejercicio en tu respuesta.")
    catalog_parts.append("Los músculos primarios (P) son los principales trabajados; los secundarios (S) son sinergistas.\n")

    for category, exs in sorted(grouped.items()):
        catalog_parts.append(f"\n### {category.upper()}")

        for ex in exs:
            ex_type = ex.get("type", "multiarticular")
            difficulty = ex.get("difficulty_level", "intermediate")
            equipment = ex.get("equipment_needed", "ninguno")

            # Construir string de músculos
            primary = ex.get("primary_muscles", [])
            secondary = ex.get("secondary_muscles", [])
            muscles_str = ""
            if primary:
                muscles_str = f"P: {', '.join(primary)}"
            if secondary:
                muscles_str += f" | S: {', '.join(secondary)}" if muscles_str else f"S: {', '.join(secondary)}"

            catalog_parts.append(
                f"- **{ex['name']}** (ID: `{ex['id']}`)\n"
                f"  - Tipo: {ex_type} | Dificultad: {difficulty} | Equipo: {equipment}\n"
                f"  - Músculos: {muscles_str if muscles_str else 'No especificados'}"
            )

    return "\n".join(catalog_parts)


def build_filtered_catalog(
    exercises: List[Dict[str, Any]],
    request: AIWorkoutRequest
) -> str:
    """
    Construye un catálogo FILTRADO de ejercicios para reducir tokens.
    Filtra por: objetivo, equipamiento disponible, restricciones, nivel.
    """
    if not exercises:
        return "## CATÁLOGO DE EJERCICIOS\n\nNo hay ejercicios disponibles."

    filtered = []
    goal = request.goals.primary_goal
    equipment = request.equipment
    restrictions = request.restrictions
    level = request.user_profile.fitness_level

    # Equipamiento disponible como strings
    available_equip = {e.value for e in equipment.available_equipment}
    if equipment.has_gym_access:
        available_equip.update(["barbell", "dumbbells", "cables", "machines", "bench", "squat_rack"])

    # Ejercicios excluidos
    excluded = set()
    if restrictions and restrictions.excluded_exercises:
        excluded = {ex.lower() for ex in restrictions.excluded_exercises}

    # Músculos objetivo para priorizar
    target_muscles = set()
    if request.goals.target_muscle_groups:
        target_muscles = {m.value for m in request.goals.target_muscle_groups}

    # Mapeo de objetivo a tipos de ejercicio preferidos
    goal_preferences = {
        PrimaryGoal.HYPERTROPHY: {"multiarticular", "monoarticular"},
        PrimaryGoal.STRENGTH: {"multiarticular"},
        PrimaryGoal.POWER: {"multiarticular"},
        PrimaryGoal.ENDURANCE: {"multiarticular", "monoarticular", "cardio"},
        PrimaryGoal.FAT_LOSS: {"multiarticular", "cardio"},
        PrimaryGoal.GENERAL_FITNESS: {"multiarticular", "monoarticular"},
    }
    preferred_types = goal_preferences.get(goal, {"multiarticular", "monoarticular"})

    # Filtrar ejercicios
    for ex in exercises:
        ex_name = ex.get("name", "").lower()
        ex_equip = ex.get("equipment_needed", "bodyweight").lower()
        ex_type = ex.get("type", "multiarticular").lower()
        ex_difficulty = ex.get("difficulty_level", "intermediate").lower()

        # Excluir por nombre
        if any(excl in ex_name for excl in excluded):
            continue

        # Filtrar por equipamiento
        if ex_equip not in available_equip and ex_equip != "bodyweight" and ex_equip != "ninguno":
            continue

        # Filtrar por nivel (principiantes no hacen ejercicios avanzados)
        if level == FitnessLevel.BEGINNER and ex_difficulty == "advanced":
            continue

        # Priorizar por tipo de ejercicio según objetivo
        if ex_type not in preferred_types and ex_type != "cardio":
            # Incluir pero con menor prioridad (para variedad)
            ex["_priority"] = 1
        else:
            ex["_priority"] = 2

        # Mayor prioridad si trabaja músculos objetivo
        primary = ex.get("primary_muscles", [])
        if target_muscles and any(m in target_muscles for m in primary):
            ex["_priority"] = 3

        filtered.append(ex)

    # Ordenar por prioridad y limitar si hay muchos
    filtered.sort(key=lambda x: x.get("_priority", 0), reverse=True)

    # Limitar a máximo 80 ejercicios para ahorrar tokens
    if len(filtered) > 80:
        filtered = filtered[:80]

    # Construir catálogo compacto
    catalog_parts = [f"## CATÁLOGO ({len(filtered)} ejercicios filtrados)"]
    catalog_parts.append("**Solo usa ejercicios de este catálogo con su ID exacto.**\n")

    # Agrupar por categoría
    grouped: Dict[str, List[Dict]] = {}
    for ex in filtered:
        cat = ex.get("category", "other")
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append(ex)

    for category, exs in sorted(grouped.items()):
        catalog_parts.append(f"\n### {category.upper()}")
        for ex in exs:
            primary = ex.get("primary_muscles", [])
            muscles = f"[{', '.join(primary[:2])}]" if primary else ""
            # Incluir clase de ejercicio si no es strength (default)
            ex_class = ex.get("exercise_class", "strength")
            class_tag = f" ({ex_class})" if ex_class != "strength" else ""
            catalog_parts.append(f"- {ex['name']} (`{ex['id']}`){class_tag} {muscles}")

    return "\n".join(catalog_parts)


def build_compressed_output_schema() -> str:
    """
    Schema comprimido para generación optimizada.
    Usa claves cortas para ahorrar tokens de salida.
    """
    return """## FORMATO DE RESPUESTA COMPRIMIDO

Para AHORRAR TOKENS, usa este formato compacto:

```json
{
  "m": {
    "n": "Nombre del programa",
    "d": "Descripción breve",
    "o": "hypertrophy",
    "ms": [
      {
        "b": 1,
        "n": "Fase 1",
        "f": "Acumulación",
        "mc": [
          {
            "w": 1,
            "n": "Semana 1",
            "i": "medium",
            "td": [
              {
                "d": 1,
                "n": "Push",
                "f": "Pecho/Hombros/Tríceps",
                "r": false,
                "ex": [
                  {"id": "uuid", "s": 3, "rm": 8, "rx": 12, "rs": 90, "et": "RIR", "ev": 2, "ph": "main"},
                  {"id": "uuid", "s": 2, "ds": 300, "rs": 0, "et": "RPE", "ev": 3, "ec": "warmup", "ph": "warmup"},
                  {"id": "uuid", "s": 1, "ds": 180, "rs": 0, "et": "RPE", "ev": 2, "ec": "mobility", "ph": "cooldown"}
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  "e": {
    "r": "Explicación breve",
    "p": "Estrategia progresión",
    "t": ["Tip 1"]
  }
}
```

## CLAVES:
- m=macrocycle, n=name, d=description, o=objective
- ms=mesocycles, b=block_number, f=focus
- mc=microcycles, w=week_number, i=intensity_level
- td=training_days, r=rest_day, ex=exercises
- id=exercise_id, s=sets, rm=reps_min, rx=reps_max
- rs=rest_seconds, et=effort_type, ev=effort_value
- ds=duration_seconds (para cardio), t=tempo, nt=notes
- ec=exercise_class (strength, cardio, plyometric, etc.)
- cs=cardio_subclass (liss, hiit, miss) - solo para cardio
- iz=intensity_zone (1-5) - zona HR para cardio
- ph=phase (warmup, main, cooldown) para separar calentamiento/bloque principal/enfriamiento
- e=explanation, p=progression, t=tips

## REGLAS:
1. **id**: DEBE ser UUID exacto del catálogo
2. Para cardio: usa "ds" (duration_seconds), rm/rx = null, incluir "cs" e "iz"
3. Para fuerza: usa "rm/rx" (reps), ds = null
4. Solo incluye campos con valor (omite nulls)
5. NO texto adicional, solo JSON

## EJEMPLOS DE EJERCICIOS POR CLASE:

### Fuerza (ec: "strength"):
{"id": "uuid", "ec": "strength", "s": 3, "rm": 8, "rx": 12, "rs": 90, "et": "RIR", "ev": 2}

### Cardio LISS (ec: "cardio", cs: "liss"):
{"id": "uuid", "ec": "cardio", "cs": "liss", "ds": 1800, "iz": 2, "rs": 0, "et": "RPE", "ev": 4}

### Cardio HIIT (ec: "cardio", cs: "hiit"):
{"id": "uuid", "ec": "cardio", "cs": "hiit", "ds": 900, "iz": 4, "rs": 30, "et": "RPE", "ev": 8}

### Pliométrico (ec: "plyometric"):
{"id": "uuid", "ec": "plyometric", "s": 3, "rm": 5, "rx": 8, "rs": 120, "et": "RIR", "ev": 4}"""


def build_base_week_prompt(request: AIWorkoutRequest) -> str:
    """
    Prompt para generar la SEMANA BASE detallada.
    Esta semana servirá como template para las siguientes.
    """
    return f"""## TAREA: GENERAR SEMANA BASE

Genera UNA semana de entrenamiento completa y detallada que servirá como BASE para el programa.

Esta semana debe incluir:
1. Distribución de días según disponibilidad ({request.availability.days_per_week} días)
2. Selección óptima de ejercicios para cada día
3. Volumen inicial apropiado para el nivel ({request.user_profile.fitness_level.value})
4. Intensidad inicial (RIR conservador para semana 1)

La respuesta será usada como TEMPLATE para generar las semanas siguientes con progresión automática.

Responde SOLO con JSON usando el formato comprimido."""


def build_progression_prompt(base_week_data: Dict[str, Any], total_weeks: int) -> str:
    """
    Prompt para generar la matriz de PROGRESIÓN basada en la semana base.
    Solo genera los cambios de parámetros, no la estructura completa.
    """
    return f"""## TAREA: GENERAR MATRIZ DE PROGRESIÓN

Ya tienes la SEMANA BASE. Ahora genera SOLO los cambios de parámetros para las semanas 2-{total_weeks}.

Semana base (referencia):
{json.dumps(base_week_data, indent=2)}

Para cada semana subsiguiente, indica SOLO los cambios respecto a la semana base:
- Incrementos de sets (si aplica)
- Ajustes de RIR/RPE según fase
- Cambios de intensidad (low/medium/high/deload)

Formato de respuesta:
```json
{{
  "progression": [
    {{
      "week": 2,
      "intensity": "medium",
      "changes": [
        {{"day": 1, "ex_idx": 0, "s": 4, "ev": 2}},
        {{"day": 1, "ex_idx": 1, "ev": 1}}
      ]
    }},
    {{
      "week": 3,
      "intensity": "high",
      "changes": [...]
    }}
  ],
  "deload_weeks": [4, 8, 12]
}}
```

REGLAS:
- Solo incluye ejercicios que CAMBIAN (omite los que mantienen valores base)
- "s" = sets, "ev" = effort_value, "rm/rx" = reps
- Semanas de deload: reducir volumen 40-50%
- Intensidad ondulante: low → medium → high → deload

Responde SOLO con JSON."""


def build_output_schema() -> str:
    """
    Construye las instrucciones del formato de salida JSON esperado.
    """
    return """## FORMATO DE RESPUESTA

Debes responder ÚNICAMENTE con un objeto JSON válido siguiendo esta estructura exacta:

```json
{
  "macrocycle": {
    "name": "string - Nombre descriptivo del programa",
    "description": "string - Descripción del programa",
    "objective": "string - Objetivo principal (hypertrophy/strength/power/endurance/fat_loss/general_fitness)",
    "mesocycles": [
      {
        "block_number": 1,
        "name": "string - Nombre del bloque (ej: 'Fase de Acumulación 1')",
        "focus": "string - Enfoque del bloque",
        "description": "string - Descripción opcional",
        "microcycles": [
          {
            "week_number": 1,
            "name": "string - Nombre de la semana (ej: 'Semana 1 - Adaptación')",
            "intensity_level": "low|medium|high|deload",
            "weekly_notes": "string - Notas opcionales para la semana",
            "training_days": [
              {
                "day_number": 1,
                "name": "string - Nombre del día (ej: 'Día 1 - Push')",
                "focus": "string - Enfoque (ej: 'Pecho, Hombros, Tríceps')",
                "rest_day": false,
                "warmup_notes": "string - Notas de calentamiento opcionales",
                "exercises": [
                  {
                    "exercise_id": "string - ID exacto del catálogo",
                    "exercise_name": "string - Nombre del ejercicio",
                    "order_index": 0,
                    "phase": "warmup|main|cooldown",
                    "sets": 3,
                    "reps_min": 8,
                    "reps_max": 12,
                    "duration_seconds": null,
                    "rest_seconds": 90,
                    "effort_type": "RIR",
                    "effort_value": 2,
                    "tempo": "2-0-2-0",
                    "notes": "string - Notas opcionales del ejercicio"
                  },
                  {
                    "exercise_id": "string - ID para cardio/isométrico",
                    "exercise_name": "string - Ejemplo: Plancha, Cardio, etc",
                    "order_index": 1,
                    "phase": "warmup|main|cooldown",
                    "sets": 3,
                    "reps_min": null,
                    "reps_max": null,
                    "duration_seconds": 60,
                    "rest_seconds": 30,
                    "effort_type": "RPE",
                    "effort_value": 7,
                    "tempo": null,
                    "notes": "Ejercicio basado en tiempo"
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  "explanation": {
    "rationale": "string - Explicación de por qué se diseñó este programa",
    "progression_strategy": "string - Cómo progresará el programa",
    "deload_strategy": "string - Estrategia de descarga si aplica",
    "volume_distribution": "string - Cómo se distribuye el volumen",
    "tips": ["string - Consejo 1", "string - Consejo 2"]
  }
}
```

## REGLAS DE VALIDACIÓN:

1. **exercise_id**: DEBE ser un ID exacto del catálogo de ejercicios proporcionado
2. **day_number**: Debe ser entre 1 y 14 (permite microciclos estándar de 7 días o extendidos hasta 14 días)
3. **sets**: Entre 1 y 10
4. **reps_min/reps_max vs duration_seconds**:
   - Para ejercicios de FUERZA: usar reps_min/reps_max (1-100), duration_seconds = null
   - Para ejercicios de CARDIO o ISOMÉTRICOS (plancha, saltar cuerda, bicicleta, etc): usar duration_seconds (10-3600 segundos), reps_min = null, reps_max = null
   - NUNCA uses reps > 50 para fuerza. Si necesitas más de 50 "reps", usa duration_seconds en su lugar
5. **rest_seconds**: Entre 30 y 300
6. **effort_type**: Solo "RIR", "RPE" o "percentage"
7. **effort_value**: 0-10 para RIR/RPE, 0-100 para percentage
8. **intensity_level**: Solo "low", "medium", "high" o "deload"
9. **phase**: Marca cada ejercicio con warmup/main/cooldown. Incluye calentamiento si include_warmup=true y al menos 1-2 ejercicios de cooldown ligero.

## IMPORTANTE:
- NO incluyas texto adicional fuera del JSON
- NO uses ejercicios que no estén en el catálogo
- Para ejercicios de cardio/isométricos SIEMPRE usa duration_seconds en lugar de reps
- ASEGÚRATE de que el JSON sea válido y parseable"""


def build_constraints(request: AIWorkoutRequest) -> str:
    """
    Construye restricciones específicas basadas en el perfil del usuario.
    Incluye límites de volumen calculados según objetivo y nivel.
    """
    constraints = ["## RESTRICCIONES DE GENERACIÓN"]

    profile = request.user_profile
    availability = request.availability
    equipment = request.equipment
    goals = request.goals

    constraints.append("""
### Alcance de esta generación (1 microciclo):
- Genera SOLO 1 microciclo/bloque en esta respuesta (sin progresiones adicionales).
- Usa `day_number` consecutivos (1..N). Puedes extender más de 7 días si necesitas más descanso; no inicies un segundo microciclo.
- Respeta descanso mínimo de 24h entre sesiones y 48h entre sesiones del mismo grupo muscular.
- Incluye al menos 1 día de descanso cada 3 sesiones seguidas.""")

    # Límites de ejercicios por sesión según nivel
    exercises_per_session = {
        FitnessLevel.BEGINNER: {"min": 3, "max": 4},
        FitnessLevel.INTERMEDIATE: {"min": 4, "max": 6},
        FitnessLevel.ADVANCED: {"min": 5, "max": 8},
    }

    # Obtener recomendaciones de volumen calculadas
    volume_rec = get_volume_recommendations(goals.primary_goal, profile.fitness_level)
    ex_limits = exercises_per_session.get(profile.fitness_level, {"min": 4, "max": 6})

    # Agregar límites de volumen calculados
    constraints.append(f"""
### Límites de Volumen Calculados (basados en objetivo: {goals.primary_goal.value} y nivel: {profile.fitness_level.value}):
- Series por grupo muscular por semana: {volume_rec['min_sets_per_muscle']}-{volume_rec['max_sets_per_muscle']}
- Ejercicios por sesión: {ex_limits['min']}-{ex_limits['max']} (OBLIGATORIO)
- **IMPORTANTE**: Respeta estrictamente estos límites de ejercicios por sesión""")

    # Restricciones por nivel
    if profile.fitness_level == FitnessLevel.BEGINNER:
        constraints.append("""
### Restricciones para Principiante:
- Priorizar ejercicios básicos y seguros
- RIR mínimo de 3 (no llevar al fallo)
- Evitar ejercicios técnicamente complejos
- Enfocarse en patrones de movimiento fundamentales""")
    elif profile.fitness_level == FitnessLevel.INTERMEDIATE:
        constraints.append("""
### Restricciones para Intermedio:
- Incluir variedad de ejercicios
- RIR de 1-3 según la fase del mesociclo
- Puede incluir ejercicios más técnicos
- Balance entre compuestos y aislamiento""")
    else:  # ADVANCED
        constraints.append("""
### Restricciones para Avanzado:
- Mayor variedad y técnicas avanzadas permitidas
- RIR de 0-2 en fases de intensificación
- Puede incluir superseries y técnicas de intensidad
- Periodización más compleja""")

    # Restricciones por tiempo
    if availability.session_duration_minutes < 45:
        constraints.append(f"""
### Restricciones de Tiempo ({availability.session_duration_minutes} min):
- Máximo 4 ejercicios por sesión
- Descansos cortos (60-90 segundos máximo)
- Priorizar ejercicios compuestos""")
    elif availability.session_duration_minutes < 60:
        constraints.append(f"""
### Restricciones de Tiempo ({availability.session_duration_minutes} min):
- Máximo 5-6 ejercicios por sesión
- Descansos moderados""")

    # Restricciones por equipamiento
    if not equipment.has_gym_access:
        constraints.append("""
### Restricciones de Equipamiento (Sin gimnasio):
- Solo usar ejercicios con el equipamiento disponible
- Adaptar ejercicios a versiones caseras cuando sea posible""")

    return "\n".join(constraints)


def assemble_final_prompt(
    request: AIWorkoutRequest,
    exercises: List[Dict[str, Any]]
) -> str:
    """
    Ensambla el prompt final combinando todas las secciones.
    """
    patient_context_block = build_patient_context_block(request.patient_context)

    sections = [
        build_user_context(request),
        patient_context_block,
        "",
        build_exercise_catalog(exercises),
        "",
        build_constraints(request),
        "",
        build_output_schema(),
        "",
        "## TAREA",
        "Genera SOLO UN microciclo (1 bloque) de entrenamiento para este usuario.",
        "Si necesitas más de 7 días para respetar descansos, extiende `day_number` de forma consecutiva.",
        f"Comienza el microciclo el {request.program_duration.start_date.isoformat()} y respeta los descansos mínimos indicados.",
        "",
        "Responde SOLO con el JSON, sin texto adicional."
    ]

    return "\n".join(sections)


def assemble_optimized_prompt(
    request: AIWorkoutRequest,
    exercises: List[Dict[str, Any]],
    use_filtered_catalog: bool = True,
    use_compressed_output: bool = True
) -> tuple[str, str]:
    """
    Ensambla prompts optimizados separando contenido CACHEABLE del específico.

    Returns:
        tuple: (cacheable_content, specific_content)
        - cacheable_content: System prompt + catálogo (para cache)
        - specific_content: Contexto del usuario específico
    """
    # Contenido CACHEABLE (estático o semi-estático)
    cacheable_parts = [
        build_system_prompt(),
        "",
        build_filtered_catalog(exercises, request) if use_filtered_catalog else build_exercise_catalog(exercises),
        "",
        build_compressed_output_schema() if use_compressed_output else build_output_schema(),
    ]
    cacheable_content = "\n".join(cacheable_parts)

    # Contenido ESPECÍFICO (cambia por cada request)
    patient_context_block = build_patient_context_block(request.patient_context)

    specific_parts = [
        build_user_context(request),
        patient_context_block,
        "",
        build_constraints(request),
        "",
        "## TAREA",
        "Genera SOLO UN microciclo (1 bloque) de entrenamiento para este usuario.",
        "Si necesitas más de 7 días para respetar descansos, extiende `day_number` de forma consecutiva.",
        f"Comienza el microciclo el {request.program_duration.start_date.isoformat()} y respeta los descansos mínimos indicados.",
        "",
        "Responde SOLO con JSON comprimido, sin texto adicional."
    ]
    specific_content = "\n".join(specific_parts)

    return cacheable_content, specific_content


def assemble_base_week_prompt(
    request: AIWorkoutRequest,
    exercises: List[Dict[str, Any]]
) -> tuple[str, str]:
    """
    Ensambla prompt para generar solo la SEMANA BASE.

    Returns:
        tuple: (cacheable_content, specific_content)
    """
    # Cacheable
    cacheable_parts = [
        build_system_prompt(),
        "",
        build_filtered_catalog(exercises, request),
        "",
        build_compressed_output_schema(),
    ]
    cacheable_content = "\n".join(cacheable_parts)

    # Específico para semana base
    specific_parts = [
        build_user_context(request),
        build_patient_context_block(request.patient_context),
        "",
        build_constraints(request),
        "",
        build_base_week_prompt(request),
    ]
    specific_content = "\n".join(specific_parts)

    return cacheable_content, specific_content


GenerationScope = Literal["preview", "full_short", "full_standard", "full_phased"]


def filter_exercises_for_request(
    exercises: List[Dict[str, Any]],
    request: AIWorkoutRequest,
) -> List[Dict[str, Any]]:
    """Filtra ejercicios por objetivo, equipo, restricciones y nivel sin mutar la entrada."""
    if not exercises:
        return []

    filtered: List[Dict[str, Any]] = []
    goal = request.goals.primary_goal
    equipment = request.equipment
    restrictions = request.restrictions
    level = request.user_profile.fitness_level

    available_equip = {e.value for e in equipment.available_equipment}
    if equipment.has_gym_access:
        available_equip.update(["barbell", "dumbbells", "cables", "machines", "bench", "squat_rack"])

    excluded = set()
    if restrictions and restrictions.excluded_exercises:
        excluded = {ex.lower() for ex in restrictions.excluded_exercises}

    target_muscles = set()
    if request.goals.target_muscle_groups:
        target_muscles = {m.value for m in request.goals.target_muscle_groups}

    goal_preferences = {
        PrimaryGoal.HYPERTROPHY: {"multiarticular", "monoarticular"},
        PrimaryGoal.STRENGTH: {"multiarticular"},
        PrimaryGoal.POWER: {"multiarticular"},
        PrimaryGoal.ENDURANCE: {"multiarticular", "monoarticular", "cardio"},
        PrimaryGoal.FAT_LOSS: {"multiarticular", "cardio"},
        PrimaryGoal.GENERAL_FITNESS: {"multiarticular", "monoarticular"},
    }
    preferred_types = goal_preferences.get(goal, {"multiarticular", "monoarticular"})

    for exercise in exercises:
        item = dict(exercise)
        ex_name = str(item.get("name", "")).lower()
        ex_equip = str(item.get("equipment_needed", "bodyweight")).lower()
        ex_type = str(item.get("type", "multiarticular")).lower()
        ex_class = str(item.get("exercise_class", "strength")).lower()
        ex_difficulty = str(item.get("difficulty_level", "intermediate")).lower()

        if any(excluded_name in ex_name for excluded_name in excluded):
            continue
        if ex_equip not in available_equip and ex_equip not in {"bodyweight", "ninguno", "none", ""}:
            continue
        if level == FitnessLevel.BEGINNER and ex_difficulty == "advanced":
            continue

        priority = 2
        if ex_type not in preferred_types and ex_class != "cardio":
            priority = 1

        primary = item.get("primary_muscles", [])
        if target_muscles and any(muscle in target_muscles for muscle in primary):
            priority = 3

        item["_priority"] = priority
        filtered.append(item)

    filtered.sort(key=lambda item: item.get("_priority", 0), reverse=True)
    if len(filtered) > 80:
        filtered = filtered[:80]

    return filtered


def build_slot_candidate_catalog(
    exercises: List[Dict[str, Any]],
    request: AIWorkoutRequest,
) -> tuple[SlotCatalogBuildResult, str]:
    filtered = filter_exercises_for_request(exercises, request)
    result = infer_slot_candidate_groups(filtered, request)
    if not result.groups:
        return result, ""
    return result, render_slot_candidate_groups(result.groups)


def build_compressed_output_schema_v2() -> str:
    """Schema comprimido con metadata opcional de slots."""
    return """## FORMATO DE RESPUESTA COMPRIMIDO

Usa este formato compacto cuando se solicite JSON comprimido:

```json
{
  "m": {
    "n": "Programa",
    "d": "Descripcion",
    "o": "hypertrophy",
    "ms": [
      {
        "b": 1,
        "n": "Bloque 1",
        "f": "Acumulacion",
        "mc": [
          {
            "w": 1,
            "n": "Semana 1",
            "i": "medium",
            "td": [
              {
                "d": 1,
                "n": "Push",
                "f": "Pecho",
                "r": false,
                "ex": [
                  {"id": "12", "n": "Bench Press", "s": 3, "rm": 8, "rx": 12, "rs": 90, "et": "RIR", "ev": 2, "ph": "main", "sr": "primary_horizontal_press", "sc": [12, 33, 71]}
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  "e": {
    "r": "Explicacion",
    "p": "Progresion",
    "t": ["Tip 1"]
  }
}
```

Claves extra opcionales:
- sr = slot_role
- sc = slot_candidate_ids

Responde SOLO con JSON."""


def build_output_schema_v2() -> str:
    """Schema expandido con metadata opcional de slots."""
    return """## FORMATO DE RESPUESTA

Debes responder con un JSON valido. Mantén `macrocycle` y `explanation` compatibles con el contrato actual.

Cada ejercicio puede incluir opcionalmente:
- `slot_role`: rol funcional del slot
- `slot_candidate_ids`: ids candidatos considerados para ese slot

Reglas:
1. `exercise_id` debe existir en el catalogo enviado.
2. Para cardio usa `duration_seconds`; para fuerza usa `reps_min/reps_max`.
3. No incluyas texto fuera del JSON."""


def build_constraints_v2(
    request: AIWorkoutRequest,
    *,
    generation_scope: GenerationScope,
) -> str:
    constraints = ["## RESTRICCIONES DE GENERACION"]
    base_constraints = build_constraints(request)

    if generation_scope == "preview":
        scope_block = """
### Scope
- Genera SOLO 1 microciclo de preview rapido.
- No generes progresiones ni semanas adicionales.
""".strip()
    elif generation_scope == "full_short":
        scope_block = """
### Scope
- Genera el programa completo solicitado de 1 semana.
- No lo reduzcas a preview.
""".strip()
    elif generation_scope == "full_standard":
        scope_block = f"""
### Scope
- Genera la duracion completa solicitada: {request.program_duration.total_weeks} semanas.
- Usa una semana base estable y progresiones locales.
- Mantén ejercicios estables en hipertrofia salvo justificacion clara.
""".strip()
    else:
        scope_block = f"""
### Scope
- Genera la duracion completa solicitada: {request.program_duration.total_weeks} semanas.
- Esta ruta es phased: base week + progression matrix + expansion local.
- Mantén ejercicios estables en hipertrofia salvo justificacion clara.
""".strip()

    constraints.append(scope_block)
    constraints.append(base_constraints)

    if request.goals.primary_goal == PrimaryGoal.HYPERTROPHY:
        constraints.append(
            """
### Regla de hipertrofia
- Prioriza cambios en sets, reps, effort_value, intensidad y deload.
- Solo cambia ejercicios por restriccion, equipo, monotonia solicitada, dolor o variante mas tolerable.
""".strip()
        )

    return "\n\n".join(part for part in constraints if part)


def build_slot_selection_prompt(
    request: AIWorkoutRequest,
    *,
    generation_scope: GenerationScope,
) -> str:
    return "\n".join(
        [
            "## INSTRUCCIONES DE SLOT SELECTION",
            f"- Scope de generacion: {generation_scope}",
            "- Elige 1 candidato por slot usando solo candidate groups listados.",
            "- Devuelve `slot_role` y `slot_candidate_ids` en cada ejercicio cuando uses slots.",
            "- Mantén estabilidad de ejercicios entre semanas.",
        ]
    )


def build_mesocycle_template_prompt(
    request: AIWorkoutRequest,
    *,
    generation_scope: GenerationScope,
) -> str:
    return "\n".join(
        [
            "## INSTRUCCIONES DE TEMPLATE DE MESOCICLO",
            f"- total_weeks={request.program_duration.total_weeks}",
            f"- mesocycle_weeks={request.program_duration.mesocycle_weeks}",
            f"- generation_scope={generation_scope}",
            "- No rehagas todas las semanas desde cero.",
            "- Usa una micro base estable y expande localmente el resto del programa.",
        ]
    )


def build_swap_rules_prompt(request: AIWorkoutRequest) -> str:
    restrictions = request.restrictions
    if not restrictions:
        return ""

    reasons = []
    if restrictions.injuries:
        reasons.append("lesion o molestia")
    if restrictions.excluded_exercises:
        reasons.append("ejercicio excluido")
    if restrictions.mobility_limitations:
        reasons.append("movilidad limitada")

    if not reasons:
        return ""

    return "\n".join(
        [
            "## AJUSTES Y SWAP RULES",
            f"- Solo sustituye ejercicios cuando exista {', '.join(reasons)}.",
            "- Si sustituyes un ejercicio, mantente dentro del mismo slot o en la variante mas tolerable del mismo patron.",
        ]
    )


def build_full_program_prompt(
    request: AIWorkoutRequest,
    *,
    generation_scope: GenerationScope,
    use_slot_candidates: bool,
    compressed: bool,
) -> str:
    task_lines = ["## TAREA"]

    if generation_scope == "preview":
        task_lines.append("Genera SOLO una preview de 1 microciclo.")
    elif generation_scope == "full_short":
        task_lines.append("Genera el programa completo solicitado de 1 semana.")
    else:
        task_lines.append(
            f"Genera el programa completo solicitado de {request.program_duration.total_weeks} semanas sin truncarlo."
        )

    task_lines.append(f"Comienza el programa el {request.program_duration.start_date.isoformat()}.")
    if use_slot_candidates:
        task_lines.append("Usa slot candidates como fuente principal de seleccion de ejercicios.")
    else:
        task_lines.append("Usa el catalogo filtrado como fuente principal de ejercicios.")
    if compressed:
        task_lines.append("Responde SOLO con JSON comprimido.")
    else:
        task_lines.append("Responde SOLO con JSON.")

    return "\n".join(task_lines)


def build_base_week_prompt_v2(
    request: AIWorkoutRequest,
    *,
    generation_scope: GenerationScope,
    use_slot_candidates: bool,
) -> str:
    lines = [
        "## TAREA: GENERAR SEMANA BASE",
        "Genera UNA semana base completa que servira como plantilla estable para el programa.",
        f"- Dias por semana disponibles: {request.availability.days_per_week}",
        f"- Nivel del usuario: {request.user_profile.fitness_level.value}",
        "- La semana base debe poder expandirse localmente a semanas posteriores.",
        "- Mantén estabilidad de ejercicios salvo justificacion clara.",
    ]
    if use_slot_candidates:
        lines.append("- Usa slot candidate groups y devuelve metadata de slot por ejercicio.")
    if generation_scope == "full_phased":
        lines.append("- Esta semana base alimenta un flujo phased para 4+ semanas.")
    else:
        lines.append("- Esta semana base alimenta un flujo estructurado para 2-3 semanas.")
    lines.append("Responde SOLO con JSON comprimido.")
    return "\n".join(lines)


def build_progression_prompt_v2(
    base_week_data: Dict[str, Any],
    total_weeks: int,
    *,
    slot_aware: bool,
) -> str:
    example_change = (
        '{"day": 1, "slot_role": "primary_horizontal_press", "s": 4, "ev": 1}'
        if slot_aware
        else '{"day": 1, "ex_idx": 0, "s": 4, "ev": 1}'
    )
    slot_rule = (
        "- Usa `slot_role` como referencia principal y `replace_candidate_id` solo si necesitas una sustitucion."
        if slot_aware
        else "- Usa `ex_idx` para referenciar el ejercicio."
    )
    return f"""## TAREA: GENERAR MATRIZ DE PROGRESION

Ya tienes la SEMANA BASE. Ahora genera SOLO los cambios de parametros para las semanas 2-{total_weeks}.

Semana base (referencia):
{json.dumps(base_week_data, indent=2)}

Formato de respuesta:
```json
{{
  "progression": [
    {{
      "week": 2,
      "intensity": "medium",
      "changes": [{example_change}]
    }}
  ],
  "deload_weeks": [4, 8, 12]
}}
```

REGLAS:
- Solo incluye ejercicios que cambian.
- Prioriza cambios en sets, reps, effort_value, intensidad y descanso.
- Reduce volumen 40-50% en deload.
{slot_rule}

Responde SOLO con JSON."""


def _build_catalog_section_v2(
    exercises: List[Dict[str, Any]],
    request: AIWorkoutRequest,
    *,
    use_filtered_catalog: bool,
    slot_catalog_result: Optional[SlotCatalogBuildResult],
    generation_scope: GenerationScope,
) -> str:
    if generation_scope != "preview" and slot_catalog_result and slot_catalog_result.eligible and slot_catalog_result.groups:
        return render_slot_candidate_groups(slot_catalog_result.groups)
    if use_filtered_catalog:
        return build_filtered_catalog(exercises, request)
    return build_exercise_catalog(exercises)


def assemble_program_prompt_v2(
    request: AIWorkoutRequest,
    exercises: List[Dict[str, Any]],
    *,
    generation_scope: GenerationScope,
    use_filtered_catalog: bool = True,
    use_compressed_output: bool = False,
    slot_catalog_result: Optional[SlotCatalogBuildResult] = None,
) -> str:
    patient_context_block = build_patient_context_block(request.patient_context)
    use_slot_candidates = bool(
        generation_scope != "preview"
        and slot_catalog_result
        and slot_catalog_result.eligible
        and slot_catalog_result.groups
    )

    sections = [
        build_user_context(request),
        patient_context_block,
        "",
        _build_catalog_section_v2(
            exercises,
            request,
            use_filtered_catalog=use_filtered_catalog,
            slot_catalog_result=slot_catalog_result,
            generation_scope=generation_scope,
        ),
        "",
        build_constraints_v2(request, generation_scope=generation_scope),
        "",
        build_compressed_output_schema_v2() if use_compressed_output else build_output_schema_v2(),
        "",
        build_slot_selection_prompt(request, generation_scope=generation_scope) if use_slot_candidates else "",
        build_mesocycle_template_prompt(request, generation_scope=generation_scope) if generation_scope in {"full_standard", "full_phased"} else "",
        build_swap_rules_prompt(request),
        "",
        build_full_program_prompt(
            request,
            generation_scope=generation_scope,
            use_slot_candidates=use_slot_candidates,
            compressed=use_compressed_output,
        ),
    ]
    return "\n".join(section for section in sections if section)


def assemble_optimized_program_prompt(
    request: AIWorkoutRequest,
    exercises: List[Dict[str, Any]],
    *,
    generation_scope: GenerationScope,
    use_filtered_catalog: bool = True,
    use_compressed_output: bool = True,
    slot_catalog_result: Optional[SlotCatalogBuildResult] = None,
) -> tuple[str, str]:
    patient_context_block = build_patient_context_block(request.patient_context)
    use_slot_candidates = bool(
        generation_scope != "preview"
        and slot_catalog_result
        and slot_catalog_result.eligible
        and slot_catalog_result.groups
    )

    cacheable_parts = [
        build_system_prompt(),
        "",
        _build_catalog_section_v2(
            exercises,
            request,
            use_filtered_catalog=use_filtered_catalog,
            slot_catalog_result=slot_catalog_result,
            generation_scope=generation_scope,
        ),
        "",
        build_compressed_output_schema_v2() if use_compressed_output else build_output_schema_v2(),
    ]
    cacheable_content = "\n".join(part for part in cacheable_parts if part)

    specific_parts = [
        build_user_context(request),
        patient_context_block,
        "",
        build_constraints_v2(request, generation_scope=generation_scope),
        "",
        build_slot_selection_prompt(request, generation_scope=generation_scope) if use_slot_candidates else "",
        build_mesocycle_template_prompt(request, generation_scope=generation_scope) if generation_scope in {"full_standard", "full_phased"} else "",
        build_swap_rules_prompt(request),
        "",
        build_full_program_prompt(
            request,
            generation_scope=generation_scope,
            use_slot_candidates=use_slot_candidates,
            compressed=use_compressed_output,
        ),
    ]
    specific_content = "\n".join(part for part in specific_parts if part)
    return cacheable_content, specific_content


def assemble_base_week_prompt_v2(
    request: AIWorkoutRequest,
    exercises: List[Dict[str, Any]],
    *,
    generation_scope: GenerationScope,
    slot_catalog_result: Optional[SlotCatalogBuildResult] = None,
) -> tuple[str, str]:
    patient_context_block = build_patient_context_block(request.patient_context)
    use_slot_candidates = bool(slot_catalog_result and slot_catalog_result.eligible and slot_catalog_result.groups)

    cacheable_parts = [
        build_system_prompt(),
        "",
        _build_catalog_section_v2(
            exercises,
            request,
            use_filtered_catalog=True,
            slot_catalog_result=slot_catalog_result,
            generation_scope=generation_scope,
        ),
        "",
        build_compressed_output_schema_v2(),
    ]
    cacheable_content = "\n".join(part for part in cacheable_parts if part)

    specific_parts = [
        build_user_context(request),
        patient_context_block,
        "",
        build_constraints_v2(request, generation_scope=generation_scope),
        "",
        build_slot_selection_prompt(request, generation_scope=generation_scope) if use_slot_candidates else "",
        build_mesocycle_template_prompt(request, generation_scope=generation_scope),
        build_swap_rules_prompt(request),
        "",
        build_base_week_prompt_v2(
            request,
            generation_scope=generation_scope,
            use_slot_candidates=use_slot_candidates,
        ),
    ]
    specific_content = "\n".join(part for part in specific_parts if part)
    return cacheable_content, specific_content


# =============== Funciones Auxiliares ===============

def _translate_goal(goal: PrimaryGoal) -> str:
    """Traduce el objetivo al español para el prompt."""
    translations = {
        PrimaryGoal.HYPERTROPHY: "Hipertrofia (ganancia muscular)",
        PrimaryGoal.STRENGTH: "Fuerza máxima",
        PrimaryGoal.POWER: "Potencia y explosividad",
        PrimaryGoal.ENDURANCE: "Resistencia muscular",
        PrimaryGoal.FAT_LOSS: "Pérdida de grasa",
        PrimaryGoal.GENERAL_FITNESS: "Fitness general y salud",
    }
    return translations.get(goal, goal.value)


def get_volume_recommendations(goal: PrimaryGoal, level: FitnessLevel) -> Dict[str, int]:
    """
    Retorna recomendaciones de volumen basadas en objetivo y nivel.
    """
    base_volume = {
        PrimaryGoal.HYPERTROPHY: {"min": 10, "max": 20},
        PrimaryGoal.STRENGTH: {"min": 6, "max": 12},
        PrimaryGoal.POWER: {"min": 4, "max": 8},
        PrimaryGoal.ENDURANCE: {"min": 12, "max": 20},
        PrimaryGoal.FAT_LOSS: {"min": 10, "max": 15},
        PrimaryGoal.GENERAL_FITNESS: {"min": 8, "max": 12},
    }

    level_modifier = {
        FitnessLevel.BEGINNER: 0.7,
        FitnessLevel.INTERMEDIATE: 1.0,
        FitnessLevel.ADVANCED: 1.2,
    }

    base = base_volume.get(goal, {"min": 8, "max": 12})
    modifier = level_modifier.get(level, 1.0)

    return {
        "min_sets_per_muscle": int(base["min"] * modifier),
        "max_sets_per_muscle": int(base["max"] * modifier),
    }
