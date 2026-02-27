import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TFunction } from 'i18next';
import { Microcycle, TrainingDay, Exercise, DayExercise, MuscleName } from '../types';
import logoImage from '../assets/fitpilot-logo.png';
import { getExerciseName, resolveExerciseMediaUrl } from './exerciseHelpers';
import {
    calculateMicrocycleMetrics,
    getStressLevel,
    getStressLevelColor,
    getSetsVolumeLevel,
    getVolumeLevelColor,
    type VolumeByMuscleGroup,
} from './metricsCalculations';
// Import SVGs as raw text
import anteriorSvgRaw from '../assets/AnteriorBodyMap.svg?raw';
import posteriorSvgRaw from '../assets/PosteriorBodyMap.svg?raw';

// Muscle ID to muscle group mapping for SVG coloring
const MUSCLE_ID_TO_GROUP: Record<string, MuscleName> = {
    'chest_left': 'chest', 'chest_right': 'chest',
    'anterior_deltoid_left': 'anterior_deltoid', 'anterior_deltoid_right': 'anterior_deltoid',
    'biceps_left_long_head': 'biceps', 'biceps_left_short_head': 'biceps', 'biceps_left_brachialis': 'biceps',
    'biceps_right_long_head': 'biceps', 'biceps_right_short_head': 'biceps', 'biceps_right_brachialis': 'biceps',
    'abs_rectus': 'abs',
    'obliques_left': 'obliques', 'obliques_right': 'obliques',
    'quadriceps_left_rectus_femoris': 'quadriceps', 'quadriceps_right_rectus_femoris': 'quadriceps',
    'quadriceps_left_vastus_medialis': 'quadriceps', 'quadriceps_right_vastus_medialis': 'quadriceps',
    'quadriceps_left_vastus_lateralis': 'quadriceps', 'quadriceps_right_vastus_lateralis': 'quadriceps',
    'adductors_left': 'adductors', 'adductors_right': 'adductors',
    'tibialis_left': 'tibialis', 'tibialis_right': 'tibialis',
    'trapezius_left': 'upper_back', 'trapezius_right': 'upper_back',
    'teres_major_left': 'upper_back', 'teres_major_right': 'upper_back',
    'teres_minor_left': 'upper_back', 'teres_minor_right': 'upper_back',
    'infraspinatus_left': 'upper_back', 'infraspinatus_right': 'upper_back',
    'lats_left': 'lats', 'lats_right': 'lats',
    'lower_back_left': 'lower_back', 'lower_back_right': 'lower_back',
    'posterior_deltoid_left': 'posterior_deltoid', 'posterior_deltoid_right': 'posterior_deltoid',
    'triceps_left_long_head': 'triceps', 'triceps_left_lateral_head': 'triceps',
    'triceps_right_long_head': 'triceps', 'triceps_right_lateral_head': 'triceps',
    'glutes_left_maximus': 'glutes', 'glutes_right_maximus': 'glutes', 'glutes_left_minimus': 'glutes',
    'hamstrings_left_semitendinosus': 'hamstrings', 'hamstrings_right_semitendinosus': 'hamstrings',
    'hamstrings_left_semimembranosus': 'hamstrings', 'hamstrings_right_semimembranosus': 'hamstrings',
    'hamstrings_right_biceps_femoris': 'hamstrings',
    'adductors_left_posterior': 'adductors', 'adductors_right_posterior': 'adductors',
    'quadriceps_left_vastus_lateralis_posterior': 'quadriceps',
    'calves_left_gastrocnemius_medial': 'calves', 'calves_right_gastrocnemius_medial': 'calves',
    'calves_left_gastrocnemius_lateral': 'calves', 'calves_right_gastrocnemius_lateral': 'calves',
};

// Helper to convert hex color to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
};

// Default color for muscles without data
const DEFAULT_MUSCLE_COLOR = '#e5e7eb';

