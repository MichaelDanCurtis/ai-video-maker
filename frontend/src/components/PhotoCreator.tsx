'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { TextArea } from '@/components/ui/Input';
import { ModelSelector, DEFAULT_IMAGE_MODELS } from '@/components/ui/ModelSelector';
import { LoadingState } from '@/components/ui/LoadingSpinner';
import { generatePhoto, getErrorMessage } from '@/lib/api';
import type { PhotoGenerationResponse } from '@/lib/types';

interface PhotoCreatorProps {
  onGenerate?: (response: PhotoGenerationResponse) => void;
}

export function PhotoCreator({ onGenerate }: PhotoCreatorProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_IMAGE_MODELS[0]?.id || 'openai/dall-e-3');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<PhotoGenerationResponse | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt to generate an image');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await generatePhoto({
        prompt: prompt.trim(),
        model: selectedModel,
      });

      setGeneratedImage(response);

      if (onGenerate) {
        onGenerate(response);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setGeneratedImage(null);
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, selectedModel, onGenerate]);

  const handleClear = useCallback(() => {
    setPrompt('');
    setGeneratedImage(null);
    setError(null);
  }, []);

  const handleDownload = useCallback(() => {
    if (!generatedImage) return;

    const imageUrl = generatedImage.image_url ||
      (generatedImage.image_base64 ? `data:image/png;base64,${generatedImage.image_base64}` : null);

    if (!imageUrl) return;

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `generated-image-${generatedImage.job_id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generatedImage]);

  const imageSource = generatedImage?.image_url ||
    (generatedImage?.image_base64 ? `data:image/png;base64,${generatedImage.image_base64}` : null);

  return (
    <Card variant="bordered" className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create Image</CardTitle>
        <CardDescription>
          Generate stunning images from text descriptions using AI
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
          models={DEFAULT_IMAGE_MODELS}
          value={selectedModel}
          onChange={setSelectedModel}
          disabled={isGenerating}
          fullWidth
          placeholder="Select an AI model..."
        />

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <div className="flex items-start">
              <svg
                className="h-5 w-5 text-red-500 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Generation Failed
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {isGenerating && (
          <LoadingState message="Generating your image... This may take a moment." />
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
            <Button
              variant="secondary"
              onClick={handleDownload}
              disabled={isGenerating}
            >
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
