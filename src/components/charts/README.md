# Sistema de Visualización de Métricas

## Mapa Muscular SVG - Limitaciones

Este documento explica la cobertura del sistema de visualización muscular y sus limitaciones técnicas.

### Músculos Con Visualización (10 grupos - 59%)

Los siguientes grupos musculares **TIENEN** representación visual en el mapa corporal:

✅ **Pecho**: `chest`
✅ **Espalda**: `upper_back`, `lats`, `lower_back`
✅ **Hombros**: `posterior_deltoid`
✅ **Brazos**: `triceps`
✅ **Piernas**: `hamstrings`, `calves`

### Músculos Sin Visualización (7 grupos - 41%)

Los siguientes grupos **NO** tienen IDs en el SVG y no se visualizan en el mapa:

❌ **Hombros**: `anterior_deltoid`, `lateral_deltoid`
❌ **Brazos**: `biceps`, `forearms`
❌ **Piernas**: `quadriceps`, `glutes`
❌ **Core**: `abs`, `obliques`

**Solución alternativa**: Estos grupos se muestran en:
- Los gráficos de barras (Series y Reps Efectivas)
- La advertencia amarilla debajo del mapa corporal

---

## Análisis Técnico del SVG

### Vista Anterior (Anterior.svg)
- **Total de elementos**: 77 paths
- **Elementos con ID**: 2 (2.6% nombrado)
- **Músculos identificados**: Pectorales

### Vista Posterior (Posterior.svg)
- **Total de elementos**: 59 paths
- **Elementos con ID**: 24 (40.7% nombrado)
- **Músculos identificados**: Dorsales, Trapecio, Lumbares, Deltoides Posterior, Tríceps, Isquiotibiales, Pantorrillas

### Cobertura Total
- **Total elementos**: 136 paths
- **Elementos nombrados**: 26 (19.1%)
- **Elementos sin identificar**: 110 (80.9%)

---

## Mapeo de IDs SVG a Grupos Musculares

### Vista Anterior
```
Pectoral_izquierdo → chest
Pectoral_derecho → chest
```

### Vista Posterior

**Espalda:**
```
Dorsal_ancho_izquierdo / derecho → lats
Trapecio_izquierdo / derecho → upper_back
Aponeurosis_lumbar_izquierda / derecha → lower_back
```

**Hombros:**
```
Deltoides_posterior_izquierdo / derecho → posterior_deltoid
```

**Brazos:**
```
Triceps_izquierdo_cabeza_larga → triceps
Triceps_izquierdo_cabeza_lateral → triceps
Triceps_derecho_cabeza_larga → triceps
Triceps_derecho_cabeza_lateral → triceps
```

**Piernas:**
```
Semitendinoso_izquierdo / derecho → hamstrings
Semimembranoso_izquierdo / derecho → hamstrings
Biceps_femoral_derecho → hamstrings
Gastrocnemio_interno_izquierdo / derecho → calves
Gastrocnemio_externo_izquierdo / derecho → calves
```

---

## Mejoras Futuras del SVG

Para visualizar **todos los 17 grupos musculares**, sería necesario:

### Pasos Requeridos
1. Abrir archivos SVG en Adobe Illustrator o editor compatible
2. Identificar y nombrar los 110 elementos sin ID
3. Asignar IDs descriptivos a cada elemento muscular
4. Actualizar `muscleMapping.ts` con los nuevos IDs
5. Remover grupos de `UNMAPPED_MUSCLE_GROUPS`

### Músculos Prioritarios para Identificar

**Vista Anterior:**
- **Deltoides anterior/lateral**: Elementos del hombro frontal
- **Bíceps**: Elementos del brazo anterior
- **Cuádriceps**: Elementos del muslo frontal (vastus lateralis, rectus femoris, vastus medialis)
- **Abdominales**: Elementos del core (rectus abdominis)
- **Oblicuos**: Elementos laterales del core

**Vista Posterior:**
- **Glúteos**: Elementos del glúteo mayor/medio

---

## Experiencia del Usuario

### Flujo Actual

1. **Mapa Corporal**: Muestra solo los 10 grupos con IDs en SVG
2. **Gráficos de Barras**: Muestran TODOS los 17 grupos con datos
3. **Banner de Advertencia**: Lista grupos sin visualización pero con volumen entrenado
4. **Tooltip**: Explica que algunos grupos no tienen visualización

### Ventajas del Enfoque Actual

✅ **Transparencia**: El usuario sabe exactamente qué puede/no puede visualizar
✅ **Datos completos**: Ningún grupo se pierde, todos aparecen en gráficos
✅ **Priorización clara**: Se visualizan los grupos más entrenados (espalda, pecho, piernas)
✅ **Mejora incremental**: Fácil agregar más músculos cuando se identifiquen en SVG

### Limitaciones Aceptables

- El 59% de cobertura es suficiente para la mayoría de rutinas
- Los grupos más comunes (pecho, espalda, piernas) están cubiertos
- Los grupos faltantes (abs, bíceps) son fáciles de rastrear en gráficos

---

## Referencias Técnicas

### Archivos Relacionados
- `muscleMapping.ts`: Mapeo de IDs → grupos musculares
- `BodyMap.tsx`: Componente de visualización
- `metricsCalculations.ts`: Umbrales y cálculos
- `Anterior.svg` / `Posterior.svg`: Archivos de anatomía

### Constantes Exportadas
```typescript
// muscleMapping.ts
export const MUSCLE_ID_TO_GROUP: Record<string, MuscleGroup>
export const UNMAPPED_MUSCLE_GROUPS: MuscleGroup[]
export const MAPPED_MUSCLE_GROUPS: MuscleGroup[]
export const MUSCLE_LABELS: Record<string, string>
```

---

## Conclusión

El sistema actual proporciona visualización para **10 de 17 grupos musculares (59%)**. Los 7 grupos restantes se muestran mediante:
- Gráficos de barras con métricas completas
- Banner de advertencia con volumen entrenado
- Documentación clara de limitaciones

Esta solución balancea funcionalidad, transparencia y facilidad de mantenimiento hasta que se puedan identificar más elementos en los archivos SVG.
