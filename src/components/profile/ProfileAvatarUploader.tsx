import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, MoveHorizontal, MoveVertical, Pencil, ZoomIn } from 'lucide-react';
import { Modal } from '@/components/common/Modal';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_AVATAR_BYTES = 1024 * 1024; // 1MB
const MAX_SOURCE_BYTES = 12 * 1024 * 1024; // hard cap to avoid huge images
const OUTPUT_SIZE = 512;
const PREVIEW_SIZE = 288;

type CropDraft = {
    src: string;
    naturalWidth: number;
    naturalHeight: number;
};

interface ProfileAvatarUploaderProps {
    firstName?: string;
    lastName?: string;
    imageUrl?: string | null;
    onSave: (imageBlob: Blob) => Promise<void> | void;
    isSaving?: boolean;
    previewMode?: 'modal' | 'overlay';
}

type CropRect = {
    sx: number;
    sy: number;
    side: number;
};

type AdjustmentSliderProps = {
    label: string;
    valueLabel: string;
    min: number;
    max: number;
    step: number;
    value: number;
    disabled?: boolean;
    icon: ReactNode;
    minHint: string;
    maxHint: string;
    onChange: (value: number) => void;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function AdjustmentSlider({
    label,
    valueLabel,
    min,
    max,
    step,
    value,
    disabled,
    icon,
    minHint,
    maxHint,
    onChange,
}: AdjustmentSliderProps) {
    const fillPercent = ((value - min) / (max - min)) * 100;

    return (
        <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-3 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                        {icon}
                    </span>
                    <span>{label}</span>
                </div>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600 tabular-nums">
                    {valueLabel}
                </span>
            </div>

            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                disabled={disabled}
                aria-label={label}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-transparent disabled:cursor-not-allowed disabled:opacity-60 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(37,99,235,0.35)] [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:shadow-sm"
                style={{
                    background: `linear-gradient(90deg, rgb(37 99 235) 0%, rgb(59 130 246) ${fillPercent}%, rgb(229 231 235) ${fillPercent}%, rgb(229 231 235) 100%)`,
                }}
            />

            <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-gray-400">
                <span>{minHint}</span>
                <span>{maxHint}</span>
            </div>
        </div>
    );
}

function getInitials(firstName?: string, lastName?: string) {
    const first = firstName?.trim()?.charAt(0)?.toUpperCase() ?? '';
    const last = lastName?.trim()?.charAt(0)?.toUpperCase() ?? '';
    return (first + last || first || 'U').slice(0, 2);
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('No se pudo cargar la imagen seleccionada.'));
        img.src = src;
    });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('No se pudo procesar la imagen.'));
                return;
            }
            resolve(blob);
        }, type, quality);
    });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('No se pudo leer la imagen procesada.'));
        reader.readAsDataURL(blob);
    });
}

function getCropRect(width: number, height: number, zoom: number, offsetX: number, offsetY: number): CropRect {
    const baseSide = Math.min(width, height);
    const side = clamp(baseSide / zoom, 64, baseSide);
    const maxX = Math.max(0, (width - side) / 2);
    const maxY = Math.max(0, (height - side) / 2);

    const sx = clamp(width / 2 - side / 2 + (offsetX / 100) * maxX, 0, width - side);
    const sy = clamp(height / 2 - side / 2 + (offsetY / 100) * maxY, 0, height - side);

    return { sx, sy, side };
}

function downscaleCanvas(sourceCanvas: HTMLCanvasElement, nextSize: number) {
    const canvas = document.createElement('canvas');
    canvas.width = nextSize;
    canvas.height = nextSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('No se pudo redimensionar la imagen.');
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, nextSize, nextSize);
    return canvas;
}

async function compressCanvasUnder1MB(canvas: HTMLCanvasElement): Promise<Blob> {
    const qualitySteps = [0.92, 0.84, 0.76, 0.68, 0.6, 0.5, 0.4];
    let workingCanvas = canvas;
    let bestBlob: Blob | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
        for (const quality of qualitySteps) {
            const blob = await canvasToBlob(workingCanvas, 'image/jpeg', quality);
            if (!bestBlob || blob.size < bestBlob.size) {
                bestBlob = blob;
            }
            if (blob.size <= MAX_AVATAR_BYTES) {
                return blob;
            }
        }

        if (workingCanvas.width <= 256) break;
        const nextSize = Math.max(256, Math.round(workingCanvas.width * 0.85));
        workingCanvas = downscaleCanvas(workingCanvas, nextSize);
    }

    if (!bestBlob) {
        throw new Error('No se pudo comprimir la imagen.');
    }

    if (bestBlob.size > MAX_AVATAR_BYTES) {
        throw new Error('La imagen sigue pesando más de 1MB incluso después de comprimirla.');
    }

    return bestBlob;
}

