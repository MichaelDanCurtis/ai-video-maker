'use client';

import {
  ASPECT_OPTIONS,
  DURATION_OPTIONS,
  FPS_OPTIONS,
  PHOTO_ASPECT_OPTIONS,
  type AspectRatioPreset,
  formatPresetSummary,
} from '@/lib/videoPresets';

interface VideoPresetControlsProps {
  mode: 'text' | 'photo';
  aspectRatio: AspectRatioPreset;
  duration: number;
  fps: number;
  modelId: string;
  disabled?: boolean;
  onAspectChange: (value: AspectRatioPreset) => void;
  onDurationChange: (value: number) => void;
  onFpsChange: (value: number) => void;
}

export function VideoPresetControls({
  mode,
  aspectRatio,
  duration,
  fps,
  modelId,
  disabled = false,
  onAspectChange,
  onDurationChange,
  onFpsChange,
}: VideoPresetControlsProps) {
  const aspectOptions = mode === 'photo' ? PHOTO_ASPECT_OPTIONS : ASPECT_OPTIONS;
  const summary = formatPresetSummary({ aspect: aspectRatio, duration, fps, modelId });

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
      <div>
        <p className="text-sm font-medium text-white">Clip settings</p>
        <p className="mt-0.5 text-xs text-zinc-500">{summary}</p>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Aspect ratio
        </span>
        <div className="flex flex-wrap gap-2">
          {aspectOptions.map((option) => {
            const active = aspectRatio === option.id;
            return (
              <button
                key={option.id}
                type="button"
                title={option.hint}
                disabled={disabled}
                onClick={() => onAspectChange(option.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-900/30'
                    : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
                } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Length
          </span>
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((option) => {
              const active = duration === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  title={option.hint}
                  disabled={disabled}
                  onClick={() => onDurationChange(option.value)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-violet-600 text-white'
                      : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
                  } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Frame rate
          </span>
          <div className="flex flex-wrap gap-2">
            {FPS_OPTIONS.map((option) => {
              const active = fps === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onFpsChange(option.value)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-violet-600 text-white'
                      : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
                  } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}