// Helper to colorize SVG based on muscle stress data
const colorizeSvg = (
    svgString: string,
    volumeByMuscleGroup: VolumeByMuscleGroup[]
): string => {
    // Create a map of muscle group to stress color
    const muscleColorMap = new Map<MuscleName, string>();
    volumeByMuscleGroup.forEach((data) => {
        const level = getStressLevel(data.muscleGroup, data.stressIndex);
        muscleColorMap.set(data.muscleGroup, getStressLevelColor(level));
    });

    // Parse SVG and modify colors
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');

    // Process each mapped muscle ID
    Object.entries(MUSCLE_ID_TO_GROUP).forEach(([muscleId, muscleGroup]) => {
        const element = doc.getElementById(muscleId);
        if (element) {
            const color = muscleColorMap.get(muscleGroup) || DEFAULT_MUSCLE_COLOR;

            // Check if it's a group or single path
            if (element.tagName.toLowerCase() === 'g') {
                // Color all paths within the group
                const paths = element.querySelectorAll('path');
                paths.forEach((path) => {
                    path.style.fill = color;
                });
            } else {
                element.style.fill = color;
            }
        }
    });

    // Serialize back to string
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
};

// Helper to convert SVG to base64 image
const svgToBase64Image = async (svgString: string, width: number, height: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/png'));
            } else {
                reject(new Error('Failed to get canvas context'));
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load SVG image'));
        };

        img.src = url;
    });
};

// Helper function to load image as base64
const loadImageAsBase64 = async (url: string): Promise<string | null> => {
    try {
        const response = await fetch(url, { mode: 'cors' });
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.warn(`Failed to load image: ${url}`, error);
        return null;
    }
};

const TIME_BASED_EXERCISE_KEYWORDS = [
    'cuerda', 'rope',
    'treadmill', 'caminadora',
    'run', 'running', 'jog',
    'bike', 'bici', 'cycle',
    'row', 'ski erg',
    'plank', 'plancha',
    'airdyne', 'assault'
];

const formatDuration = (seconds: number): string => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder === 0 ? `${minutes}min` : `${minutes}:${String(remainder).padStart(2, '0')}min`;
};

const getRepsDisplay = (dayEx: DayExercise, exercise?: Exercise | null): string => {
    const exerciseName = (exercise?.name_es || exercise?.name_en || '').toLowerCase();
    const isCardioClass = exercise?.exercise_class === 'cardio' || exercise?.exercise_class === 'conditioning';
    const isTimeBased =
        isCardioClass ||
        !!dayEx.duration_seconds ||
        !!(dayEx.intervals && dayEx.work_seconds) ||
        TIME_BASED_EXERCISE_KEYWORDS.some((kw) => exerciseName.includes(kw));

    if (isTimeBased) {
        if (dayEx.intervals && dayEx.work_seconds) {
            return `${dayEx.intervals}x${dayEx.work_seconds}s`;
        }
        if (dayEx.duration_seconds) {
            return formatDuration(dayEx.duration_seconds);
        }
        return '-';
    }

    // Strength / rep-based
    if (dayEx.reps_min != null && dayEx.reps_max != null) {
        return dayEx.reps_min === dayEx.reps_max
            ? `${dayEx.reps_min}`
            : `${dayEx.reps_min}-${dayEx.reps_max}`;
    }
    if (dayEx.reps_min != null) return `${dayEx.reps_min}`;
    if (dayEx.reps_max != null) return `${dayEx.reps_max}`;
    return '-';
};

