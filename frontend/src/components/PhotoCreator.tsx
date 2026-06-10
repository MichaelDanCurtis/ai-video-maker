'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { TextArea } from '@/components/ui/Input';
import { ModelSelector, DEFAULT_IMAGE_MODELS } from '@/components/ui/ModelSelector';
import { LoadingState } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { generatePhoto, getPhotoJobStatus, pollJobStatus, getErrorMessage, resolveMediaUrl } from '@/lib/api';
import { useImageModels } from '@/hooks/useModels';
import type { PhotoGenerationResponse } from '@/lib/types';

interface PhotoCreatorProps {
  onGenerate?: (response: PhotoGenerationResponse) => void;
}

export function PhotoCreator({ onGenerate }: PhotoCreatorProps) {
  const { models, loading: modelsLoading } = useImageModels(DEFAULT_IMAGE_MODELS);
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_IMAGE_MODELS[0]?.id || 'flux-dev-uncensored-q4');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<PhotoGenerationResponse | null>(null);

  useEffect(() => {
    if (models.length > 0 && !models.find((m) => m.id === selectedModel)) {
      setSelectedModel(models[0].id);
    }
  }, [models, selectedModel]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt to generate an image');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgressMessage('Queued for local MLX generation...');

    try {
      const initial = await generatePhoto({
        prompt: prompt.trim(),
        model: selectedModel,
      });

      let response = initial;
      if (initial.status === 'pending' || initial.status === 'processing') {
        response = await pollJobStatus(
          () => getPhotoJobStatus(initial.job_id),
          {
            intervalMs: 2500,
            maxAttempts: 600,
            onProgress: (status) => {
              if (status.status === 'processing') {
                setProgressMessage('Generating on Apple Silicon (Flux uncensored)...');
              }
            },
          }
        );
      }

      setGeneratedImage(response);

      if (onGenerate) {
        onGenerate(response);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setGeneratedImage(null);
    } finally {
      setIsGenerating(false);
      setProgressMessage(null);
    }
  }, [prompt, selectedModel, onGenerate]);

  const handleClear = useCallback(() => {
    setPrompt('');
    setGeneratedImage(null);
    setError(null);
  }, []);

  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  const handleDownload = useCallback(() => {
    if (!generatedImage) return;

    const imageUrl =
      resolveMediaUrl(generatedImage.image_url) ||
      (generatedImage.image_base64 ? `data:image/png;base64,${generatedImage.image_base64}` : null);

    if (!imageUrl) return;

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `generated-image-${generatedImage.job_id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generatedImage]);

  const imageSource =
    resolveMediaUrl(generatedImage?.image_url) ||
    (generatedImage?.image_base64 ? `data:image/png;base64,${generatedImage.image_base64}` : null);

  return (
    <Card variant="bordered" className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create Image</CardTitle>
        <CardDescription>
          Generate images locally with uncensored Flux on your Mac (MLX)
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <TextArea
          label="Prompt"
          placeholder="Describe the image you want to create..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isGenerating}
          fullWidth
          rows={4}
          helperText="Be descriptive! Include details about style, colors, composition, and mood."
        />

        <ModelSelector
          label="Model"
          models={models}
          value={selectedModel}
          onChange={setSelectedModel}
          disabled={isGenerating}
          isLoading={modelsLoading}
          fullWidth
          placeholder="Select an AI model..."
        />

        {error && (
          <ErrorAlert
            message={error}
            title="Generation Failed"
            onRetry={prompt.trim() ? handleGenerate : undefined}
            onDismiss={handleDismissError}
            isRetrying={isGenerating}
          />
        )}

        {isGenerating && (
          <LoadingState message={progressMessage || 'Generating your image... This may take a few minutes on first run.'} />
        )}

        {imageSource && !isGenerating && (
          <div className="space-y-3">
            <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <img
                src={imageSource}
                alt={generatedImage?.prompt || 'Generated image'}
                className="w-full h-auto"
              />
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Model: {generatedImage?.model}</span>
              <span>ID: {generatedImage?.job_id}</span>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between gap-3">
        <Button
          variant="outline"
          onClick={handleClear}
          disabled={isGenerating || (!prompt && !generatedImage)}
        >
          Clear
        </Button>
        <div className="flex gap-3">
          {generatedImage && imageSource && (
            <Button variant="secondary" onClick={handleDownload} disabled={isGenerating}>
              Download
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            isLoading={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate Image'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default PhotoCreator;