export type AspectRatioPreset = '9:16' | '16:9' | '1:1' | '4:5' | '3:4' | 'auto';

export interface AspectOption {
  id: AspectRatioPreset;
  label: string;
  hint: string;
}

export const ASPECT_OPTIONS: AspectOption[] = [
  { id: '9:16', label: '9:16', hint: 'Portrait · Reels / TikTok' },
  { id: '16:9', label: '16:9', hint: 'Landscape · YouTube' },
  { id: '1:1', label: '1:1', hint: 'Square' },
  { id: '4:5', label: '4:5', hint: 'Instagram portrait' },
  { id: '3:4', label: '3:4', hint: 'Classic portrait' },
];

export const PHOTO_ASPECT_OPTIONS: AspectOption[] = [
  { id: 'auto', label: 'Match photo', hint: 'Keep your image proportions' },
  ...ASPECT_OPTIONS,
];

export const DURATION_OPTIONS = [
  { value: 2, label: '2s', hint: 'Quick loop' },
  { value: 3, label: '3s', hint: 'Short clip' },
  { value: 4, label: '4s', hint: 'Default' },
  { value: 5, label: '5s', hint: 'Longer motion' },
  { value: 6, label: '6s', hint: 'Extended' },
] as const;

export const FPS_OPTIONS = [
  { value: 24, label: '24 fps' },
  { value: 30, label: '30 fps' },
] as const;

const ASPECT_RATIOS: Record<Exclude<AspectRatioPreset, 'auto'>, number> = {
  '9:16': 9 / 16,
  '16:9': 16 / 9,
  '1:1': 1,
  '4:5': 4 / 5,
  '3:4': 3 / 4,
};

const MODEL_BOX = {
  wan: { width: 480, height: 704 },
  ltx: { width: 768, height: 512 },
} as const;

function alignmentStep(modelId: string): number {
  return modelId.includes('ltx') ? 64 : 8;
}

function align(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}

export function estimateDimensions(
  aspect: AspectRatioPreset,
  modelId: string
): { width: number; height: number } | null {
  if (aspect === 'auto') return null;

  const box = modelId.includes('ltx') ? MODEL_BOX.ltx : MODEL_BOX.wan;
  const step = alignmentStep(modelId);
  const ratio = ASPECT_RATIOS[aspect];
  const boxRatio = box.width / box.height;

  if (ratio >= boxRatio) {
    return { width: box.width, height: align(box.width / ratio, step) };
  }
  return { width: align(box.height * ratio, step), height: box.height };
}

export function estimateFrameCount(
  duration: number,
  fps: number,
  modelId: string
): number {
  const target = Math.max(5, Math.round(duration * fps));
  if (modelId.includes('ltx')) {
    return Math.max(9, target);
  }
  const n = Math.round((target - 1) / 4);
  return Math.max(5, 4 * n + 1);
}

export function formatPresetSummary(options: {
  aspect: AspectRatioPreset;
  duration: number;
  fps: number;
  modelId: string;
}): string {
  const dims = estimateDimensions(options.aspect, options.modelId);
  const frames = estimateFrameCount(options.duration, options.fps, options.modelId);
  const seconds = (frames / options.fps).toFixed(1);

  if (dims) {
    return `${dims.width} × ${dims.height} · ~${seconds}s @ ${options.fps} fps`;
  }
  return `Match photo · ~${seconds}s @ ${options.fps} fps`;
}