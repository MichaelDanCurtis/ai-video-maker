'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { TextArea } from '@/components/ui/Input';
import { ModelSelector, DEFAULT_VIDEO_MODELS } from '@/components/ui/ModelSelector';
import { LoadingState } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import {
  generateVideo,
  getVideoJobStatus,
  pollJobStatus,
  getErrorMessage,
  resolveMediaUrl,
} from '@/lib/api';
import { useVideoModels } from '@/hooks/useModels';
import type { VideoGenerationResponse } from '@/lib/types';

interface VideoCreatorProps {
  onGenerate?: (response: VideoGenerationResponse) => void;
}

export function VideoCreator({ onGenerate }: VideoCreatorProps) {
  const { models, loading: modelsLoading } = useVideoModels(DEFAULT_VIDEO_MODELS);
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_VIDEO_MODELS[0]?.id || 'wan22-t2v-lightning');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<VideoGenerationResponse | null>(null);

  useEffect(() => {
    if (models.length > 0 && !models.find((m) => m.id === selectedModel)) {
      setSelectedModel(models[0].id);
    }
  }, [models, selectedModel]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt to generate a video');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgressMessage('Queued — Flux image then Wan video animation...');

    try {
      const initial = await generateVideo({
        prompt: prompt.trim(),
        model: selectedModel,
      });

      let response = initial;
      if (initial.status === 'pending' || initial.status === 'processing') {
        response = await pollJobStatus(
          () => getVideoJobStatus(initial.job_id),
          {
            intervalMs: 3000,
            maxAttempts: 800,
            onProgress: (status) => {
              if (status.progress && status.progress < 50) {
                setProgressMessage('Generating keyframe image (Flux NSFW LoRA)...');
              } else if (status.status === 'processing') {
                setProgressMessage('Animating with Wan 2.2 Lightning...');
              }
            },
          }
        );
      }

      setGeneratedVideo(response);

      if (onGenerate) {
        onGenerate(response);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setGeneratedVideo(null);
    } finally {
      setIsGenerating(false);
      setProgressMessage(null);
    }
  }, [prompt, selectedModel, onGenerate]);

  const handleClear = useCallback(() => {
    setPrompt('');
    setGeneratedVideo(null);
    setError(null);
  }, []);

  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  const handleDownload = useCallback(() => {
    const url = resolveMediaUrl(generatedVideo?.video_url);
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.download = `generated-video-${generatedVideo?.job_id}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generatedVideo]);

  const videoUrl = resolveMediaUrl(generatedVideo?.video_url);
  const posterUrl = resolveMediaUrl(generatedVideo?.thumbnail_url);

  return (
    <Card variant="bordered" className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create Video</CardTitle>
        <CardDescription>
          Text-to-video via local MLX: NSFW Flux keyframe + Wan 2.2 animation
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <TextArea
          label="Prompt"
          placeholder="Describe the video you want to create..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isGenerating}
          fullWidth
          rows={4}
          helperText="Be descriptive! Include details about motion, scene, style, and atmosphere."
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
          <LoadingState message={progressMessage || 'Generating your video... This may take several minutes.'} />
        )}

        {videoUrl && !isGenerating && (
          <div className="space-y-3">
            <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <video src={videoUrl} controls className="w-full h-auto" poster={posterUrl || undefined}>
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Model: {generatedVideo?.model}</span>
              <span>Duration: {generatedVideo?.duration}s</span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <span>ID: {generatedVideo?.job_id}</span>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between gap-3">
        <Button
          variant="outline"
          onClick={handleClear}
          disabled={isGenerating || (!prompt && !generatedVideo)}
        >
          Clear
        </Button>
        <div className="flex gap-3">
          {videoUrl && (
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
            {isGenerating ? 'Generating...' : 'Generate Video'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default VideoCreator;