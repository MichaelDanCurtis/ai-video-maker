'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { TextArea } from '@/components/ui/Input';
import { ModelSelector, DEFAULT_VIDEO_MODELS } from '@/components/ui/ModelSelector';
import { LoadingState } from '@/components/ui/LoadingSpinner';
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
          <LoadingState message="Generating your video... This may take a few minutes." />
        )}

        {generatedVideo?.unavailable_message && !isGenerating && (
          <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4">
            <div className="flex items-start">
              <svg
                className="h-5 w-5 text-yellow-500 dark:text-yellow-400 mt-0.5 mr-3 flex-shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Feature Unavailable
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  {generatedVideo.unavailable_message}
                </p>
              </div>
            </div>
          </div>
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
