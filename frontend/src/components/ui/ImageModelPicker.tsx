'use client';

import { useEffect, useState } from 'react';
import {
  ModelSelector,
  DEFAULT_IMAGE_MODELS,
  IMAGE_TIER_OPTIONS,
  type ContentTier,
  type ModelOption,
} from '@/components/ui/ModelSelector';
import { useImageModels } from '@/hooks/useModels';
import {
  downloadModel,
  getModelDownloadStatus,
  getErrorMessage,
} from '@/lib/api';

interface ImageModelPickerProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  /** Dark studio panel vs standalone card page */
  variant?: 'studio' | 'default';
  defaultTier?: ContentTier;
}

export function ImageModelPicker({
  value,
  onChange,
  disabled = false,
  variant = 'default',
  defaultTier = 'nsfw',
}: ImageModelPickerProps) {
  const [tier, setTier] = useState<ContentTier>(defaultTier);

  useEffect(() => {
    setTier(defaultTier);
  }, [defaultTier]);
  const { models, loading, refresh } = useImageModels(DEFAULT_IMAGE_MODELS, tier);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadMessage('Starting Hugging Face download…');
    setDownloadError(null);

    try {
      let status = await downloadModel({ model_id: value, kind: 'image' });

      while (
        status.status === 'pending' ||
        status.status === 'downloading' ||
        status.status === 'converting'
      ) {
        setDownloadMessage(status.message);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        status = await getModelDownloadStatus(status.download_id);
      }

      if (status.status === 'failed') {
        throw new Error(status.error || 'Model download failed');
      }

      setDownloadMessage('Download complete — model is ready.');
      await refresh();
    } catch (err) {
      setDownloadError(getErrorMessage(err));
      setDownloadMessage(null);
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (models.length > 0 && !models.find((m) => m.id === value)) {
      onChange(models[0].id);
    }
  }, [models, value, onChange]);

  const labelClass =
    variant === 'studio'
      ? 'text-sm font-medium text-zinc-200'
      : 'block text-sm font-medium text-gray-700 dark:text-gray-200';

  const chipInactive =
    variant === 'studio'
      ? 'bg-white/5 text-zinc-300 hover:bg-white/10'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700';

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <span className={labelClass}>Look tier</span>
        <div className="flex flex-wrap gap-2">
          {IMAGE_TIER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTier(opt.id)}
              disabled={disabled}
              className={`
                rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-50
                ${tier === opt.id
                  ? opt.id === 'nsfw'
                    ? 'bg-rose-600 text-white'
                    : 'bg-violet-600 text-white'
                  : chipInactive
                }
              `}
            >
              {opt.label}
              {opt.id === 'nsfw' && tier !== 'nsfw' ? ' · 8' : ''}
              {opt.id === 'all' && tier === 'all' ? ` · ${models.length}` : ''}
            </button>
          ))}
        </div>
        {variant === 'studio' && (
          <p className="text-xs text-zinc-500">
            Eight explicit Flux LoRAs on one shared base — uncensored skin, no modesty filter.
          </p>
        )}
      </div>

      <ModelSelector
        label="Look & body model"
        models={models}
        value={value}
        onChange={onChange}
        disabled={disabled || isDownloading}
        isLoading={loading}
        fullWidth
        variant={variant === 'studio' ? 'studio' : 'default'}
        placeholder="Pick an explicit Flux LoRA..."
        onDownload={handleDownload}
        isDownloading={isDownloading}
        downloadMessage={downloadMessage}
      />

      {downloadError && (
        <p className="text-xs text-rose-400">{downloadError}</p>
      )}
    </div>
  );
}

export type { ModelOption, ContentTier };