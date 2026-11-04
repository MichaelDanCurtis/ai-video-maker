'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export type ContentTier = 'all' | 'nsfw' | 'general' | 'fast';

export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  provider?: string;
  capabilities?: string[];
  nsfw?: boolean;
  uncensored?: boolean;
  content_tier?: ContentTier;
  ready?: boolean;
}

interface ModelSelectorProps {
  models: ModelOption[];
  value: string;
  onChange: (modelId: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  isLoading?: boolean;
  fullWidth?: boolean;
  downloadMessage?: string | null;
  isDownloading?: boolean;
  onDownload?: () => void;
  variant?: 'default' | 'studio';
}

export function ModelSelector({
  models,
  value,
  onChange,
  label = 'Model',
  placeholder = 'Select a model...',
  error,
  disabled = false,
  isLoading = false,
  fullWidth = false,
  downloadMessage = null,
  isDownloading = false,
  onDownload,
  variant = 'default',
}: ModelSelectorProps) {
  const isStudio = variant === 'studio';
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedModel = models.find((m) => m.id === value);

  const filteredModels = searchQuery
    ? models.filter(
        (m) =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.provider?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : models;

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
      setIsOpen(false);
      setSearchQuery('');
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const handleSelect = (modelId: string) => {
    onChange(modelId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
    } else if (e.key === 'Enter' && filteredModels.length === 1) {
      handleSelect(filteredModels[0].id);
    }
  };

  return (
    <div className={fullWidth ? 'w-full' : ''} ref={containerRef}>
      {label && (
        <label
          className={
            isStudio
              ? 'studio-label mb-1.5'
              : 'block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1'
          }
        >
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            if (!disabled && !isLoading) {
              setIsOpen(!isOpen);
              if (!isOpen) {
                setTimeout(() => inputRef.current?.focus(), 0);
              }
            }
          }}
          disabled={disabled || isLoading}
          className={`
            relative w-full cursor-pointer rounded-xl border py-2.5 pl-3 pr-10 text-left transition-colors focus:outline-none focus:ring-2
            ${isStudio
              ? `bg-black/40 text-zinc-100 focus:ring-rose-500/30 ${error ? 'border-red-500' : 'border-rose-500/25 hover:border-rose-500/40'}`
              : `bg-white dark:bg-gray-900 focus:ring-blue-500 ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'}`
            }
            ${disabled || isLoading ? 'cursor-not-allowed opacity-60' : ''}
          `}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          {isLoading ? (
            <span className="flex items-center text-gray-500 dark:text-gray-400">
              <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Loading models...
            </span>
          ) : selectedModel ? (
            <span className="flex items-center gap-2">
              <span className={`block truncate ${isStudio ? 'text-zinc-100' : 'text-gray-900 dark:text-white'}`}>
                {selectedModel.name}
              </span>
              {selectedModel.nsfw && isStudio && (
                <span className="shrink-0 rounded bg-rose-900/60 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-300">
                  18+
                </span>
              )}
            </span>
          ) : (
            <span className={`block truncate ${isStudio ? 'text-zinc-500' : 'text-gray-400 dark:text-gray-500'}`}>
              {placeholder}
            </span>
          )}
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <svg
              className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </button>

        {isOpen && (
          <div
            className={`absolute z-10 mt-1 w-full rounded-xl border shadow-xl ${
              isStudio
                ? 'border-rose-500/25 bg-[#120a10] shadow-rose-950/40'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}
          >
            <div className={`p-2 border-b ${isStudio ? 'border-rose-500/15' : 'border-gray-200 dark:border-gray-700'}`}>
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search models..."
                className={
                  isStudio
                    ? 'studio-input text-sm'
                    : `w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600
                  bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white
                  placeholder-gray-400 dark:placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-blue-500`
                }
              />
            </div>
            <ul
              className="max-h-60 overflow-auto py-1"
              role="listbox"
            >
              {filteredModels.length === 0 ? (
                <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                  No models found
                </li>
              ) : (
                filteredModels.map((model) => (
                  <li
                    key={model.id}
                    onClick={() => handleSelect(model.id)}
                    className={`
                      relative cursor-pointer select-none py-2 px-4
                      ${isStudio
                        ? `hover:bg-rose-950/40 ${model.id === value ? 'bg-rose-950/60' : ''}`
                        : `hover:bg-gray-100 dark:hover:bg-gray-700 ${model.id === value ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`
                      }
                    `}
                    role="option"
                    aria-selected={model.id === value}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <span
                          className={`block truncate ${
                            model.id === value
                              ? 'font-semibold text-blue-600 dark:text-blue-400'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {model.name}
                        </span>
                        <div className="ml-2 flex items-center gap-1">
                          {model.nsfw && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200">
                              NSFW
                            </span>
                          )}
                          {model.ready === false && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                              not downloaded
                            </span>
                          )}
                          {model.provider && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {model.provider}
                            </span>
                          )}
                        </div>
                      </div>
                      {model.description && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {model.description}
                        </span>
                      )}
                      {model.capabilities && model.capabilities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {model.capabilities.map((cap) => (
                            <span
                              key={cap}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {model.id === value && (
                      <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-blue-600 dark:text-blue-400">
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      {selectedModel?.ready === false && onDownload && (
        <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <p className="text-xs text-amber-100/90">
            {downloadMessage || 'Weights not on disk yet. Download from Hugging Face to run locally.'}
          </p>
          <button
            type="button"
            onClick={onDownload}
            disabled={disabled || isDownloading}
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDownloading ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Downloading…
              </>
            ) : (
              'Download from Hugging Face'
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/** Tier filter chips — pair with useImageModels(tier). */
export const IMAGE_TIER_OPTIONS: { id: ContentTier; label: string }[] = [
  { id: 'nsfw', label: 'Explicit' },
  { id: 'all', label: 'All 15' },
  { id: 'general', label: 'SFW' },
  { id: 'fast', label: 'Draft' },
];

// Fallback until /api/v1/models loads from the MLX catalog
export const DEFAULT_IMAGE_MODELS: ModelOption[] = [
  {
    id: 'flux-dev-nsfw-lora',
    name: 'Flux Dev NSFW — Heartsync',
    description: 'Default explicit model — Flux Dev Q4 + Heartsync NSFW LoRA',
    provider: 'local-mlx',
    capabilities: ['text-to-image', 'nsfw'],
    nsfw: true,
    content_tier: 'nsfw',
  },
  {
    id: 'flux-dev-q4',
    name: 'Flux Dev (Q4)',
    description: 'Standard Flux Dev — general-purpose',
    provider: 'local-mlx',
    capabilities: ['text-to-image'],
    content_tier: 'general',
  },
  {
    id: 'flux-schnell-q4',
    name: 'Flux Schnell Fast (Q4)',
    description: '4-step distilled Flux for quick drafts',
    provider: 'local-mlx',
    capabilities: ['text-to-image'],
    content_tier: 'fast',
  },
];

export const DEFAULT_VIDEO_MODELS: ModelOption[] = [
  {
    id: 'ltx2-distilled',
    name: 'LTX-2 Distilled',
    description: 'Fast local text-to-video on Apple Silicon',
    provider: 'local-mlx',
    capabilities: ['text-to-video'],
    ready: true,
  },
  {
    id: 'wan22-t2v-lightning',
    name: 'Wan 2.2 T2V Lightning',
    description: 'Text-to-video via Flux frame + Wan animation',
    provider: 'local-mlx',
    capabilities: ['text-to-video'],
  },
  {
    id: 'wan22-i2v-lightning',
    name: 'Wan 2.2 I2V Lightning',
    description: 'Image-to-video, 4-step Lightning LoRA',
    provider: 'local-mlx',
    capabilities: ['image-to-video'],
  },
];

export default ModelSelector;
