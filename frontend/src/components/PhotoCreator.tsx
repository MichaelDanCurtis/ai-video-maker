'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { TextArea } from '@/components/ui/Input';
import { DEFAULT_IMAGE_MODELS } from '@/components/ui/ModelSelector';
import { ImageModelPicker } from '@/components/ui/ImageModelPicker';
import { NsfwModeToggle } from '@/components/ui/NsfwModeToggle';
import { LoadingState } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import {
  GenerationAdvancedControls,
  type ImageAdvancedSettings,
  type VideoAdvancedSettings,
} from '@/components/studio/GenerationAdvancedControls';
import {
  generatePhoto,
  getPhotoJobStatus,
  pollJobStatus,
  getErrorMessage,
  resolveMediaUrl,
  animateStill,
  getPhotoToVideoStatus,
  refineStill,
} from '@/lib/api';
import type { PhotoGenerationResponse, PhotoToVideoResponse } from '@/lib/types';

interface PhotoCreatorProps {
  onGenerate?: (response: PhotoGenerationResponse) => void;
  variant?: 'card' | 'studio';
}

const STUDIO_PLACEHOLDER =
  'Full-body portrait, soft bedroom light, fully nude woman, natural skin texture, shallow depth of field, 85mm lens...';

export function PhotoCreator({ onGenerate, variant = 'card' }: PhotoCreatorProps) {
  const [prompt, setPrompt] = useState('');
  const [nsfwMode, setNsfwMode] = useState(true);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_IMAGE_MODELS[0]?.id || 'flux-dev-nsfw-lora');
  const [imageAdvanced, setImageAdvanced] = useState<ImageAdvancedSettings>({ size: '768x1024' });
  const [videoAdvanced, setVideoAdvanced] = useState<VideoAdvancedSettings>({ motionStrength: 0.5 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<PhotoGenerationResponse | null>(null);
  const [animatedClip, setAnimatedClip] = useState<PhotoToVideoResponse | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Describe who — or what — you want to see');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setAnimatedClip(null);
    setProgressMessage('Warming up Flux on Apple Silicon...');

    try {
      const initial = await generatePhoto({
        prompt: prompt.trim(),
        model: selectedModel,
        nsfw_mode: nsfwMode,
        size: imageAdvanced.size,
        n: imageAdvanced.batchCount,
        seed: imageAdvanced.seed,
        seed_walk: imageAdvanced.seedWalk,
        negative_prompt: imageAdvanced.negativePrompt,
        steps: imageAdvanced.steps,
        guidance: imageAdvanced.guidance,
        lora_scale: imageAdvanced.loraScale,
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
                setProgressMessage('Rendering uncensored frame — LoRA engaged...');
              }
            },
          }
        );
      }

      setGeneratedImage(response);
      onGenerate?.(response);
    } catch (err) {
      setError(getErrorMessage(err));
      setGeneratedImage(null);
    } finally {
      setIsGenerating(false);
      setProgressMessage(null);
    }
  }, [prompt, selectedModel, nsfwMode, imageAdvanced, onGenerate]);

  const handleAnimate = useCallback(async () => {
    if (!generatedImage?.job_id) return;

    setIsAnimating(true);
    setError(null);
    setProgressMessage('Queuing motion from your still...');

    try {
      const initial = await animateStill({
        source_image_job_id: generatedImage.job_id,
        motion_prompt: prompt.trim() || generatedImage.prompt,
        duration: 4,
        fps: 24,
        aspect_ratio: 'auto',
        motion_strength: videoAdvanced.motionStrength ?? 0.5,
        seed: videoAdvanced.seed,
        negative_prompt: videoAdvanced.negativePrompt,
        motion_negative_prompt: videoAdvanced.motionNegativePrompt,
        refine_prompt: videoAdvanced.refinePrompt,
        refine_strength: videoAdvanced.refineStrength ?? 0,
      });

      let response = initial;
      if (initial.status === 'pending' || initial.status === 'processing') {
        response = await pollJobStatus(() => getPhotoToVideoStatus(initial.job_id), {
          intervalMs: 3000,
          maxAttempts: 800,
          onProgress: () => setProgressMessage('Animating your still locally...'),
        });
      }

      setAnimatedClip(response);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsAnimating(false);
      setProgressMessage(null);
    }
  }, [generatedImage, prompt, videoAdvanced]);

  const handleRefine = useCallback(async () => {
    if (!generatedImage?.job_id || !prompt.trim()) return;

    setIsRefining(true);
    setError(null);
    setProgressMessage('Refining still with Flux Redux...');

    try {
      const initial = await refineStill({
        source_image_job_id: generatedImage.job_id,
        refine_prompt: prompt.trim(),
        strength: 0.45,
        model: selectedModel,
        nsfw_mode: nsfwMode,
        negative_prompt: imageAdvanced.negativePrompt,
        seed: imageAdvanced.seed,
      });

      let response = initial;
      if (initial.status === 'pending' || initial.status === 'processing') {
        response = await pollJobStatus(() => getPhotoJobStatus(initial.job_id), {
          intervalMs: 2500,
          maxAttempts: 600,
        });
      }

      setGeneratedImage(response);
      setAnimatedClip(null);
      onGenerate?.(response);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsRefining(false);
      setProgressMessage(null);
    }
  }, [generatedImage, prompt, selectedModel, nsfwMode, imageAdvanced, onGenerate]);

  const handleClear = useCallback(() => {
    setPrompt('');
    setGeneratedImage(null);
    setAnimatedClip(null);
    setError(null);
  }, []);

  const galleryUrls =
    generatedImage?.image_urls?.map((url) => resolveMediaUrl(url)).filter(Boolean) as string[] | undefined;

  const imageSource =
    resolveMediaUrl(generatedImage?.image_url) ||
    (generatedImage?.image_base64 ? `data:image/png;base64,${generatedImage.image_base64}` : null);

  const clipUrl = resolveMediaUrl(animatedClip?.video_url);

  const body = (
    <>
      <TextArea
        label="Fantasy prompt"
        placeholder={variant === 'studio' ? STUDIO_PLACEHOLDER : 'Describe the explicit image you want...'}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={isGenerating || isAnimating || isRefining}
        fullWidth
        rows={4}
        variant={variant === 'studio' ? 'studio' : 'default'}
        helperText="Lighting, pose, body type, expression — be direct; modest wording gets expanded in uncensored mode."
      />

      <NsfwModeToggle
        checked={nsfwMode}
        onChange={setNsfwMode}
        disabled={isGenerating || isAnimating || isRefining}
        variant="card"
      />

      <ImageModelPicker
        value={selectedModel}
        onChange={setSelectedModel}
        disabled={isGenerating || isAnimating || isRefining}
        variant={variant === 'studio' ? 'studio' : 'default'}
        defaultTier={nsfwMode ? 'nsfw' : 'all'}
      />

      <GenerationAdvancedControls
        mode="image"
        imageSettings={imageAdvanced}
        onImageChange={setImageAdvanced}
        disabled={isGenerating || isAnimating || isRefining}
      />

      {generatedImage && (
        <GenerationAdvancedControls
          mode="video"
          videoSettings={videoAdvanced}
          onVideoChange={setVideoAdvanced}
          disabled={isGenerating || isAnimating || isRefining}
        />
      )}

      {error && (
        <ErrorAlert
          message={error}
          title="Render failed"
          onRetry={prompt.trim() ? handleGenerate : undefined}
          onDismiss={() => setError(null)}
          isRetrying={isGenerating}
        />
      )}

      {(isGenerating || isAnimating || isRefining) && (
        <LoadingState message={progressMessage || 'Sculpting pixels locally — first run may take a minute.'} />
      )}

      {galleryUrls && galleryUrls.length > 1 && !isGenerating && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {galleryUrls.map((url, index) => (
            <div key={url} className="overflow-hidden rounded-lg border border-rose-500/25">
              <img src={url} alt={`Variant ${index + 1}`} className="h-auto w-full" />
            </div>
          ))}
        </div>
      )}

      {imageSource && !isGenerating && (!galleryUrls || galleryUrls.length <= 1) && (
        <div className="space-y-3">
          <div
            className={`relative overflow-hidden rounded-xl border velvet-glow-ring ${
              variant === 'studio' ? 'border-rose-500/30' : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <img
              src={imageSource}
              alt={generatedImage?.prompt || 'Generated image'}
              className="h-auto w-full"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>{generatedImage?.model}</span>
            <span>{generatedImage?.job_id}</span>
          </div>
        </div>
      )}

      {clipUrl && animatedClip && !isAnimating && (
        <div className="space-y-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/20 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-fuchsia-300">Animated clip</p>
          <video src={clipUrl} controls className="w-full rounded-lg" />
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-3 pt-1">
        <Button
          variant="outline"
          onClick={handleClear}
          disabled={isGenerating || isAnimating || isRefining || (!prompt && !generatedImage)}
        >
          Clear
        </Button>
        <div className="flex flex-wrap gap-3">
          {generatedImage && imageSource && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = imageSource;
                  link.download = `after-dark-${generatedImage.job_id}.png`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                disabled={isGenerating || isAnimating || isRefining}
              >
                Save still
              </Button>
              <Button
                variant="outline"
                onClick={handleRefine}
                disabled={isGenerating || isAnimating || isRefining || !prompt.trim()}
                isLoading={isRefining}
              >
                Refine still
              </Button>
              <Button
                variant="velvet"
                onClick={handleAnimate}
                disabled={isGenerating || isAnimating || isRefining}
                isLoading={isAnimating}
              >
                Animate this still
              </Button>
            </>
          )}
          <Button
            variant={variant === 'studio' ? 'velvet' : 'primary'}
            onClick={handleGenerate}
            disabled={isGenerating || isAnimating || isRefining || !prompt.trim()}
            isLoading={isGenerating}
          >
            {isGenerating ? 'Rendering...' : 'Render still'}
          </Button>
        </div>
      </div>
    </>
  );

  if (variant === 'studio') {
    return <div className="space-y-4">{body}</div>;
  }

  return (
    <Card variant="bordered" className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>After Dark — Stills</CardTitle>
        <CardDescription>Uncensored Flux LoRAs on your Mac</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{body}</CardContent>
    </Card>
  );
}

export default PhotoCreator;