'use client';

import { useCallback, useEffect, useState } from 'react';
import { getImageModels, getVideoModels } from '@/lib/api';
import type { ContentTier, ModelInfo, VideoCapability } from '@/lib/types';
import type { ModelOption } from '@/components/ui/ModelSelector';

function toOptions(models: ModelInfo[]): ModelOption[] {
  return models.map((m) => ({
    id: m.id,
    name: m.ready === false ? `${m.name} (not downloaded)` : m.name,
    description: m.description,
    provider: m.provider,
    capabilities: m.capabilities,
    nsfw: m.nsfw,
    uncensored: m.uncensored,
    content_tier: m.content_tier ?? undefined,
    ready: m.ready,
  }));
}

export function useImageModels(fallback: ModelOption[], tier: ContentTier = 'all') {
  const [models, setModels] = useState<ModelOption[]>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getImageModels(tier);
      if (response.models.length > 0) {
        setModels(toOptions(response.models));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }, [tier]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { models, loading, error, refresh };
}

export function useVideoModels(fallback: ModelOption[], capability: VideoCapability = 'all') {
  const [models, setModels] = useState<ModelOption[]>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getVideoModels(capability);
      if (response.models.length > 0) {
        setModels(toOptions(response.models));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }, [capability]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { models, loading, error, refresh };
}