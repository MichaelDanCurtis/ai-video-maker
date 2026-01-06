'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  provider?: string;
  capabilities?: string[];
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
}: ModelSelectorProps) {
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
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
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
            relative w-full cursor-pointer rounded-lg border py-2 pl-3 pr-10 text-left
            bg-white dark:bg-gray-900
            transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
            ${error
              ? 'border-red-500'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }
            ${disabled || isLoading ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}
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
            <span className="flex items-center">
              <span className="block truncate text-gray-900 dark:text-white">
                {selectedModel.name}
              </span>
              {selectedModel.provider && (
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  ({selectedModel.provider})
                </span>
              )}
            </span>
          ) : (
            <span className="block truncate text-gray-400 dark:text-gray-500">
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
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search models..."
                className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600
                  bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white
                  placeholder-gray-400 dark:placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      hover:bg-gray-100 dark:hover:bg-gray-700
                      ${model.id === value ? 'bg-blue-50 dark:bg-blue-900/30' : ''}
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
                        {model.provider && (
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            {model.provider}
                          </span>
                        )}
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
    </div>
  );
}

// Default models for image generation
export const DEFAULT_IMAGE_MODELS: ModelOption[] = [
  {
    id: 'openai/dall-e-3',
    name: 'DALL-E 3',
    description: 'High-quality image generation from OpenAI',
    provider: 'OpenAI',
    capabilities: ['text-to-image', 'high-quality'],
  },
  {
    id: 'openai/dall-e-2',
    name: 'DALL-E 2',
    description: 'Previous generation DALL-E model',
    provider: 'OpenAI',
    capabilities: ['text-to-image', 'fast'],
  },
  {
    id: 'stabilityai/stable-diffusion-xl',
    name: 'Stable Diffusion XL',
    description: 'Open-source image generation',
    provider: 'Stability AI',
    capabilities: ['text-to-image', 'open-source'],
  },
];

// Default models for video generation (capabilities may vary)
export const DEFAULT_VIDEO_MODELS: ModelOption[] = [
  {
    id: 'stabilityai/stable-video-diffusion',
    name: 'Stable Video Diffusion',
    description: 'Image-to-video generation',
    provider: 'Stability AI',
    capabilities: ['image-to-video'],
  },
];

export default ModelSelector;
