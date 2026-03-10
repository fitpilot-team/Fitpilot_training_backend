import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { MuscleName } from '../../types';
import {
  getStressLevel,
  getStressLevelColor,
  getStressLevelLabel,
  STRESS_THRESHOLDS,
  MUSCLE_GROUP_LABELS,
  type StressLevel,
} from '../../utils/metricsCalculations';
import { MUSCLE_ID_TO_GROUP, UNMAPPED_MUSCLE_GROUPS } from './muscleMapping';
import AnteriorSVG from '../../assets/AnteriorBodyMap.svg?react';
import PosteriorSVG from '../../assets/PosteriorBodyMap.svg?react';

interface MuscleGroupData {
  muscleGroup: MuscleName;
  stressIndex: number;
  totalSets: number;
  label: string;
}

interface BodyMapProps {
  volumeByMuscleGroup: MuscleGroupData[];
}

interface TooltipData {
  label: string;
  stressIndex: number;
  totalSets: number;
  level: StressLevel;
  threshold: { low: number; high: number };
  x: number;
  y: number;
}

const DEFAULT_COLOR = '#e5e7eb';

export function BodyMap({ volumeByMuscleGroup }: BodyMapProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const anteriorRef = useRef<HTMLDivElement>(null);
  const posteriorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Crear mapa de datos por músculo
  const muscleDataMap = useMemo(() => {
    const map = new Map<MuscleName, MuscleGroupData>();
    volumeByMuscleGroup.forEach((data) => {
      map.set(data.muscleGroup, data);
    });
    return map;
  }, [volumeByMuscleGroup]);

  // Detectar grupos musculares sin visualización en SVG
  const unmappedVolume = useMemo(() => {
    return volumeByMuscleGroup.filter(
      v => UNMAPPED_MUSCLE_GROUPS.includes(v.muscleGroup) && v.stressIndex > 0
    );
  }, [volumeByMuscleGroup]);

  // Obtener color para un músculo basado en índice de estrés
  const getColor = useCallback((muscleName: MuscleName): string => {
    const data = muscleDataMap.get(muscleName);
    if (!data || data.stressIndex === 0) return DEFAULT_COLOR;
    const level = getStressLevel(muscleName, data.stressIndex);
    return getStressLevelColor(level);
  }, [muscleDataMap]);

  // Handler para mostrar tooltip
  const handleMouseEnter = useCallback((muscleName: MuscleName, event: MouseEvent) => {
    const data = muscleDataMap.get(muscleName);
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (containerRect) {
      setTooltip({
        label: data?.label || MUSCLE_GROUP_LABELS[muscleName] || muscleName,
        stressIndex: data?.stressIndex || 0,
        totalSets: data?.totalSets || 0,
        level: getStressLevel(muscleName, data?.stressIndex || 0),
        threshold: STRESS_THRESHOLDS[muscleName] || { low: 6, high: 12 },
        x: event.clientX - containerRect.left,
        y: event.clientY - containerRect.top,
      });
    }
  }, [muscleDataMap]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // Aplicar estilos e interactividad a los elementos SVG
  useEffect(() => {
    const applyStylesToContainer = (container: HTMLDivElement | null) => {
      if (!container) return;

      // Aplicar estilos a elementos mapeados
      Object.entries(MUSCLE_ID_TO_GROUP).forEach(([muscleId, group]) => {
        const element = container.querySelector(`#${muscleId}`);
        if (element) {
          const color = getColor(group);

          // Determinar si es un grupo o un elemento individual
          const isGroup = element.tagName.toLowerCase() === 'g';
          const elementsToStyle = isGroup
            ? Array.from(element.querySelectorAll('path'))
            : [element];

          // Aplicar estilos a todos los elementos (paths del grupo o elemento individual)
          elementsToStyle.forEach((el) => {
            const pathElement = el as SVGPathElement;
            pathElement.style.fill = color;
            pathElement.style.cursor = 'pointer';
            pathElement.style.transition = 'fill 0.2s ease, opacity 0.2s ease';

            // Efecto hover
            pathElement.onmouseover = () => {
              pathElement.style.opacity = '0.8';
            };
            pathElement.onmouseout = () => {
              pathElement.style.opacity = '1';
            };
          });

          // Event handlers en el elemento principal (grupo o path)
          const newEnterHandler = (e: Event) => handleMouseEnter(group, e as MouseEvent);
          const newLeaveHandler = () => handleMouseLeave();

          element.addEventListener('mouseenter', newEnterHandler);
          element.addEventListener('mouseleave', newLeaveHandler);
        }
      });
    };

    applyStylesToContainer(anteriorRef.current);
    applyStylesToContainer(posteriorRef.current);
  }, [volumeByMuscleGroup, getColor, handleMouseEnter, handleMouseLeave]);

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex gap-4 justify-center">
        {/* Front View */}
        <div className="text-center">
          <span className="text-sm text-gray-500 mb-2 block">Front</span>
          <div
            ref={anteriorRef}
            className="w-56 h-80"
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
          >
            <AnteriorSVG className="w-full h-full" />
          </div>
        </div>

        {/* Back View */}
        <div className="text-center">
          <span className="text-sm text-gray-500 mb-2 block">Back</span>
          <div
            ref={posteriorRef}
            className="w-56 h-80"
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
          >
            <PosteriorSVG className="w-full h-full" />
          </div>
        </div>
      </div>

      {/* Advertencia para grupos sin visualización */}
      {unmappedVolume.length > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs font-medium text-yellow-800 mb-2">
            Grupos sin visualización en mapa:
          </p>
          <div className="flex flex-wrap gap-2">
            {unmappedVolume.map(v => (
              <span key={v.muscleGroup} className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                {v.label}: {v.stressIndex} stress
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute bg-gray-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none z-10 shadow-lg"
          style={{
            left: tooltip.x,
            top: tooltip.y - 80,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-semibold">{tooltip.label}</div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getStressLevelColor(tooltip.level) }}
            />
            <span>{getStressLevelLabel(tooltip.level)}</span>
          </div>
          <div className="mt-1 text-gray-300">
            Stress: {tooltip.stressIndex} | {tooltip.totalSets} sets/week
          </div>
          <div className="text-gray-400 text-[10px] mt-1">
            Optimal: {tooltip.threshold.low}-{tooltip.threshold.high}
          </div>
        </div>
      )}

      {/* Legend - Stress Index Levels */}
      <div className="flex justify-center gap-4 mt-3">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-xs text-gray-500">Low</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span className="text-xs text-gray-500">Optimal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-xs text-gray-500">High</span>
        </div>
      </div>
    </div>
  );
}
