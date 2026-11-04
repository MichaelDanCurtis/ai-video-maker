'use client';

import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Input';
import { FileUpload } from '@/components/ui/FileUpload';
import { VideoPresetControls } from '@/components/studio/VideoPresetControls';
import type { AspectRatioPreset } from '@/lib/videoPresets';

const SHOT_COUNTS = [2, 3, 4, 5, 6, 7, 8] as const;

interface ChainSegmentControlsProps {
  segmentIndex: number;
  segmentNarration: string;
  onSegmentNarrationChange: (value: string) => void;
  chainStart: 'text' | 'photo';
  onChainStartChange: (value: 'text' | 'photo') => void;
  openingPrompt: string;
  onOpeningPromptChange: (value: string) => void;
  continuationPrompt: string;
  onContinuationPromptChange: (value: string) => void;
  shotCount: number;
  onShotCountChange: (value: number) => void;
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  modelId: string;
  aspectRatio: AspectRatioPreset;
  duration: number;
  fps: number;
  disabled?: boolean;
  isWorking?: boolean;
  onRunSegment: () => void;
  onNextSegment: () => void;
  onAspectChange: (value: AspectRatioPreset) => void;
  onDurationChange: (value: number) => void;
  onFpsChange: (value: number) => void;
}

export function ChainSegmentControls({
  segmentIndex,
  segmentNarration,
  onSegmentNarrationChange,
  chainStart,
  onChainStartChange,
  openingPrompt,
  onOpeningPromptChange,
  continuationPrompt,
  onContinuationPromptChange,
  shotCount,
  onShotCountChange,
  selectedFile,
  onFileSelect,
  modelId,
  aspectRatio,
  duration,
  fps,
  disabled = false,
  isWorking = false,
  onRunSegment,
  onNextSegment,
  onAspectChange,
  onDurationChange,
  onFpsChange,
}: ChainSegmentControlsProps) {
  const canRun =
    chainStart === 'text' ? openingPrompt.trim().length > 0 : selectedFile !== null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-rose-500/25 bg-gradient-to-br from-rose-950/25 to-black/40 p-4">
        <p className="text-sm font-semibold text-rose-200">Scene {segmentIndex + 1}</p>
        <p className="mt-1 text-xs text-zinc-500">
          Linked shots — each frame seeds from the last. Perfect for slow reveals and continuous motion.
        </p>
      </div>

      <TextArea
        label="Narration for this segment"
        placeholder="Describe what should happen across these linked shots — tone, story beat, camera feel..."
        value={segmentNarration}
        onChange={(e) => onSegmentNarrationChange(e.target.value)}
        disabled={disabled || isWorking}
        fullWidth
        rows={3}
      />

      <div className="flex gap-1 rounded-xl bg-black/30 p-1">
        {(['text', 'photo'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            disabled={disabled || isWorking}
            onClick={() => onChainStartChange(tab)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              chainStart === tab
                ? 'bg-violet-600 text-white'
                : 'text-zinc-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            {tab === 'text' ? 'Open with text' : 'Open with photo'}
          </button>
        ))}
      </div>

      {chainStart === 'photo' ? (
        <FileUpload
          label="First-frame photo"
          accept="image/*"
          maxSize={10 * 1024 * 1024}
          onFileSelect={(files) => onFileSelect(files[0] ?? null)}
          disabled={disabled || isWorking}
          fullWidth
          helperText="This becomes shot 1 — later shots continue from each clip's last frame"
        />
      ) : (
        <TextArea
          label="Opening shot prompt"
          placeholder="Shot 1: she steps into frame, nude, soft rim light, camera holds then begins a slow dolly in..."
          value={openingPrompt}
          onChange={(e) => onOpeningPromptChange(e.target.value)}
          disabled={disabled || isWorking}
          fullWidth
          rows={3}
        />
      )}

      <TextArea
        label="Continuation motion (shots 2+)"
        placeholder="Gentle forward camera move, subject turns toward the light, leaves keep drifting..."
        value={continuationPrompt}
        onChange={(e) => onContinuationPromptChange(e.target.value)}
        disabled={disabled || isWorking}
        fullWidth
        rows={2}
      />

      <div className="space-y-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Linked shots in this segment
        </span>
        <div className="flex flex-wrap gap-2">
          {SHOT_COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              disabled={disabled || isWorking}
              onClick={() => onShotCountChange(count)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                shotCount === count
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/5 text-zinc-300 hover:bg-white/10'
              }`}
            >
              {count} shots
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          Each shot after the first seeds from the previous clip&apos;s last frame (~{duration}s each).
        </p>
      </div>

      <VideoPresetControls
        mode="photo"
        aspectRatio={aspectRatio}
        duration={duration}
        fps={fps}
        modelId={modelId}
        disabled={disabled || isWorking}
        onAspectChange={onAspectChange}
        onDurationChange={onDurationChange}
        onFpsChange={onFpsChange}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="velvet"
          fullWidth
          onClick={onRunSegment}
          disabled={!canRun || disabled || isWorking}
          isLoading={isWorking}
        >
          {isWorking ? 'Rendering linked shots...' : `Render ${shotCount} linked shots`}
        </Button>
        <Button
          variant="outline"
          fullWidth
          onClick={onNextSegment}
          disabled={disabled || isWorking}
        >
          Start next segment
        </Button>
      </div>
    </div>
  );
}