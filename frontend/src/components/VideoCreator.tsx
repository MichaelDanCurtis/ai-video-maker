'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { TextArea } from '@/components/ui/Input';
import { ModelSelector, DEFAULT_VIDEO_MODELS } from '@/components/ui/ModelSelector';
import { LoadingState } from '@/components/ui/LoadingSpinner';
import { ErrorAlert, WarningAlert } from '@/components/ui/ErrorAlert';
import { generateVideo, getErrorMessage } from '@/lib/api';
import type { VideoGenerationResponse } from '@/lib/types';

interface VideoCreatorProps {
  onGenerate?: (response: VideoGenerationResponse) => void;
}

export function VideoCreator({ onGenerate }: VideoCreatorProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_VIDEO_MODELS[0]?.id || 'stabilityai/stable-video-diffusion');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<VideoGenerationResponse | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt to generate a video');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await generateVideo({
        prompt: prompt.trim(),
        model: selectedModel,
      });

      setGeneratedVideo(response);

      if (onGenerate) {
        onGenerate(response);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setGeneratedVideo(null);
    } finally {
      setIsGenerating(false);
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

  const handleDismissWarning = useCallback(() => {
    if (generatedVideo) {
      setGeneratedVideo({ ...generatedVideo, unavailable_message: undefined });
    }
  }, [generatedVideo]);

  const handleDownload = useCallback(() => {
    if (!generatedVideo?.video_url) return;

    const link = document.createElement('a');
    link.href = generatedVideo.video_url;
    link.download = `generated-video-${generatedVideo.job_id}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generatedVideo]);

  return (
    <Card variant="bordered" className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create Video</CardTitle>
        <CardDescription>
          Generate stunning videos from text descriptions using AI
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
          models={DEFAULT_VIDEO_MODELS}
          value={selectedModel}
          onChange={setSelectedModel}
          disabled={isGenerating}
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
          <LoadingState message="Generating your video... This may take a few minutes." />
        )}

        {generatedVideo?.unavailable_message && !isGenerating && (
          <WarningAlert
            title="Feature Unavailable"
            message={generatedVideo.unavailable_message}
            showDismiss
            onDismiss={handleDismissWarning}
          />
        )}

        {generatedVideo?.video_url && !isGenerating && (
          <div className="space-y-3">
            <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <video
                src={generatedVideo.video_url}
                controls
                className="w-full h-auto"
                poster={generatedVideo.thumbnail_url}
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Model: {generatedVideo.model}</span>
              <span>Duration: {generatedVideo.duration}s</span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <span>ID: {generatedVideo.job_id}</span>
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
          {generatedVideo?.video_url && (
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
            {isGenerating ? 'Generating...' : 'Generate Video'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default VideoCreator;