export function ProfileAvatarUploader({
    firstName,
    lastName,
    imageUrl,
    onSave,
    isSaving = false,
    previewMode = 'modal',
}: ProfileAvatarUploaderProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [displayImage, setDisplayImage] = useState<string | null>(imageUrl ?? null);
    const [draft, setDraft] = useState<CropDraft | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [zoom, setZoom] = useState(1.2);
    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        setDisplayImage(imageUrl ?? null);
    }, [imageUrl]);

    useEffect(() => {
        return () => {
            if (draft?.src?.startsWith('blob:')) {
                URL.revokeObjectURL(draft.src);
            }
        };
    }, [draft]);

    useEffect(() => {
        if (!isPreviewOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsPreviewOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPreviewOpen]);

    const initials = useMemo(() => getInitials(firstName, lastName), [firstName, lastName]);
    const isBusy = isSaving || isProcessing;

    const cropRect = useMemo(() => {
        if (!draft) return null;
        return getCropRect(draft.naturalWidth, draft.naturalHeight, zoom, offsetX, offsetY);
    }, [draft, zoom, offsetX, offsetY]);

    const previewStyle = useMemo(() => {
        if (!draft || !cropRect) return undefined;
        const scale = PREVIEW_SIZE / cropRect.side;
        return {
            width: `${draft.naturalWidth * scale}px`,
            height: `${draft.naturalHeight * scale}px`,
            left: `${-cropRect.sx * scale}px`,
            top: `${-cropRect.sy * scale}px`,
        };
    }, [draft, cropRect]);

    const zoomLabel = `${zoom.toFixed(2)}x`;

    const resetCropControls = () => {
        setZoom(1.2);
        setOffsetX(0);
        setOffsetY(0);
    };

    const closeCropModal = () => {
        setError(null);
        if (draft?.src?.startsWith('blob:')) {
            URL.revokeObjectURL(draft.src);
        }
        setDraft(null);
        resetCropControls();
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const handleOpenFilePicker = () => {
        if (!isBusy) {
            setIsPreviewOpen(false);
            inputRef.current?.click();
        }
    };

    const handleFileSelected = async (file?: File) => {
        if (!file) return;

        setError(null);
        setSuccess(null);

        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
            setError('Formato no permitido. Usa JPG, PNG o WEBP.');
            return;
        }

        if (file.size > MAX_SOURCE_BYTES) {
            setError('La imagen es demasiado grande para procesarla. Usa una menor a 12MB.');
            return;
        }

        try {
            const objectUrl = URL.createObjectURL(file);
            const img = await loadImage(objectUrl);

            if (draft?.src?.startsWith('blob:')) {
                URL.revokeObjectURL(draft.src);
            }

            setDraft({
                src: objectUrl,
                naturalWidth: img.naturalWidth || img.width,
                naturalHeight: img.naturalHeight || img.height,
            });
            resetCropControls();
        } catch (e: any) {
            setError(e?.message || 'No se pudo abrir la imagen.');
        }
    };

    const handleCropAndSave = async () => {
        if (!draft || !cropRect) return;
        setError(null);
        setSuccess(null);
        setIsProcessing(true);

        try {
            const image = await loadImage(draft.src);
            const canvas = document.createElement('canvas');
            canvas.width = OUTPUT_SIZE;
            canvas.height = OUTPUT_SIZE;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('No se pudo preparar el recorte.');
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(
                image,
                cropRect.sx,
                cropRect.sy,
                cropRect.side,
                cropRect.side,
                0,
                0,
                OUTPUT_SIZE,
                OUTPUT_SIZE
            );

            const compressedBlob = await compressCanvasUnder1MB(canvas);
            const imageDataUrl = await blobToDataUrl(compressedBlob);

            await onSave(compressedBlob);

            setDisplayImage(imageDataUrl);
            setSuccess(`Foto actualizada (${Math.round(compressedBlob.size / 1024)} KB).`);
            closeCropModal();
        } catch (e: any) {
            setError(e?.message || 'No se pudo guardar la foto.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
                <button
                    type="button"
                    onClick={() => setIsPreviewOpen(true)}
                    className="group relative block rounded-[1.25rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    aria-label="Ver foto de perfil"
                >
                    <div className="w-28 h-28 md:w-32 md:h-32 rounded-[1.25rem] overflow-hidden bg-linear-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/25 ring-1 ring-white">
                        {displayImage ? (
                            <img
                                src={displayImage}
                                alt="Foto de perfil"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold">
                                {initials}
                            </div>
                        )}
                    </div>
                    <div className="absolute inset-0 rounded-[1.25rem] bg-gray-900/0 group-hover:bg-gray-900/5 transition-colors" />
                </button>

                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        handleOpenFilePicker();
                    }}
                    disabled={isBusy}
                    className="absolute -bottom-1 -right-1 flex items-center justify-center w-8 h-8 rounded-full bg-white/95 border border-gray-200 shadow-sm text-gray-500 hover:text-blue-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
                    aria-label="Editar foto de perfil"
                >
                    <Pencil className="w-3.5 h-3.5" />
                </button>

                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES.join(',')}
                    className="hidden"
                    onChange={(e) => handleFileSelected(e.target.files?.[0])}
                />
            </div>

            <button
                type="button"
                onClick={handleOpenFilePicker}
                disabled={isBusy}
                className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50"
            >
                <Camera className="w-3.5 h-3.5" />
                Cambiar foto
            </button>

            {success && (
                <p className="mt-2 text-xs text-emerald-600 font-medium">{success}</p>
            )}
            {error && !draft && (
                <p className="mt-2 text-xs text-red-600 max-w-[240px]">{error}</p>
            )}

            <Modal
                isOpen={!!draft}
                onClose={() => {
                    if (!isBusy) closeCropModal();
                }}
                title="Recortar foto de perfil"
                size="lg"
            >
                {draft && cropRect && (
                    <div className="space-y-5">
                        <div className="flex flex-col lg:flex-row gap-5">
                            <div className="mx-auto lg:mx-0">
                                <div className="relative w-72 h-72 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100">
                                    <img
                                        src={draft.src}
                                        alt="Previsualización de recorte"
                                        className="absolute max-w-none select-none pointer-events-none"
                                        style={previewStyle}
                                        draggable={false}
                                    />
                                    <div className="absolute inset-0 ring-1 ring-inset ring-black/5" />
                                </div>
                            </div>

                            <div className="flex-1 space-y-4">
                                <p className="text-sm text-gray-600">
                                    Ajusta el recorte. La imagen se comprimirá automáticamente para intentar quedar por debajo de 1MB.
                                </p>

                                <div className="space-y-3">
                                    <AdjustmentSlider
                                        label="Zoom"
                                        valueLabel={zoomLabel}
                                        min={1}
                                        max={3}
                                        step={0.05}
                                        value={zoom}
                                        onChange={setZoom}
                                        disabled={isBusy}
                                        icon={<ZoomIn className="w-4 h-4" />}
                                        minHint="1x"
                                        maxHint="3x"
                                    />

                                    <AdjustmentSlider
                                        label="Horizontal"
                                        valueLabel={`${offsetX > 0 ? '+' : ''}${offsetX}`}
                                        min={-100}
                                        max={100}
                                        step={1}
                                        value={offsetX}
                                        onChange={setOffsetX}
                                        disabled={isBusy}
                                        icon={<MoveHorizontal className="w-4 h-4" />}
                                        minHint="Izquierda"
                                        maxHint="Derecha"
                                    />

                                    <AdjustmentSlider
                                        label="Vertical"
                                        valueLabel={`${offsetY > 0 ? '+' : ''}${offsetY}`}
                                        min={-100}
                                        max={100}
                                        step={1}
                                        value={offsetY}
                                        onChange={setOffsetY}
                                        disabled={isBusy}
                                        icon={<MoveVertical className="w-4 h-4" />}
                                        minHint="Arriba"
                                        maxHint="Abajo"
                                    />
                                </div>

                                <div className="text-xs text-gray-400">
                                    Salida estimada: JPG cuadrado optimizado.
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={closeCropModal}
                                disabled={isBusy}
                                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleCropAndSave}
                                disabled={isBusy}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {isBusy ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : null}
                                Guardar foto
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {previewMode === 'modal' ? (
                <Modal
                    isOpen={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                    title="Foto de perfil"
                    size="sm"
                >
                    <div className="flex items-center justify-center pt-4 pb-10">
                        <div className="w-64 h-64 sm:w-76 sm:h-76 aspect-square rounded-4xl overflow-hidden shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] ring-1 ring-gray-900/5 bg-linear-to-br from-blue-500 to-blue-600">
                            {displayImage ? (
                                <img
                                    src={displayImage}
                                    alt="Foto de perfil ampliada"
                                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-white text-6xl font-light">
                                    {initials}
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            ) : null}

            {previewMode === 'overlay' && isPreviewOpen ? (
                <div
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
                    onClick={() => setIsPreviewOpen(false)}
                    role="button"
                    tabIndex={-1}
                    aria-label="Cerrar vista previa de foto de perfil"
                >
                    <div
                        className="w-52 h-52 sm:w-64 sm:h-64 md:w-72 md:h-72 aspect-square rounded-[1.75rem] overflow-hidden shadow-[0_35px_70px_-25px_rgba(0,0,0,0.6)] ring-1 ring-white/20 bg-linear-to-br from-blue-500 to-blue-600"
                        onClick={() => setIsPreviewOpen(false)}
                    >
                        {displayImage ? (
                            <img
                                src={displayImage}
                                alt="Foto de perfil ampliada"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white text-6xl font-light">
                                {initials}
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
