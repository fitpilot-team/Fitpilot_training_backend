"""
Servicio de Generación de Entrenamientos con IA

Este servicio maneja la comunicación con Claude (Anthropic) para generar
programas de entrenamiento personalizados.
"""

import copy
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import date, timedelta

from anthropic import AsyncAnthropic
from pydantic import ValidationError

from core.config import settings
from schemas.ai_generator import (
    AIWorkoutRequest,
    AIWorkoutResponse,
    GenerationMetadata,
    GeneratedMacrocycle,
    GeneratedMesocycle,
    GeneratedMicrocycle,
    GeneratedTrainingDay,
    GeneratedDayExercise,
    ProgramExplanation,
    FitnessLevel,
)
from prompts.workout_generator import (
    build_system_prompt,
    assemble_program_prompt_v2,
    assemble_optimized_program_prompt,
    assemble_base_week_prompt_v2,
    build_progression_prompt_v2,
    build_slot_candidate_catalog,
)
from services.ai_slotting import (
    SlotCatalogBuildResult,
    SlotProgramTemplate,
    build_slot_program_template,
    estimate_prompt_tokens,
    infer_slot_role,
    normalize_exercise_id,
)

# Configurar logging para este módulo
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class AIWorkoutGenerator:
    """
    Generador de programas de entrenamiento usando IA.
    """

    def __init__(self):
        if not settings.ANTHROPIC_API_KEY:
            raise ValueError("ANTHROPIC_API_KEY no está configurada")

        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = settings.ANTHROPIC_MODEL
        self.timeout = 300.0  # 5 minutos para solicitudes largas
        self.base_max_tokens = 8192

    def _calculate_max_tokens(self, request: AIWorkoutRequest) -> int:
        """
        Calcula tokens necesarios según la duración del programa.
        Programas más largos necesitan más tokens de salida.
        """
        base = 8000  # Para estructura base y explicación
        weeks = request.program_duration.total_weeks
        days = request.availability.days_per_week
        tokens_per_day = 800  # Tokens por día de entrenamiento (con ejercicios detallados)

        estimated = base + (weeks * days * tokens_per_day)
        # Límite máximo aumentado para soportar programas largos
        return min(estimated, 64000)

    def _determine_generation_scope(self, request: AIWorkoutRequest) -> str:
        weeks = request.program_duration.total_weeks
        if weeks <= 1:
            return "full_short"
        if self._should_use_phased(request):
            return "full_phased"
        return "full_standard"

    def _build_slot_catalog_result(
        self,
        request: AIWorkoutRequest,
        available_exercises: List[Dict[str, Any]],
    ) -> SlotCatalogBuildResult:
        result, _ = build_slot_candidate_catalog(available_exercises, request)
        return result

    def _build_generation_metadata(
        self,
        *,
        generation_scope: str,
        slot_catalog_result: Optional[SlotCatalogBuildResult],
        used_slot_based_generation: bool,
        used_phased_generation: bool,
        progression_model: str,
    ) -> GenerationMetadata:
        candidate_group_count = slot_catalog_result.candidate_group_count if slot_catalog_result else 0
        flat_catalog_size = len(slot_catalog_result.flat_catalog_exercises) if slot_catalog_result else None
        slot_candidate_count = slot_catalog_result.total_candidates if slot_catalog_result else None
        return GenerationMetadata(
            generation_scope=generation_scope,
            used_slot_based_generation=used_slot_based_generation,
            used_phased_generation=used_phased_generation,
            progression_model=progression_model,
            template_version="slot_v1" if used_slot_based_generation else "flat_v1",
            candidate_group_count=candidate_group_count,
            flat_catalog_size=flat_catalog_size,
            slot_candidate_count=slot_candidate_count,
        )

    def _log_generation_context(
        self,
        *,
        request: AIWorkoutRequest,
        generation_scope: str,
        slot_catalog_result: Optional[SlotCatalogBuildResult],
        cacheable_content: str,
        specific_content: str,
    ) -> None:
        logger.info(
            "ai_generator.generation.context",
            extra={
                "generation_scope": generation_scope,
                "total_weeks": request.program_duration.total_weeks,
                "used_slot_based_generation": bool(
                    slot_catalog_result and slot_catalog_result.eligible and slot_catalog_result.groups
                ),
                "used_phased_generation": generation_scope == "full_phased",
                "candidate_group_count": slot_catalog_result.candidate_group_count if slot_catalog_result else 0,
                "flat_catalog_size": len(slot_catalog_result.flat_catalog_exercises) if slot_catalog_result else 0,
                "slot_candidate_count": slot_catalog_result.total_candidates if slot_catalog_result else 0,
                "cacheable_chars": len(cacheable_content),
                "specific_chars": len(specific_content),
                "cacheable_tokens_est": estimate_prompt_tokens(cacheable_content),
                "specific_tokens_est": estimate_prompt_tokens(specific_content),
            },
        )

    def _build_response_from_parsed(
        self,
        *,
        request: AIWorkoutRequest,
        parsed_data: Dict[str, Any],
        available_exercises: List[Dict[str, Any]],
        generation_scope: str,
        slot_catalog_result: Optional[SlotCatalogBuildResult],
        used_slot_based_generation: bool,
        used_phased_generation: bool,
        progression_model: str,
    ) -> AIWorkoutResponse:
        if settings.AI_USE_COMPRESSED_OUTPUT and "m" in parsed_data:
            parsed_data = self._expand_compressed_response(parsed_data)

        exercise_ids = {ex["id"] for ex in available_exercises}
        warnings = self._validate_exercises(parsed_data, exercise_ids)
        warnings.extend(self._validate_session_limits(
            parsed_data, request.user_profile.fitness_level
        ))
        self._calculate_dates(parsed_data, request.program_duration.start_date)

        metadata = self._build_generation_metadata(
            generation_scope=generation_scope,
            slot_catalog_result=slot_catalog_result,
            used_slot_based_generation=used_slot_based_generation,
            used_phased_generation=used_phased_generation,
            progression_model=progression_model,
        )

        try:
            macrocycle = GeneratedMacrocycle(**parsed_data["macrocycle"])
            explanation = None
            if "explanation" in parsed_data:
                explanation = ProgramExplanation(**parsed_data["explanation"])

            return AIWorkoutResponse(
                success=True,
                macrocycle=macrocycle,
                explanation=explanation,
                generation_metadata=metadata,
                warnings=warnings,
            )
        except ValidationError as e:
            logger.error(f"Error de validacion: {e}")
            return AIWorkoutResponse(
                success=False,
                error=f"Error de validacion: {str(e)}",
                generation_metadata=metadata,
                warnings=warnings,
            )

    async def generate_workout(
        self,
        request: AIWorkoutRequest,
        available_exercises: List[Dict[str, Any]]
    ) -> AIWorkoutResponse:
        """
        Genera un programa de entrenamiento completo con optimizaciones.
        Usa Prompt Caching y formato comprimido para reducir tokens.

        Args:
            request: Datos del cuestionario del usuario
            available_exercises: Lista de ejercicios disponibles en la DB

        Returns:
            AIWorkoutResponse con el programa generado o error
        """
        try:
            # Seleccionar método de generación
            generation_scope = self._determine_generation_scope(request)
            slot_catalog_result = self._build_slot_catalog_result(request, available_exercises)

            if generation_scope == "full_phased":
                return await self._generate_phased(
                    request,
                    available_exercises,
                    generation_scope=generation_scope,
                    slot_catalog_result=slot_catalog_result,
                )
            if generation_scope == "full_standard":
                return await self._generate_structured_program(
                    request,
                    available_exercises,
                    generation_scope=generation_scope,
                    slot_catalog_result=slot_catalog_result,
                )
            if settings.AI_USE_PROMPT_CACHING:
                return await self._generate_with_caching(
                    request,
                    available_exercises,
                    generation_scope=generation_scope,
                    slot_catalog_result=slot_catalog_result,
                )
            return await self._generate_legacy(
                request,
                available_exercises,
                generation_scope=generation_scope,
                slot_catalog_result=slot_catalog_result,
            )

        except Exception as e:
            error_type = type(e).__name__
            logger.exception(f"Error generando programa [{error_type}]: {e}")

            if "timeout" in str(e).lower():
                error_msg = "La generación tardó demasiado. Intenta con un programa más corto."
            elif "api_key" in str(e).lower() or "authentication" in str(e).lower():
                error_msg = "Error de autenticación con el servicio de IA. Contacta al administrador."
            elif "rate_limit" in str(e).lower():
                error_msg = "Se ha excedido el límite de solicitudes. Espera unos minutos e intenta de nuevo."
            else:
                error_msg = f"Error de generación: {str(e)}"

            return AIWorkoutResponse(success=False, error=error_msg)

    async def _generate_with_caching(
        self,
        request: AIWorkoutRequest,
        available_exercises: List[Dict[str, Any]],
        *,
        generation_scope: str,
        slot_catalog_result: Optional[SlotCatalogBuildResult],
    ) -> AIWorkoutResponse:
        """
        Genera programa usando Prompt Caching de Anthropic.
        Separa contenido cacheable (system + catálogo) del específico.
        """
        cacheable_content, specific_content = assemble_optimized_program_prompt(
            request,
            available_exercises,
            generation_scope=generation_scope,
            use_filtered_catalog=settings.AI_FILTER_CATALOG,
            use_compressed_output=settings.AI_USE_COMPRESSED_OUTPUT,
            slot_catalog_result=slot_catalog_result,
        )

        max_tokens = self._calculate_max_tokens(request)

        self._log_generation_context(
            request=request,
            generation_scope=generation_scope,
            slot_catalog_result=slot_catalog_result,
            cacheable_content=cacheable_content,
            specific_content=specific_content,
        )

        # Llamar a Claude con Prompt Caching
        # El contenido cacheable va primero con cache_control
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": cacheable_content,
                            "cache_control": {"type": "ephemeral"}
                        },
                        {
                            "type": "text",
                            "text": specific_content
                        }
                    ]
                }
            ],
            timeout=self.timeout
        )

        raw_content = response.content[0].text
        logger.info(f"Respuesta recibida ({len(raw_content)} chars)")

        # Log de uso de cache
        usage = response.usage
        logger.info(
            f"Usage: input={usage.input_tokens}, output={usage.output_tokens}, "
            f"cache_read={getattr(usage, 'cache_read_input_tokens', 0)}, "
            f"cache_creation={getattr(usage, 'cache_creation_input_tokens', 0)}"
        )

        # Parsear respuesta (puede ser comprimida o normal)
        parsed_data = self._parse_response(raw_content)

        if parsed_data is None:
            return AIWorkoutResponse(
                success=False,
                error="No se pudo parsear la respuesta de la IA"
            )

        return self._build_response_from_parsed(
            request=request,
            parsed_data=parsed_data,
            available_exercises=available_exercises,
            generation_scope=generation_scope,
            slot_catalog_result=slot_catalog_result,
            used_slot_based_generation=bool(
                slot_catalog_result and slot_catalog_result.eligible and slot_catalog_result.groups
            ),
            used_phased_generation=False,
            progression_model="one_shot",
        )

        # Si la respuesta está comprimida, expandirla
        if settings.AI_USE_COMPRESSED_OUTPUT and "m" in parsed_data:
            parsed_data = self._expand_compressed_response(parsed_data)

        # Validaciones
        exercise_ids = {ex["id"] for ex in available_exercises}
        warnings = self._validate_exercises(parsed_data, exercise_ids)
        warnings.extend(self._validate_session_limits(
            parsed_data, request.user_profile.fitness_level
        ))

        # Agregar fechas
        self._calculate_dates(parsed_data, request.program_duration.start_date)

        # Construir respuesta
        try:
            macrocycle = GeneratedMacrocycle(**parsed_data["macrocycle"])
            explanation = None
            if "explanation" in parsed_data:
                explanation = ProgramExplanation(**parsed_data["explanation"])

            return AIWorkoutResponse(
                success=True,
                macrocycle=macrocycle,
                explanation=explanation,
                warnings=warnings
            )
        except ValidationError as e:
            logger.error(f"Error de validación: {e}")
            return AIWorkoutResponse(
                success=False,
                error=f"Error de validación: {str(e)}",
                warnings=warnings
            )

    async def _generate_legacy(
        self,
        request: AIWorkoutRequest,
        available_exercises: List[Dict[str, Any]],
        *,
        generation_scope: str,
        slot_catalog_result: Optional[SlotCatalogBuildResult],
    ) -> AIWorkoutResponse:
        """
        Generación legacy sin optimizaciones (fallback).
        """
        system_prompt = build_system_prompt()
        user_prompt = assemble_program_prompt_v2(
            request,
            available_exercises,
            generation_scope=generation_scope,
            use_filtered_catalog=settings.AI_FILTER_CATALOG,
            use_compressed_output=False,
            slot_catalog_result=slot_catalog_result,
        )
        max_tokens = self._calculate_max_tokens(request)

        logger.info(
            f"Generando programa LEGACY para cliente {request.client_id} "
            f"({request.program_duration.total_weeks} semanas, max_tokens={max_tokens})"
        )

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
            timeout=self.timeout
        )

        raw_content = response.content[0].text
        logger.info(f"Respuesta recibida ({len(raw_content)} chars)")
        logger.info(f"Usage: input={response.usage.input_tokens}, output={response.usage.output_tokens}")

        parsed_data = self._parse_response(raw_content)

        if parsed_data is None:
            return AIWorkoutResponse(
                success=False,
                error="No se pudo parsear la respuesta de la IA"
            )

        return self._build_response_from_parsed(
            request=request,
            parsed_data=parsed_data,
            available_exercises=available_exercises,
            generation_scope=generation_scope,
            slot_catalog_result=slot_catalog_result,
            used_slot_based_generation=bool(
                slot_catalog_result and slot_catalog_result.eligible and slot_catalog_result.groups
            ),
            used_phased_generation=False,
            progression_model="legacy_one_shot",
        )

        exercise_ids = {ex["id"] for ex in available_exercises}
        warnings = self._validate_exercises(parsed_data, exercise_ids)
        warnings.extend(self._validate_session_limits(
            parsed_data, request.user_profile.fitness_level
        ))

        self._calculate_dates(parsed_data, request.program_duration.start_date)

        try:
            macrocycle = GeneratedMacrocycle(**parsed_data["macrocycle"])
            explanation = None
            if "explanation" in parsed_data:
                explanation = ProgramExplanation(**parsed_data["explanation"])

            return AIWorkoutResponse(
                success=True,
                macrocycle=macrocycle,
                explanation=explanation,
                warnings=warnings
            )
        except ValidationError as e:
            logger.error(f"Error de validación: {e}")
            return AIWorkoutResponse(
                success=False,
                error=f"Error de validación: {str(e)}",
                warnings=warnings
            )

    def _should_use_phased(self, request: AIWorkoutRequest) -> bool:
        """
        Determina si usar generación en fases.
        Solo para programas de 4+ semanas cuando está habilitado.
        """
        if not settings.AI_USE_PHASED_GENERATION:
            return False

        # Solo usar fases para programas de 4+ semanas
        if request.program_duration.total_weeks < 4:
            return False

        return True

    def _flat_only_slot_catalog(
        self,
        available_exercises: List[Dict[str, Any]],
    ) -> SlotCatalogBuildResult:
        return SlotCatalogBuildResult(flat_catalog_exercises=list(available_exercises))

    def _hydrate_slot_metadata(
        self,
        data: Dict[str, Any],
        slot_catalog_result: Optional[SlotCatalogBuildResult],
    ) -> Dict[str, Any]:
        if not slot_catalog_result or not slot_catalog_result.groups:
            return data

        macrocycle = data.get("macrocycle", {})
        group_map = slot_catalog_result.group_map
        for mesocycle in macrocycle.get("mesocycles", []):
            for microcycle in mesocycle.get("microcycles", []):
                for day in microcycle.get("training_days", []):
                    for exercise in day.get("exercises", []):
                        slot_role = exercise.get("slot_role") or infer_slot_role(exercise)
                        if not slot_role:
                            continue
                        exercise["slot_role"] = slot_role
                        if not exercise.get("slot_candidate_ids") and slot_role in group_map:
                            exercise["slot_candidate_ids"] = group_map[slot_role].candidate_ids
        return data

    async def _run_structured_generation(
        self,
        request: AIWorkoutRequest,
        available_exercises: List[Dict[str, Any]],
        *,
        generation_scope: str,
        slot_catalog_result: Optional[SlotCatalogBuildResult],
        used_phased_generation: bool,
    ) -> AIWorkoutResponse:
        cacheable, specific = assemble_base_week_prompt_v2(
            request,
            available_exercises,
            generation_scope=generation_scope,
            slot_catalog_result=slot_catalog_result,
        )
        self._log_generation_context(
            request=request,
            generation_scope=generation_scope,
            slot_catalog_result=slot_catalog_result,
            cacheable_content=cacheable,
            specific_content=specific,
        )

        try:
            base_response = await self.client.messages.create(
                model=self.model,
                max_tokens=4000,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": cacheable, "cache_control": {"type": "ephemeral"}},
                        {"type": "text", "text": specific},
                    ],
                }],
                timeout=self.timeout,
            )
        except Exception:
            logger.exception("ai_generator.structured.base_week.failed")
            return await self._generate_with_caching(
                request,
                available_exercises,
                generation_scope=generation_scope,
                slot_catalog_result=self._flat_only_slot_catalog(available_exercises),
            )

        base_week = self._parse_response(base_response.content[0].text)
        if base_week is None:
            logger.warning("ai_generator.structured.base_week.parse_failed")
            return await self._generate_with_caching(
                request,
                available_exercises,
                generation_scope=generation_scope,
                slot_catalog_result=self._flat_only_slot_catalog(available_exercises),
            )

        expanded_base_week = self._expand_compressed_response(base_week) if "m" in base_week else copy.deepcopy(base_week)
        expanded_base_week = self._hydrate_slot_metadata(expanded_base_week, slot_catalog_result)
        template: SlotProgramTemplate = build_slot_program_template(expanded_base_week, slot_catalog_result)

        progression_prompt = build_progression_prompt_v2(
            expanded_base_week,
            request.program_duration.total_weeks,
            slot_aware=bool(slot_catalog_result and slot_catalog_result.eligible and template.template_days),
        )
        try:
            progression_response = await self.client.messages.create(
                model=self.model,
                max_tokens=2000,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": cacheable, "cache_control": {"type": "ephemeral"}},
                        {"type": "text", "text": progression_prompt},
                    ],
                }],
                timeout=self.timeout,
            )
        except Exception:
            logger.exception("ai_generator.structured.progression.failed")
            return await self._generate_with_caching(
                request,
                available_exercises,
                generation_scope=generation_scope,
                slot_catalog_result=self._flat_only_slot_catalog(available_exercises),
            )

        progression = self._parse_response(progression_response.content[0].text)
        if progression is None:
            logger.warning("ai_generator.structured.progression.parse_failed")
            progression = self._default_progression(
                request.program_duration.total_weeks,
                request.program_duration.include_deload,
            )

        template.progression_rules = progression.get("progression", [])
        full_program = self._apply_progression(expanded_base_week, progression, request)
        return self._build_response_from_parsed(
            request=request,
            parsed_data=full_program,
            available_exercises=available_exercises,
            generation_scope=generation_scope,
            slot_catalog_result=slot_catalog_result,
            used_slot_based_generation=bool(slot_catalog_result and slot_catalog_result.eligible and template.template_days),
            used_phased_generation=used_phased_generation,
            progression_model="base_week_progression",
        )

    async def _generate_structured_program(
        self,
        request: AIWorkoutRequest,
        available_exercises: List[Dict[str, Any]],
        *,
        generation_scope: str,
        slot_catalog_result: Optional[SlotCatalogBuildResult],
    ) -> AIWorkoutResponse:
        return await self._run_structured_generation(
            request,
            available_exercises,
            generation_scope=generation_scope,
            slot_catalog_result=slot_catalog_result,
            used_phased_generation=False,
        )

    async def _generate_phased(
        self,
        request: AIWorkoutRequest,
        available_exercises: List[Dict[str, Any]],
        *,
        generation_scope: str,
        slot_catalog_result: Optional[SlotCatalogBuildResult],
    ) -> AIWorkoutResponse:
        """
        Generación en fases: semana base + progresiones.
        Ahorra ~60-70% de tokens en programas largos.

        Fase 1: Genera 1 semana base completa
        Fase 2: Genera matriz de progresión (solo deltas)
        Fase 3: Expande localmente el programa completo
        """
        return await self._run_structured_generation(
            request,
            available_exercises,
            generation_scope=generation_scope,
            slot_catalog_result=slot_catalog_result,
            used_phased_generation=True,
        )

        total_weeks = request.program_duration.total_weeks

        logger.info(
            f"Generando programa EN FASES para cliente {request.client_id} "
            f"({total_weeks} semanas)"
        )

        # FASE 1: Generar semana base
        cacheable, specific = assemble_base_week_prompt(request, available_exercises)

        logger.info(f"[FASE 1] Generando semana base...")
        logger.info(f"Cacheable content: {len(cacheable)} chars")
        logger.info(f"Specific content: {len(specific)} chars")

        base_response = await self.client.messages.create(
            model=self.model,
            max_tokens=4000,  # Solo 1 semana
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": cacheable, "cache_control": {"type": "ephemeral"}},
                    {"type": "text", "text": specific}
                ]
            }],
            timeout=self.timeout
        )

        base_raw = base_response.content[0].text
        logger.info(f"[FASE 1] Respuesta recibida ({len(base_raw)} chars)")

        # Log de uso de cache
        usage1 = base_response.usage
        logger.info(
            f"[FASE 1] Usage: input={usage1.input_tokens}, output={usage1.output_tokens}, "
            f"cache_read={getattr(usage1, 'cache_read_input_tokens', 0)}, "
            f"cache_creation={getattr(usage1, 'cache_creation_input_tokens', 0)}"
        )

        base_week = self._parse_response(base_raw)
        if base_week is None:
            return AIWorkoutResponse(
                success=False,
                error="No se pudo parsear la semana base"
            )

        # FASE 2: Generar matriz de progresión
        logger.info(f"[FASE 2] Generando progresión para {total_weeks} semanas...")

        progression_prompt = build_progression_prompt(base_week, total_weeks)

        progression_response = await self.client.messages.create(
            model=self.model,
            max_tokens=2000,  # Solo deltas
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": cacheable, "cache_control": {"type": "ephemeral"}},
                    {"type": "text", "text": progression_prompt}
                ]
            }],
            timeout=self.timeout
        )

        progression_raw = progression_response.content[0].text
        logger.info(f"[FASE 2] Respuesta recibida ({len(progression_raw)} chars)")

        # Log de uso de cache (debería leer del cache)
        usage2 = progression_response.usage
        logger.info(
            f"[FASE 2] Usage: input={usage2.input_tokens}, output={usage2.output_tokens}, "
            f"cache_read={getattr(usage2, 'cache_read_input_tokens', 0)}, "
            f"cache_creation={getattr(usage2, 'cache_creation_input_tokens', 0)}"
        )

        progression = self._parse_response(progression_raw)
        if progression is None:
            # Fallback: usar progresión por defecto
            logger.warning("No se pudo parsear progresión, usando valores por defecto")
            progression = self._default_progression(total_weeks, request.program_duration.include_deload)

        # FASE 3: Expandir programa completo
        logger.info(f"[FASE 3] Expandiendo programa completo...")

        full_program = self._apply_progression(base_week, progression, request)

        # Validaciones
        exercise_ids = {ex["id"] for ex in available_exercises}
        warnings = self._validate_exercises(full_program, exercise_ids)
        warnings.extend(self._validate_session_limits(
            full_program, request.user_profile.fitness_level
        ))

        # Agregar fechas
        self._calculate_dates(full_program, request.program_duration.start_date)

        # Log de ahorro total
        total_input = usage1.input_tokens + usage2.input_tokens
        total_output = usage1.output_tokens + usage2.output_tokens
        total_cache_read = getattr(usage1, 'cache_read_input_tokens', 0) + getattr(usage2, 'cache_read_input_tokens', 0)
        logger.info(
            f"[TOTALES] input={total_input}, output={total_output}, cache_read={total_cache_read}"
        )

        # Construir respuesta
        try:
            macrocycle = GeneratedMacrocycle(**full_program["macrocycle"])

            # Crear explicación basada en el programa
            explanation = ProgramExplanation(
                rationale=f"Programa de {total_weeks} semanas diseñado para {request.goals.primary_goal.value}",
                progression_strategy="Progresión ondulante con incremento gradual de volumen e intensidad",
                deload_strategy="Semanas de descarga cada 3-4 semanas para optimizar recuperación",
                volume_distribution=f"Distribución balanceada según disponibilidad ({request.availability.days_per_week} días/semana)",
                tips=[
                    "Mantén un registro de tus pesos para asegurar progresión",
                    "Respeta los tiempos de descanso indicados",
                    "Ajusta las cargas según tu sensación de esfuerzo (RIR)"
                ]
            )

            return AIWorkoutResponse(
                success=True,
                macrocycle=macrocycle,
                explanation=explanation,
                warnings=warnings
            )
        except ValidationError as e:
            logger.error(f"Error de validación: {e}")
            return AIWorkoutResponse(
                success=False,
                error=f"Error de validación: {str(e)}",
                warnings=warnings
            )

    def _default_progression(self, total_weeks: int, include_deload: bool) -> Dict[str, Any]:
        """
        Genera una progresión por defecto si la IA no la proporciona.
        """
        progression = []
        deload_weeks = []

        for week in range(2, total_weeks + 1):
            # Determinar intensidad ondulante
            week_in_block = (week - 1) % 4
            if week_in_block == 0:
                intensity = "low"
            elif week_in_block == 1:
                intensity = "medium"
            elif week_in_block == 2:
                intensity = "high"
            else:  # week_in_block == 3
                if include_deload:
                    intensity = "deload"
                    deload_weeks.append(week)
                else:
                    intensity = "medium"

            progression.append({
                "week": week,
                "intensity": intensity,
                "changes": []  # Sin cambios específicos, usar valores base
            })

        return {
            "progression": progression,
            "deload_weeks": deload_weeks
        }

    def _apply_progression(
        self,
        base_week: Dict[str, Any],
        progression: Dict[str, Any],
        request: AIWorkoutRequest
    ) -> Dict[str, Any]:
        """
        Aplica la matriz de progresión a la semana base para generar
        el programa completo de N semanas.
        """
        total_weeks = request.program_duration.total_weeks
        mesocycle_weeks = request.program_duration.mesocycle_weeks
        deload_weeks = set(progression.get("deload_weeks", []))

        # Obtener datos de la semana base (puede estar en formato comprimido o normal)
        if "m" in base_week:
            base_data = base_week["m"]
            # Formato comprimido: m.ms[0].mc[0] contiene los training days
            mesos = base_data.get("ms", [])
            if mesos:
                base_microcycle = mesos[0].get("mc", [{}])[0] if mesos[0].get("mc") else {}
            else:
                base_microcycle = base_data.get("mc", [{}])[0] if base_data.get("mc") else {}
        else:
            base_data = base_week.get("macrocycle", {})
            mesos = base_data.get("mesocycles", [{}])
            base_microcycle = mesos[0].get("microcycles", [{}])[0] if mesos else {}

        # Estructura base del macrocycle
        macrocycle = {
            "name": f"Programa {request.goals.primary_goal.value.title()} {total_weeks} Semanas",
            "description": base_data.get("d", base_data.get("description", "")),
            "objective": request.goals.primary_goal.value,
            "mesocycles": []
        }

        # Calcular número de mesocycles
        num_mesocycles = (total_weeks + mesocycle_weeks - 1) // mesocycle_weeks

        week_counter = 1
        for meso_num in range(1, num_mesocycles + 1):
            mesocycle = {
                "block_number": meso_num,
                "name": f"Bloque {meso_num}",
                "focus": self._get_meso_focus(meso_num, request.goals.primary_goal),
                "description": "",
                "microcycles": []
            }

            weeks_in_meso = min(mesocycle_weeks, total_weeks - week_counter + 1)

            for week_in_meso in range(1, weeks_in_meso + 1):
                # Obtener cambios de progresión para esta semana
                week_changes = self._get_week_changes(progression, week_counter)

                # Determinar intensidad
                if week_counter in deload_weeks:
                    intensity = "deload"
                elif week_counter == 1:
                    intensity = "low"  # Primera semana siempre es adaptación
                else:
                    intensity = week_changes.get("intensity", "medium")

                microcycle = {
                    "week_number": week_in_meso,
                    "name": f"Semana {week_counter}" + (" - Deload" if intensity == "deload" else ""),
                    "intensity_level": intensity,
                    "weekly_notes": "",
                    "training_days": []
                }

                # Obtener días de la semana base
                if "td" in base_microcycle:
                    base_days = base_microcycle.get("td", [])
                else:
                    base_days = base_microcycle.get("training_days", [])

                # Aplicar cambios a cada día
                for td in base_days:
                    # Clonar y expandir el día
                    day = copy.deepcopy(td)
                    day = self._expand_training_day(day)

                    # Aplicar deltas de ejercicios
                    for change in week_changes.get("changes", []):
                        if change.get("day") == day.get("day_number"):
                            self._apply_exercise_change(day, change)

                    # Aplicar reducción de deload
                    if intensity == "deload":
                        self._apply_deload(day)

                    microcycle["training_days"].append(day)

                mesocycle["microcycles"].append(microcycle)
                week_counter += 1

                if week_counter > total_weeks:
                    break

            macrocycle["mesocycles"].append(mesocycle)

        return {"macrocycle": macrocycle}

    def _expand_training_day(self, td: Dict[str, Any]) -> Dict[str, Any]:
        """
        Expande un training day del formato comprimido al formato completo.
        """
        # Si ya está expandido, retornar
        if "exercises" in td and isinstance(td.get("exercises"), list):
            # Ya está en formato expandido, solo asegurar campos
            if "day_number" not in td and "d" in td:
                td["day_number"] = td.pop("d")
            if "name" not in td and "n" in td:
                td["name"] = td.pop("n")
            return td

        # Expandir desde formato comprimido
        expanded = {
            "day_number": td.get("d", td.get("day_number", 1)),
            "name": td.get("n", td.get("name", f"Día {td.get('d', 1)}")),
            "focus": td.get("f", td.get("focus", "")),
            "rest_day": td.get("r", td.get("rest_day", False)),
            "warmup_notes": td.get("wn", td.get("warmup_notes", "")),
            "exercises": []
        }

        # Expandir ejercicios
        exercises = td.get("ex", td.get("exercises", []))
        for idx, ex in enumerate(exercises):
            if isinstance(ex, dict):
                exercise = {
                    "exercise_id": ex.get("id", ex.get("exercise_id", "")),
                    "exercise_name": ex.get("n", ex.get("exercise_name", "")),
                    "order_index": ex.get("o", ex.get("order_index", idx)),
                    "phase": ex.get("ph", ex.get("phase", "main")),
                    "sets": ex.get("s", ex.get("sets", 3)),
                    # Clasificación del ejercicio
                    "exercise_class": ex.get("ec", ex.get("exercise_class", "strength")),
                    "cardio_subclass": ex.get("cs", ex.get("cardio_subclass")),
                    "intensity_zone": ex.get("iz", ex.get("intensity_zone")),
                    # Parámetros de entrenamiento
                    "reps_min": ex.get("rm", ex.get("reps_min")),
                    "reps_max": ex.get("rx", ex.get("reps_max")),
                    "duration_seconds": ex.get("ds", ex.get("duration_seconds")),
                    "rest_seconds": ex.get("rs", ex.get("rest_seconds", 90)),
                    "effort_type": ex.get("et", ex.get("effort_type", "RIR")),
                    "effort_value": ex.get("ev", ex.get("effort_value", 2)),
                    "tempo": ex.get("t", ex.get("tempo")),
                    "notes": ex.get("nt", ex.get("notes", "")),
                    "slot_role": ex.get("sr", ex.get("slot_role")),
                    "slot_candidate_ids": ex.get("sc", ex.get("slot_candidate_ids")),
                }
                expanded["exercises"].append(exercise)

        return expanded

    def _get_meso_focus(self, meso_num: int, primary_goal) -> str:
        """
        Determina el foco del mesociclo según el número y objetivo.
        """
        goal_value = primary_goal.value if hasattr(primary_goal, 'value') else str(primary_goal)

        if goal_value == "hypertrophy":
            focuses = ["Acumulación", "Intensificación", "Realización", "Deload/Transición"]
        elif goal_value == "strength":
            focuses = ["Base de Fuerza", "Desarrollo", "Pico", "Recuperación"]
        elif goal_value == "fat_loss":
            focuses = ["Adaptación Metabólica", "Déficit Progresivo", "Mantenimiento", "Recarga"]
        else:
            focuses = ["Fase 1", "Fase 2", "Fase 3", "Fase 4"]

        idx = (meso_num - 1) % len(focuses)
        return focuses[idx]

    def _get_week_changes(self, progression: Dict[str, Any], week: int) -> Dict[str, Any]:
        """
        Obtiene los cambios para una semana específica.
        """
        for p in progression.get("progression", []):
            if p.get("week") == week:
                return p
        return {"intensity": "medium", "changes": []}

    def _apply_exercise_change(self, day: Dict[str, Any], change: Dict[str, Any]) -> None:
        """
        Aplica un cambio de ejercicio a un día.
        """
        exercises = day.get("exercises", [])
        target_exercise = None

        slot_role = change.get("slot_role")
        if slot_role:
            target_exercise = next(
                (exercise for exercise in exercises if exercise.get("slot_role") == slot_role),
                None,
            )

        if target_exercise is None:
            ex_idx = change.get("ex_idx", 0)
            if isinstance(ex_idx, int) and ex_idx < len(exercises):
                target_exercise = exercises[ex_idx]

        if target_exercise is None:
            return

        if "s" in change:
            target_exercise["sets"] = change["s"]
        if "ev" in change:
            target_exercise["effort_value"] = change["ev"]
        if "rm" in change:
            target_exercise["reps_min"] = change["rm"]
        if "rx" in change:
            target_exercise["reps_max"] = change["rx"]
        if "rs" in change:
            target_exercise["rest_seconds"] = change["rs"]
        if "replace_candidate_id" in change:
            replacement_id = normalize_exercise_id(change.get("replace_candidate_id"))
            if replacement_id is not None:
                target_exercise["exercise_id"] = replacement_id

    def _apply_deload(self, day: Dict[str, Any]) -> None:
        """
        Aplica reducción de volumen para semana de deload.
        Reduce sets ~40% y aumenta RIR.
        """
        for ex in day.get("exercises", []):
            # Reducir sets 40%
            original_sets = ex.get("sets", 3)
            ex["sets"] = max(2, int(original_sets * 0.6))

            # Aumentar RIR (más lejos del fallo)
            if ex.get("effort_type") == "RIR":
                current_rir = ex.get("effort_value", 2)
                ex["effort_value"] = min(current_rir + 2, 5)

    def _expand_compressed_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Expande una respuesta comprimida al formato completo esperado.
        Mapea claves cortas a nombres completos.
        """
        # Si ya tiene formato completo, retornar tal cual
        if "macrocycle" in data:
            return data

        result = {}

        # Expandir macrocycle
        if "m" in data:
            m = data["m"]
            result["macrocycle"] = {
                "name": m.get("n", "Programa de Entrenamiento"),
                "description": m.get("d", ""),
                "objective": m.get("o", "general_fitness"),
                "mesocycles": []
            }

            # Expandir mesocycles
            for ms in m.get("ms", []):
                meso = {
                    "block_number": ms.get("b", 1),
                    "name": ms.get("n", f"Bloque {ms.get('b', 1)}"),
                    "focus": ms.get("f", ""),
                    "description": ms.get("d", ""),
                    "microcycles": []
                }

                # Expandir microcycles
                for mc in ms.get("mc", []):
                    micro = {
                        "week_number": mc.get("w", 1),
                        "name": mc.get("n", f"Semana {mc.get('w', 1)}"),
                        "intensity_level": mc.get("i", "medium"),
                        "weekly_notes": mc.get("wn", ""),
                        "training_days": []
                    }

                    # Expandir training days
                    for td in mc.get("td", []):
                        day = {
                            "day_number": td.get("d", 1),
                            "name": td.get("n", f"Día {td.get('d', 1)}"),
                            "focus": td.get("f", ""),
                            "rest_day": td.get("r", False),
                            "warmup_notes": td.get("wn", ""),
                            "exercises": []
                        }

                        # Expandir exercises
                        for ex in td.get("ex", []):
                            exercise = {
                                "exercise_id": ex.get("id", ""),
                                "exercise_name": ex.get("n", ""),
                                "order_index": ex.get("o", 0),
                                "phase": ex.get("ph", "main"),
                                "sets": ex.get("s", 3),
                                # Clasificación del ejercicio
                                "exercise_class": ex.get("ec", ex.get("exercise_class", "strength")),
                                "cardio_subclass": ex.get("cs", ex.get("cardio_subclass")),
                                "intensity_zone": ex.get("iz", ex.get("intensity_zone")),
                                # Parámetros de entrenamiento
                                "reps_min": ex.get("rm"),
                                "reps_max": ex.get("rx"),
                                "duration_seconds": ex.get("ds"),
                                "rest_seconds": ex.get("rs", 90),
                                "effort_type": ex.get("et", "RIR"),
                                "effort_value": ex.get("ev", 2),
                                "tempo": ex.get("t"),
                                "notes": ex.get("nt", ""),
                                "slot_role": ex.get("sr"),
                                "slot_candidate_ids": ex.get("sc"),
                            }
                            day["exercises"].append(exercise)

                        micro["training_days"].append(day)

                    meso["microcycles"].append(micro)

                result["macrocycle"]["mesocycles"].append(meso)

        # Expandir explanation
        if "e" in data:
            e = data["e"]
            result["explanation"] = {
                "rationale": e.get("r", ""),
                "progression_strategy": e.get("p", ""),
                "deload_strategy": e.get("ds", ""),
                "volume_distribution": e.get("v", ""),
                "tips": e.get("t", [])
            }

        return result

    async def generate_preview(
        self,
        request: AIWorkoutRequest,
        available_exercises: List[Dict[str, Any]]
    ) -> AIWorkoutResponse:
        """
        Genera una preview rápida (solo 1 semana) para que el usuario
        pueda ver cómo sería el programa antes de generar completo.
        """
        original_weeks = request.program_duration.total_weeks
        original_meso_weeks = request.program_duration.mesocycle_weeks
        request.program_duration.total_weeks = 1
        request.program_duration.mesocycle_weeks = 1

        try:
            if settings.AI_USE_PROMPT_CACHING:
                return await self._generate_with_caching(
                    request,
                    available_exercises,
                    generation_scope="preview",
                    slot_catalog_result=self._flat_only_slot_catalog(available_exercises),
                )
            return await self._generate_legacy(
                request,
                available_exercises,
                generation_scope="preview",
                slot_catalog_result=self._flat_only_slot_catalog(available_exercises),
            )
        finally:
            request.program_duration.total_weeks = original_weeks
            request.program_duration.mesocycle_weeks = original_meso_weeks

    def _parse_response(self, raw_content: str) -> Optional[Dict[str, Any]]:
        """
        Parsea la respuesta de la IA, manejando posibles formatos.
        """
        logger.info(f"Parseando respuesta ({len(raw_content)} chars)")

        # Intentar parsear directamente
        try:
            return json.loads(raw_content)
        except json.JSONDecodeError:
            pass

        # Intentar extraer JSON de bloques de código markdown
        if "```json" in raw_content:
            try:
                start = raw_content.find("```json") + 7
                # Buscar el cierre del bloque
                end = raw_content.find("```", start)
                if end == -1:
                    # No hay cierre, usar todo el contenido restante
                    json_str = raw_content[start:].strip()
                else:
                    json_str = raw_content[start:end].strip()

                logger.info(f"Extrayendo JSON de bloque markdown ({len(json_str)} chars)")
                return json.loads(json_str)
            except json.JSONDecodeError as e:
                logger.warning(f"Error parseando JSON de bloque markdown: {e}")
                pass

        # Intentar extraer JSON con búsqueda de llaves
        if "{" in raw_content:
            try:
                start = raw_content.find("{")
                end = raw_content.rfind("}") + 1
                if end > start:
                    json_str = raw_content[start:end]
                    logger.info(f"Extrayendo JSON por llaves ({len(json_str)} chars)")
                    return json.loads(json_str)
            except json.JSONDecodeError as e:
                logger.warning(f"Error parseando JSON por llaves: {e}")
                pass

        # Log detallado del error
        logger.error(f"No se pudo parsear respuesta. Primeros 1000 chars: {raw_content[:1000]}")
        logger.error(f"Últimos 500 chars: {raw_content[-500:] if len(raw_content) > 500 else raw_content}")
        return None

    def _validate_exercises(
        self,
        data: Dict[str, Any],
        valid_exercise_ids: set
    ) -> List[str]:
        """
        Valida que los ejercicios usados existan en el catálogo.
        Retorna lista de advertencias.
        """
        warnings = []
        invalid_exercises = []

        macrocycle = data.get("macrocycle", {})
        for meso in macrocycle.get("mesocycles", []):
            for micro in meso.get("microcycles", []):
                for day in micro.get("training_days", []):
                    for exercise in day.get("exercises", []):
                        ex_id = normalize_exercise_id(exercise.get("exercise_id"))
                        if ex_id and ex_id not in valid_exercise_ids:
                            invalid_exercises.append(exercise.get("exercise_name", str(ex_id)))

        if invalid_exercises:
            unique_invalid = list(set(invalid_exercises))
            warnings.append(
                f"Los siguientes ejercicios no están en el catálogo y "
                f"deberán ser revisados: {', '.join(unique_invalid[:5])}"
                + (f" y {len(unique_invalid) - 5} más" if len(unique_invalid) > 5 else "")
            )

        return warnings

    def _validate_session_limits(
        self,
        data: Dict[str, Any],
        fitness_level: FitnessLevel
    ) -> List[str]:
        """
        Valida que cada sesión no exceda los límites de ejercicios recomendados.
        Retorna lista de advertencias.
        """
        limits = {
            FitnessLevel.BEGINNER: 4,
            FitnessLevel.INTERMEDIATE: 6,
            FitnessLevel.ADVANCED: 8,
        }
        max_exercises = limits.get(fitness_level, 6)
        warnings = []
        sessions_exceeding = []

        macrocycle = data.get("macrocycle", {})
        for meso in macrocycle.get("mesocycles", []):
            for micro in meso.get("microcycles", []):
                for day in micro.get("training_days", []):
                    if day.get("rest_day", False):
                        continue

                    exercises = day.get("exercises", [])
                    if len(exercises) > max_exercises:
                        day_name = day.get("name", f"Día {day.get('day_number', '?')}")
                        sessions_exceeding.append(
                            f"{day_name} ({len(exercises)} ejercicios)"
                        )

        if sessions_exceeding:
            warnings.append(
                f"Las siguientes sesiones exceden el límite recomendado de "
                f"{max_exercises} ejercicios para nivel {fitness_level.value}: "
                f"{', '.join(sessions_exceeding[:3])}"
                + (f" y {len(sessions_exceeding) - 3} más" if len(sessions_exceeding) > 3 else "")
            )

        return warnings

    def _calculate_dates(self, data: Dict[str, Any], start_date: date) -> None:
        """
        Calcula y agrega las fechas a cada elemento del programa.
        Modifica el diccionario in-place.
        """
        current_date = start_date
        macrocycle = data.get("macrocycle", {})

        for meso in macrocycle.get("mesocycles", []):
            meso_start = current_date
            meso_day_span = 0

            for micro in meso.get("microcycles", []):
                micro_start = current_date

                # Calcular duraciÃ³n real del microciclo segÃºn day_number
                training_days = micro.get("training_days", [])
                max_day_number = max([day.get("day_number", 1) for day in training_days], default=1)
                micro_end = micro_start + timedelta(days=max_day_number - 1)

                micro["start_date"] = micro_start.isoformat()
                micro["end_date"] = micro_end.isoformat()

                for day in training_days:
                    day_offset = day.get("day_number", 1) - 1
                    day["date"] = (micro_start + timedelta(days=day_offset)).isoformat()

                # Avanzar al siguiente microciclo
                current_date = micro_end + timedelta(days=1)
                meso_day_span += max_day_number

            meso["start_date"] = meso_start.isoformat()
            # Si no hubo microciclos, mantener 7 dÃ­as por defecto
            meso_duration = meso_day_span if meso_day_span > 0 else 7
            meso["end_date"] = (meso_start + timedelta(days=meso_duration - 1)).isoformat()

        macrocycle["start_date"] = start_date.isoformat()
        # current_date queda en el dÃ­a siguiente al Ãºltimo micro; retroceder 1
        macrocycle["end_date"] = (current_date - timedelta(days=1)).isoformat()


class ExerciseMapper:
    """
    Utilidad para mapear ejercicios sugeridos por la IA a ejercicios existentes.
    Corrige IDs inválidos buscando el ejercicio más similar por nombre.
    """

    def __init__(self, exercises: List[Dict[str, Any]]):
        self.exercises = exercises
        self.by_id = {normalize_exercise_id(ex["id"]): ex for ex in exercises}
        self.by_name = {ex["name"].lower(): ex for ex in exercises}
        self.mapped_count = 0  # Contador de ejercicios remapeados
        self.unmapped_exercises: List[str] = []  # Ejercicios que no se pudieron mapear

    def find_best_match(
        self,
        exercise_name: str,
        muscle_group: Optional[str] = None,
        candidate_ids: Optional[List[int]] = None,
    ) -> Optional[Dict]:
        """
        Busca el mejor ejercicio que coincida con el nombre dado.
        """
        name_lower = exercise_name.lower()
        allowed_ids = {
            normalize_exercise_id(candidate_id)
            for candidate_id in (candidate_ids or [])
            if normalize_exercise_id(candidate_id) is not None
        }
        candidate_pool = self.exercises
        if allowed_ids:
            candidate_pool = [
                exercise for exercise in self.exercises
                if normalize_exercise_id(exercise.get("id")) in allowed_ids
            ]

        # Búsqueda exacta
        if name_lower in self.by_name:
            exact = self.by_name[name_lower]
            if not allowed_ids or normalize_exercise_id(exact.get("id")) in allowed_ids:
                return exact

        # Búsqueda parcial
        matches = []
        for ex in candidate_pool:
            ex_name = ex["name"].lower()
            if name_lower in ex_name or ex_name in name_lower:
                score = len(set(name_lower.split()) & set(ex_name.split()))
                if muscle_group and muscle_group in {muscle.lower() for muscle in ex.get("primary_muscles", [])}:
                    score += 2
                if allowed_ids:
                    score += 2
                matches.append((score, ex))

        if matches:
            matches.sort(key=lambda x: x[0], reverse=True)
            return matches[0][1]

        return None

    def _slot_candidate_ids(self, exercise: Dict[str, Any]) -> List[int]:
        return [
            candidate_id
            for candidate_id in (
                normalize_exercise_id(candidate_id)
                for candidate_id in (exercise.get("slot_candidate_ids") or [])
            )
            if candidate_id is not None
        ]

    def map_exercises_in_program(self, macrocycle: Dict[str, Any]) -> Dict[str, Any]:
        """
        Mapea todos los ejercicios en un programa generado a IDs válidos.
        Actualiza mapped_count con el número de ejercicios corregidos.
        """
        self.mapped_count = 0
        self.unmapped_exercises = []

        for meso in macrocycle.get("mesocycles", []):
            for micro in meso.get("microcycles", []):
                for day in micro.get("training_days", []):
                    for exercise in day.get("exercises", []):
                        ex_id = normalize_exercise_id(exercise.get("exercise_id"))

                        # Si el ID no es válido, buscar por nombre
                        if ex_id not in self.by_id:
                            ex_name = exercise.get("exercise_name", "")
                            focus = day.get("focus", "").lower()
                            slot_role = exercise.get("slot_role")
                            slot_candidate_ids = self._slot_candidate_ids(exercise)

                            # Determinar grupo muscular del contexto
                            muscle = None
                            for mg in ["chest", "back", "shoulders", "arms", "legs", "core"]:
                                if mg in focus:
                                    muscle = mg
                                    break

                            match = None
                            if slot_candidate_ids:
                                match = self.find_best_match(ex_name, muscle, candidate_ids=slot_candidate_ids)
                            if match is None and slot_role:
                                slot_scoped_ids = [
                                    normalize_exercise_id(candidate.get("id"))
                                    for candidate in self.exercises
                                    if infer_slot_role(candidate) == slot_role
                                ]
                                slot_scoped_ids = [candidate_id for candidate_id in slot_scoped_ids if candidate_id is not None]
                                if slot_scoped_ids:
                                    match = self.find_best_match(ex_name, muscle, candidate_ids=slot_scoped_ids)
                            if match is None:
                                match = self.find_best_match(ex_name, muscle)
                            if match:
                                logger.debug(
                                    f"Remapeando ejercicio: '{ex_name}' (ID: {ex_id}) "
                                    f"-> '{match['name']}' (ID: {match['id']})"
                                )
                                exercise["exercise_id"] = normalize_exercise_id(match["id"])
                                exercise["exercise_name"] = match["name"]
                                self.mapped_count += 1
                            else:
                                # No se encontró match, registrar para warning
                                self.unmapped_exercises.append(ex_name)
                                logger.warning(
                                    f"No se encontró match para ejercicio: '{ex_name}' (ID: {ex_id})"
                                )

        if self.mapped_count > 0:
            logger.info(f"Total de ejercicios remapeados: {self.mapped_count}")

        return macrocycle
