'use client';

import { useCallback, useEffect, useState } from 'react';
import { getImageModels, getVideoModels } from '@/lib/api';
import type { ModelInfo } from '@/lib/types';
import type { ModelOption } from '@/components/ui/ModelSelector';

function toOptions(models: ModelInfo[]): ModelOption[] {
  return models.map((m) => ({
    id: m.id,
    name: m.ready === false ? `${m.name} (downloading…)` : m.name,
    description: m.description,
    provider: m.provider,
    capabilities: m.capabilities,
    uncensored: m.uncensored,
    ready: m.ready,
  }));
}

export function useImageModels(fallback: ModelOption[]) {
  const [models, setModels] = useState<ModelOption[]>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getImageModels();
      if (response.models.length > 0) {
        setModels(toOptions(response.models));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { models, loading, error, refresh };
}

export function useVideoModels(fallback: ModelOption[]) {
  const [models, setModels] = useState<ModelOption[]>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getVideoModels();
      if (response.models.length > 0) {
        setModels(toOptions(response.models));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { models, loading, error, refresh };
}