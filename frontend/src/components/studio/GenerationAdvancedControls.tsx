'use client';

import { useState } from 'react';
import { Input, TextArea } from '@/components/ui/Input';

export interface ImageAdvancedSettings {
  seed?: number;
  negativePrompt?: string;
  size?: string;
  batchCount?: number;
  seedWalk?: number;
  steps?: number;
  guidance?: number;
  loraScale?: number;
}

export interface VideoAdvancedSettings {
  seed?: number;
  negativePrompt?: string;
  motionNegativePrompt?: string;
  pureT2v?: boolean;
  motionStrength?: number;
  refinePrompt?: string;
  refineStrength?: number;
}

export const IMAGE_SIZE_PRESETS = [
  { id: '1024x1024', label: 'Square 1024' },
  { id: '768x1024', label: 'Portrait 3:4' },
  { id: '1024x768', label: 'Landscape 4:3' },
  { id: '480x704', label: 'Wan 9:16' },
  { id: '768x512', label: 'LTX 3:2' },
  { id: '704x480', label: 'Wan 16:9' },
] as const;

interface GenerationAdvancedControlsProps {
  mode: 'image' | 'video';
  imageSettings?: ImageAdvancedSettings;
  videoSettings?: VideoAdvancedSettings;
  onImageChange?: (settings: ImageAdvancedSettings) => void;
  onVideoChange?: (settings: VideoAdvancedSettings) => void;
  disabled?: boolean;
}

function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseOptionalFloat(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseFloat(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function GenerationAdvancedControls({
  mode,
  imageSettings = {},
  videoSettings = {},
  onImageChange,
  onVideoChange,
  disabled = false,
}: GenerationAdvancedControlsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-white/10 bg-black/25">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-zinc-200 transition hover:bg-white/5 disabled:opacity-50"
      >
        <span>Advanced controls</span>
        <span className="text-xs text-zinc-500">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-white/10 px-3 py-3">
          {mode === 'image' && onImageChange && (
            <>
              <div className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Size preset</span>
                <div className="flex flex-wrap gap-2">
                  {IMAGE_SIZE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => onImageChange({ ...imageSettings, size: preset.id })}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        imageSettings.size === preset.id
                          ? 'bg-rose-600 text-white'
                          : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Seed"
                  placeholder="Random"
                  value={imageSettings.seed?.toString() ?? ''}
                  onChange={(e) =>
                    onImageChange({ ...imageSettings, seed: parseOptionalInt(e.target.value) })
                  }
                  disabled={disabled}
                />
                <Input
                  label="Seed walk (variants)"
                  placeholder="1"
                  value={imageSettings.seedWalk?.toString() ?? ''}
                  onChange={(e) =>
                    onImageChange({ ...imageSettings, seedWalk: parseOptionalInt(e.target.value) })
                  }
                  disabled={disabled}
                  helperText="Consecutive seeds from base"
                />
                <Input
                  label="Batch count (n)"
                  placeholder="1"
                  value={imageSettings.batchCount?.toString() ?? ''}
                  onChange={(e) =>
                    onImageChange({ ...imageSettings, batchCount: parseOptionalInt(e.target.value) })
                  }
                  disabled={disabled}
                />
                <Input
                  label="Steps"
                  placeholder="Catalog default"
                  value={imageSettings.steps?.toString() ?? ''}
                  onChange={(e) =>
                    onImageChange({ ...imageSettings, steps: parseOptionalInt(e.target.value) })
                  }
                  disabled={disabled}
                />
                <Input
                  label="Guidance"
                  placeholder="Catalog default"
                  value={imageSettings.guidance?.toString() ?? ''}
                  onChange={(e) =>
                    onImageChange({ ...imageSettings, guidance: parseOptionalFloat(e.target.value) })
                  }
                  disabled={disabled}
                />
                <Input
                  label="LoRA scale"
                  placeholder="Catalog default"
                  value={imageSettings.loraScale?.toString() ?? ''}
                  onChange={(e) =>
                    onImageChange({ ...imageSettings, loraScale: parseOptionalFloat(e.target.value) })
                  }
                  disabled={disabled}
                />
              </div>

              <TextArea
                label="Negative prompt"
                placeholder="Optional override — anti-clothing prompt used in uncensored mode"
                value={imageSettings.negativePrompt ?? ''}
                onChange={(e) =>
                  onImageChange({ ...imageSettings, negativePrompt: e.target.value || undefined })
                }
                disabled={disabled}
                rows={2}
                variant="studio"
              />
            </>
          )}

          {mode === 'video' && onVideoChange && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Seed"
                  placeholder="Random"
                  value={videoSettings.seed?.toString() ?? ''}
                  onChange={(e) =>
                    onVideoChange({ ...videoSettings, seed: parseOptionalInt(e.target.value) })
                  }
                  disabled={disabled}
                />
                <Input
                  label="Motion strength"
                  placeholder="0.5"
                  value={videoSettings.motionStrength?.toString() ?? ''}
                  onChange={(e) =>
                    onVideoChange({
                      ...videoSettings,
                      motionStrength: parseOptionalFloat(e.target.value),
                    })
                  }
                  disabled={disabled}
                  helperText="0 = subtle, 1 = dramatic"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={videoSettings.pureT2v ?? false}
                  disabled={disabled}
                  onChange={(e) =>
                    onVideoChange({ ...videoSettings, pureT2v: e.target.checked })
                  }
                  className="rounded border-white/20 bg-black/40 text-violet-500 focus:ring-violet-500"
                />
                Pure text-to-video (skip Flux keyframe — Wan T2V only)
              </label>

              <TextArea
                label="Keyframe negative prompt"
                placeholder="Used when hybrid T2V renders a Flux keyframe first"
                value={videoSettings.negativePrompt ?? ''}
                onChange={(e) =>
                  onVideoChange({ ...videoSettings, negativePrompt: e.target.value || undefined })
                }
                disabled={disabled}
                rows={2}
                variant="studio"
              />

              <TextArea
                label="Motion negative prompt"
                placeholder="Passed to Wan / LTX motion engine"
                value={videoSettings.motionNegativePrompt ?? ''}
                onChange={(e) =>
                  onVideoChange({
                    ...videoSettings,
                    motionNegativePrompt: e.target.value || undefined,
                  })
                }
                disabled={disabled}
                rows={2}
                variant="studio"
              />

              <TextArea
                label="Refine still before animate (optional)"
                placeholder="e.g. sharpen skin detail, adjust lighting..."
                value={videoSettings.refinePrompt ?? ''}
                onChange={(e) =>
                  onVideoChange({ ...videoSettings, refinePrompt: e.target.value || undefined })
                }
                disabled={disabled}
                rows={2}
                variant="studio"
              />

              <Input
                label="Refine strength"
                placeholder="0.35"
                value={videoSettings.refineStrength?.toString() ?? ''}
                onChange={(e) =>
                  onVideoChange({
                    ...videoSettings,
                    refineStrength: parseOptionalFloat(e.target.value),
                  })
                }
                disabled={disabled}
                helperText="Redux strength before animation (0 = skip)"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}