export const generateMicrocyclePDF = async (
    microcycle: Microcycle,
    trainingDays: TrainingDay[],
    exercises: Exercise[],
    t: TFunction,
    clientName?: string,
    clientPhotoUrl?: string
): Promise<void> => {
    const doc = new jsPDF();
    const sortedDays = [...trainingDays].sort((a, b) => a.day_number - b.day_number);
    const pageWidth = doc.internal.pageSize.getWidth();
    const currentLang = t('common:lang', { defaultValue: 'es' }); // Assuming common:lang exists or defaulting to 'es' for date formatting

    // Modern color palette
    const colors: {
        primary: [number, number, number];
        primaryLight: [number, number, number];
        warmup: [number, number, number];
        cooldown: [number, number, number];
        gray: [number, number, number];
        dark: [number, number, number];
    } = {
        primary: [37, 99, 235], // Blue-600
        primaryLight: [59, 130, 246], // Blue-500
        warmup: [249, 115, 22], // Orange-500
        cooldown: [245, 158, 11], // Amber-500
        gray: [107, 114, 128], // Gray-500
        dark: [31, 41, 55], // Gray-800
    };

    let yPos = 20;

    // ============ HEADER SECTION ============
    // FitPilot Logo (top-right corner)
    const logoSize = 16;
    try {
        doc.addImage(logoImage, 'PNG', pageWidth - 14 - logoSize, yPos - 2, logoSize, logoSize);
    } catch (error) {
        // Fallback to circle if logo fails to load
        doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        doc.circle(pageWidth - 14 - logoSize / 2, yPos + 5, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('FP', pageWidth - 14 - logoSize / 2, yPos + 7, { align: 'center' });
    }

    // Title (left side)
    doc.setTextColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(microcycle.name, 14, yPos + 8);

    yPos += 18;

    // Client section with photo (if available)
    let clientStartX = 14;

    if (clientName) {
        // Load client photo if URL provided
        if (clientPhotoUrl) {
            const clientPhoto = await loadImageAsBase64(clientPhotoUrl);
            if (clientPhoto) {
                try {
                    // Draw circular client photo
                    const photoSize = 12;
                    doc.addImage(clientPhoto, 'JPEG', clientStartX, yPos - 4, photoSize, photoSize);
                    clientStartX += photoSize + 4; // Move text position
                } catch (error) {
                    console.warn('Failed to load client photo', error);
                }
            }
        }

        // Client name
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
        doc.text(`${t('training:pdf.client')}: `, clientStartX, yPos);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colors.dark[0], colors.dark[1], colors.dark[2]);
        const clientLabelWidth = doc.getTextWidth(`${t('training:pdf.client')}: `);
        doc.text(clientName, clientStartX + clientLabelWidth, yPos);
    }

    // Print date (right aligned)
    const printDate = new Date().toLocaleDateString(currentLang === 'en' ? 'en-US' : 'es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
    doc.text(`${t('training:pdf.printed')}: ${printDate}`, pageWidth - 14, yPos, { align: 'right' });

    yPos += 8;

    // Microcycle info bar
    doc.setFillColor(colors.primaryLight[0], colors.primaryLight[1], colors.primaryLight[2]);
    doc.roundedRect(14, yPos, pageWidth - 28, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${t('training:pdf.week')} ${microcycle.week_number} • ${t(`training:intensity.${microcycle.intensity_level}`).toUpperCase()}`, pageWidth / 2, yPos + 6.5, { align: 'center' });

    yPos += 18;

    // ============ TRAINING DAYS ============
    for (const day of sortedDays) {
        // Check if we need a new page
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }

        // Day Header with modern styling
        doc.setFillColor(245, 245, 245);
        // Increased height to accommodate subtitle if present
        const headerHeight = day.focus ? 16 : 12;
        doc.roundedRect(14, yPos, pageWidth - 28, headerHeight, 2, 2, 'F');

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colors.dark[0], colors.dark[1], colors.dark[2]);

        // Clean up day name to avoid duplication (remove "Día X - " or "Day X - ")
        const cleanDayName = (day.name || '').replace(/^(Día|Day)\s+\d+\s*[-:]\s*/i, '');
        doc.text(`${t('training:pdf.day')} ${day.day_number}: ${cleanDayName}`, 18, yPos + 8);

        // Focus area (if exists) - Moved to new line
        if (day.focus) {
            doc.setFontSize(10); // Reduced size
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
            // Position below the title
            doc.text(`${t('training:pdf.focus')}: ${day.focus}`, 18, yPos + 14);
        }

        yPos += headerHeight + 4;

        // User-editable fields for date and notes
        if (!day.rest_day) {
            const boxHeight = 8;
            const leftBoxWidth = 60;
            const rightBoxX = 14 + leftBoxWidth + 4;
            const rightBoxWidth = pageWidth - 28 - leftBoxWidth - 4;

            // Date field box
            doc.setDrawColor(colors.gray[0], colors.gray[1], colors.gray[2]);
            doc.setLineWidth(0.3);
            doc.rect(14, yPos, leftBoxWidth, boxHeight);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
            doc.text(`${t('training:pdf.datePerformed')}:`, 16, yPos + 5.5);

            // Notes field box
            doc.rect(rightBoxX, yPos, rightBoxWidth, boxHeight);
            doc.text(`${t('training:pdf.dayNotes')}:`, rightBoxX + 2, yPos + 5.5);

            yPos += boxHeight + 6;
        }

        if (day.rest_day) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
            doc.text(t('training:pdf.restDay'), 18, yPos);
            yPos += 20;
            // Continue to next day so we still render/save the PDF
            continue;
        }

        const dayExercises = day.exercises || [];
        if (dayExercises.length === 0) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
            doc.text(t('training:pdf.noExercises'), 18, yPos);
            yPos += 20;
            // Skip empty day but keep generating the rest of the document
            continue;
        }

        // Sort exercises by order
        const sortedExercises = [...dayExercises].sort((a, b) => a.order_index - b.order_index);

        // Split into Warm-up, Main and Cooldown
        const warmupExercises = sortedExercises.filter(e => e.phase === 'warmup');
        const mainExercises = sortedExercises.filter(e => e.phase === 'main');
        const cooldownExercises = sortedExercises.filter(e => e.phase === 'cooldown');

        const generateTable = async (
            title: string,
            exercisesList: DayExercise[],
            headerColor: [number, number, number],
            sectionIcon: string,
            isMainPhase: boolean = true
        ) => {
            if (exercisesList.length === 0) return;

            // Check page space
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }

            // Section header
            doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
            doc.roundedRect(14, yPos, pageWidth - 28, 8, 1, 1, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(`${sectionIcon} ${title}`, 18, yPos + 5.5);
            yPos += 12;

            // Load all thumbnails first
            const thumbnailPromises = exercisesList.map(async (dayEx) => {
                const exercise = dayEx.exercise || exercises.find(e => e.id === dayEx.exercise_id);
                // Priority: custom image > thumbnail from ExerciseDB
                const thumbnailUrl = resolveExerciseMediaUrl(exercise?.image_url || exercise?.thumbnail_url);
                if (thumbnailUrl) {
                    return await loadImageAsBase64(thumbnailUrl);
                }
                return null;
            });
            const thumbnails = await Promise.all(thumbnailPromises);

            // Build table data with training log columns
            const tableData = exercisesList.map((dayEx, index) => {
                const exercise = dayEx.exercise || exercises.find(e => e.id === dayEx.exercise_id);
                const exerciseName = getExerciseName(exercise) || t('training:pdf.unknownExercise', { defaultValue: 'Ejercicio desconocido' });
                const repsCell = getRepsDisplay(dayEx, exercise);

                let intensity = '';
                if (dayEx.effort_type === 'RIR') intensity = `RIR ${dayEx.effort_value}`;
                else if (dayEx.effort_type === 'RPE') intensity = `RPE ${dayEx.effort_value}`;
                else if (dayEx.effort_type === 'percentage') intensity = `${dayEx.effort_value}%`;

                // Create training log columns (one per set) - only for main phase
                const logColumns: string[] = [];
                if (isMainPhase) {
                    for (let i = 1; i <= dayEx.sets; i++) {
                        logColumns.push(''); // Empty for user to fill
                    }
                }

                // Map set type to readable string
                const setType = dayEx.set_type
                    ? t(`training:pdf.setTypes.${dayEx.set_type}`, { defaultValue: dayEx.set_type })
                    : t('training:pdf.setTypes.straight');

                return {
                    exercise,
                    thumbnail: thumbnails[index],
                    data: [
                        '', // Empty cell for thumbnail image
                        exerciseName,
                        setType,
                        `${dayEx.sets}`,
                        repsCell,
                        intensity || '-',
                        `${dayEx.rest_seconds}s`,
                        dayEx.tempo || '-',
                        ...logColumns,
                    ]
                };
            });

            // Determine max sets for column headers - only for main phase
            const logHeaders: string[] = [];
            if (isMainPhase) {
                const maxSets = Math.max(...exercisesList.map(e => e.sets));
                for (let i = 1; i <= maxSets; i++) {
                    logHeaders.push(`S${i}`);
                }
            }

            // Calculate column widths to fit the page
            const availableWidth = pageWidth - 28; // Page width minus margins (14 left + 14 right)
            const fixedColumnsWidth = 12 + 30 + 12 + 10 + 12 + 15 + 10 + 12; // Sum of fixed column widths
            const remainingWidth = availableWidth - fixedColumnsWidth;
            // Distribute remaining width evenly so the table never exceeds the page
            const logColumnWidth = logHeaders.length > 0 ? remainingWidth / logHeaders.length : 0;

            // Build column styles dynamically
            const columnStyles: any = {
                0: { cellWidth: 12, halign: 'center' }, // Thumbnail
                1: { cellWidth: 30, halign: 'left' }, // Exercise name (reduced from 32)
                2: { cellWidth: 12, halign: 'center' }, // Type (reduced from 14)
                3: { cellWidth: 10, halign: 'center' }, // Sets (reduced from 12)
                4: { cellWidth: 12, halign: 'center' }, // Reps
                5: { cellWidth: 15, halign: 'center' }, // Intensity (reduced from 18)
                6: { cellWidth: 10, halign: 'center' }, // Rest (reduced from 12)
                7: { cellWidth: 12, halign: 'center' }, // Tempo (reduced from 14)
            };

            // Add training log column widths
            logHeaders.forEach((_, index) => {
                columnStyles[8 + index] = { cellWidth: logColumnWidth, halign: 'center' };
            });

            // Generate table with autoTable
            autoTable(doc, {
                startY: yPos,
                head: [['', t('training:pdf.exercise'), t('training:pdf.type'), t('training:pdf.sets'), t('training:pdf.reps'), t('training:pdf.intensity'), t('training:pdf.rest'), t('training:pdf.tempo'), ...logHeaders]],
                body: tableData.map(row => row.data),
                headStyles: {
                    fillColor: headerColor,
                    textColor: [255, 255, 255],
                    fontSize: 8,
                    fontStyle: 'bold',
                    halign: 'center',
                    cellPadding: 1,
                    overflow: 'linebreak',
                },
                bodyStyles: {
                    fontSize: 8,
                    cellPadding: 2,
                    minCellHeight: 12, // Ensure enough height for thumbnails
                },
                columnStyles: columnStyles,
                alternateRowStyles: {
                    fillColor: [250, 250, 250],
                },
                margin: { left: 14, right: 14 },
                tableWidth: availableWidth,
                didDrawCell: (data) => {
                    // Draw thumbnails in first column
                    if (data.column.index === 0 && data.section === 'body') {
                        const rowIndex = data.row.index;
                        const thumbnail = tableData[rowIndex]?.thumbnail;
                        if (thumbnail) {
                            try {
                                const cellCenterX = data.cell.x + data.cell.width / 2;
                                const cellCenterY = data.cell.y + data.cell.height / 2;
                                const imgSize = 10; // 10mm square thumbnail
                                doc.addImage(
                                    thumbnail,
                                    'JPEG',
                                    cellCenterX - imgSize / 2,
                                    cellCenterY - imgSize / 2,
                                    imgSize,
                                    imgSize
                                );
                            } catch (error) {
                                console.warn('Failed to add thumbnail to PDF', error);
                            }
                        }
                    }
                    // Highlight training log columns with light background and add input line
                    if (data.column.index >= 8 && data.section === 'body') {
                        doc.setFillColor(252, 252, 253);
                        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');

                        // Add line for writing weight
                        doc.setDrawColor(200, 200, 200);
                        doc.setLineWidth(0.1);
                        const lineY = data.cell.y + data.cell.height - 3;
                        doc.line(data.cell.x + 2, lineY, data.cell.x + data.cell.width - 2, lineY);
                    }
                },
            });

            // Update yPos
            // @ts-ignore
            yPos = doc.lastAutoTable.finalY + 8;
        };

        // Generate tables
        await generateTable(t('training:pdf.warmup'), warmupExercises, colors.warmup, '[C]', false);
        await generateTable(t('training:pdf.mainWorkout'), mainExercises, colors.primary, '[E]', true);
        await generateTable(t('training:pdf.cooldown'), cooldownExercises, colors.cooldown, '[F]', false);

        yPos += 4;
    }

    // ============ RECOMMENDATIONS SECTION ============
    if (yPos > 200) {
        doc.addPage();
        yPos = 20;
    } else {
        yPos += 10;
    }

    // Header
    doc.setFillColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    doc.roundedRect(14, yPos, pageWidth - 28, 8, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(t('training:pdf.generalRecommendations'), 18, yPos + 5.5);
    yPos += 14;

    // Content
    doc.setTextColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const recommendations = [
        { title: t('training:pdf.recommendations.rir.title'), text: t('training:pdf.recommendations.rir.text') },
        { title: t('training:pdf.recommendations.rpe.title'), text: t('training:pdf.recommendations.rpe.text') },
        { title: t('training:pdf.recommendations.warmupSets.title'), text: t('training:pdf.recommendations.warmupSets.text') },
        { title: t('training:pdf.recommendations.rest.title'), text: t('training:pdf.recommendations.rest.text') },
        { title: t('training:pdf.recommendations.tempo.title'), text: t('training:pdf.recommendations.tempo.text') },
        { title: t('training:pdf.recommendations.progression.title'), text: t('training:pdf.recommendations.progression.text') }
    ];

    recommendations.forEach(rec => {
        doc.setFont('helvetica', 'bold');
        doc.text(`• ${rec.title}:`, 18, yPos);
        const titleWidth = doc.getTextWidth(`• ${rec.title}:`);

        doc.setFont('helvetica', 'normal');
        const splitText = doc.splitTextToSize(rec.text, pageWidth - 28 - titleWidth - 2);
        doc.text(splitText, 18 + titleWidth + 2, yPos);

        yPos += (splitText.length * 4) + 3;
    });

    // ============ METRICS SECTION ============
    // Calculate microcycle metrics
    const metrics = calculateMicrocycleMetrics(microcycle.week_number, sortedDays, exercises);

    // Only show metrics if there's data
    if (metrics.volumeByMuscleGroup.length > 0) {
        // Start new page for metrics
        doc.addPage();
        yPos = 20;

        // Metrics Page Header
        doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        doc.roundedRect(14, yPos, pageWidth - 28, 10, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(t('training:pdf.metricsTitle', { defaultValue: 'Métricas del Microciclo' }), pageWidth / 2, yPos + 7, { align: 'center' });
        yPos += 18;

        // Summary boxes (3 boxes)
        const boxWidth = (pageWidth - 28 - 8) / 3; // 3 boxes with gaps
        const boxHeight = 20;

        // Box 1: Total Sets
        doc.setFillColor(254, 243, 199); // Amber-100
        doc.roundedRect(14, yPos, boxWidth, boxHeight, 2, 2, 'F');
        doc.setTextColor(245, 158, 11); // Amber-500
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(`${metrics.totalSets}`, 14 + boxWidth / 2, yPos + 10, { align: 'center' });
        doc.setFontSize(7);
        doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
        doc.text(t('training:pdf.totalSets', { defaultValue: 'Series Totales' }), 14 + boxWidth / 2, yPos + 16, { align: 'center' });

        // Box 2: Training Days
        const box2X = 14 + boxWidth + 4;
        doc.setFillColor(220, 252, 231); // Green-100
        doc.roundedRect(box2X, yPos, boxWidth, boxHeight, 2, 2, 'F');
        doc.setTextColor(34, 197, 94); // Green-500
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(`${metrics.trainingDays}`, box2X + boxWidth / 2, yPos + 10, { align: 'center' });
        doc.setFontSize(7);
        doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
        doc.text(t('training:pdf.trainingDays', { defaultValue: 'Días Entreno' }), box2X + boxWidth / 2, yPos + 16, { align: 'center' });

        // Box 3: Stress Index
        const box3X = 14 + (boxWidth + 4) * 2;
        doc.setFillColor(254, 226, 226); // Red-100
        doc.roundedRect(box3X, yPos, boxWidth, boxHeight, 2, 2, 'F');
        doc.setTextColor(239, 68, 68); // Red-500
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(`${metrics.averageStressIndex}`, box3X + boxWidth / 2, yPos + 10, { align: 'center' });
        doc.setFontSize(7);
        doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
        doc.text(t('training:pdf.stressIndex', { defaultValue: 'Índice Estrés' }), box3X + boxWidth / 2, yPos + 16, { align: 'center' });

        yPos += boxHeight + 12;

        // ============ EFFECTIVE SETS BAR CHART ============
        doc.setFillColor(colors.dark[0], colors.dark[1], colors.dark[2]);
        doc.roundedRect(14, yPos, pageWidth - 28, 8, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(t('training:pdf.effectiveSetsChart', { defaultValue: 'Series Efectivas por Grupo Muscular' }), 18, yPos + 5.5);
        yPos += 14;

        // Sort by effective sets descending and take top muscles
        const sortedMuscles = [...metrics.volumeByMuscleGroup]
            .filter(m => m.effectiveSets > 0)
            .sort((a, b) => b.effectiveSets - a.effectiveSets)
            .slice(0, 12); // Top 12 muscles

        if (sortedMuscles.length > 0) {
            const maxSets = Math.max(...sortedMuscles.map(m => m.effectiveSets), 20);
            const barHeight = 6;
            const labelWidth = 45;
            const chartWidth = pageWidth - 28 - labelWidth - 20;
            const barSpacing = 8;

            sortedMuscles.forEach((muscle) => {
                // Check page space
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }

                // Muscle label
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(colors.dark[0], colors.dark[1], colors.dark[2]);
                doc.text(muscle.label, 14, yPos + barHeight / 2 + 1);

                // Get volume level and color
                const level = getSetsVolumeLevel(muscle.muscleGroup, muscle.effectiveSets);
                const colorHex = getVolumeLevelColor(level);
                const rgb = hexToRgb(colorHex);

                // Bar background
                doc.setFillColor(240, 240, 240);
                doc.roundedRect(14 + labelWidth, yPos, chartWidth, barHeight, 1, 1, 'F');

                // Bar fill
                const barWidth = (muscle.effectiveSets / maxSets) * chartWidth;
                doc.setFillColor(rgb.r, rgb.g, rgb.b);
                doc.roundedRect(14 + labelWidth, yPos, barWidth, barHeight, 1, 1, 'F');

                // Value label
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.text(`${muscle.effectiveSets}`, 14 + labelWidth + chartWidth + 3, yPos + barHeight / 2 + 1);

                yPos += barSpacing;
            });

            // Legend
            yPos += 4;
            const legendX = pageWidth / 2 - 50;
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');

            // Low
            doc.setFillColor(34, 197, 94);
            doc.circle(legendX, yPos, 2, 'F');
            doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
            doc.text(t('training:pdf.low', { defaultValue: 'Bajo' }), legendX + 5, yPos + 1);

            // Optimal
            doc.setFillColor(234, 179, 8);
            doc.circle(legendX + 30, yPos, 2, 'F');
            doc.text(t('training:pdf.optimal', { defaultValue: 'Óptimo' }), legendX + 35, yPos + 1);

            // High
            doc.setFillColor(239, 68, 68);
            doc.circle(legendX + 65, yPos, 2, 'F');
            doc.text(t('training:pdf.high', { defaultValue: 'Alto' }), legendX + 70, yPos + 1);

            yPos += 12;
        }

        // ============ STRESS INDEX MAP (SVG BODY) ============
        if (yPos > 180) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFillColor(colors.dark[0], colors.dark[1], colors.dark[2]);
        doc.roundedRect(14, yPos, pageWidth - 28, 8, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(t('training:pdf.stressMap', { defaultValue: 'Mapa de Estrés Muscular' }), 18, yPos + 5.5);
        yPos += 14;

        // Render body SVGs with stress colors
        try {
            // Colorize SVGs based on muscle stress data
            const colorizedAnterior = colorizeSvg(anteriorSvgRaw, metrics.volumeByMuscleGroup);
            const colorizedPosterior = colorizeSvg(posteriorSvgRaw, metrics.volumeByMuscleGroup);

            // Convert to base64 images (SVG original size: 206.7 x 452)
            const svgWidth = 300;
            const svgHeight = 656;
            const pdfImageWidth = 35; // mm in PDF (50% smaller)
            const pdfImageHeight = pdfImageWidth * (svgHeight / svgWidth);

            const [anteriorImage, posteriorImage] = await Promise.all([
                svgToBase64Image(colorizedAnterior, svgWidth, svgHeight),
                svgToBase64Image(colorizedPosterior, svgWidth, svgHeight)
            ]);

            // Calculate positions for side-by-side layout
            const totalWidth = pdfImageWidth * 2 + 10; // Two images + gap
            const startX = (pageWidth - totalWidth) / 2;

            // Labels above images
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
            doc.text(t('training:pdf.frontView', { defaultValue: 'Vista Frontal' }), startX + pdfImageWidth / 2, yPos, { align: 'center' });
            doc.text(t('training:pdf.backView', { defaultValue: 'Vista Posterior' }), startX + pdfImageWidth + 10 + pdfImageWidth / 2, yPos, { align: 'center' });
            yPos += 4;

            // Add anterior (front) view
            doc.addImage(anteriorImage, 'PNG', startX, yPos, pdfImageWidth, pdfImageHeight);

            // Add posterior (back) view
            doc.addImage(posteriorImage, 'PNG', startX + pdfImageWidth + 10, yPos, pdfImageWidth, pdfImageHeight);

            yPos += pdfImageHeight + 8;

            // Legend for stress map
            const stressLegendX = pageWidth / 2 - 50;
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');

            doc.setFillColor(34, 197, 94);
            doc.circle(stressLegendX, yPos, 2, 'F');
            doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
            doc.text(t('training:pdf.lowStress', { defaultValue: 'Bajo' }), stressLegendX + 5, yPos + 1);

            doc.setFillColor(234, 179, 8);
            doc.circle(stressLegendX + 30, yPos, 2, 'F');
            doc.text(t('training:pdf.optimalStress', { defaultValue: 'Óptimo' }), stressLegendX + 35, yPos + 1);

            doc.setFillColor(239, 68, 68);
            doc.circle(stressLegendX + 65, yPos, 2, 'F');
            doc.text(t('training:pdf.highStress', { defaultValue: 'Alto' }), stressLegendX + 70, yPos + 1);
        } catch (error) {
            console.warn('Failed to render body SVGs:', error);
            // Fallback: show simple text message
            doc.setFontSize(10);
            doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
            doc.text(t('training:pdf.bodyMapError', { defaultValue: 'No se pudo cargar el mapa corporal' }), pageWidth / 2, yPos + 20, { align: 'center' });
            yPos += 40;
        }
    }

    // ============ FOOTER ============
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
        doc.text(
            `${t('training:pdf.page')} ${i} ${t('training:pdf.of')} ${totalPages}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );

        // FitPilot branding
        doc.setFontSize(7);
        doc.text(
            t('training:pdf.generatedWith'),
            pageWidth - 14,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'right' }
        );
    }

    // Save with descriptive filename
    const filename = clientName
        ? `${clientName.replace(/\s+/g, '_')}_${t('training:pdf.week')}${microcycle.week_number}_${microcycle.name.replace(/\s+/g, '_')}.pdf`
        : `${t('training:pdf.week')}${microcycle.week_number}_${microcycle.name.replace(/\s+/g, '_')}.pdf`;

    doc.save(filename);
};
