'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Input, TextArea } from '@/components/ui/Input';
import { FileUpload } from '@/components/ui/FileUpload';
import { ModelSelector, DEFAULT_VIDEO_MODELS } from '@/components/ui/ModelSelector';
import { LoadingState } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { transformPhotoToVideo, getErrorMessage } from '@/lib/api';
import type { PhotoToVideoResponse } from '@/lib/types';

interface PhotoToVideoProps {
  onTransform?: (response: PhotoToVideoResponse) => void;
}

export function PhotoToVideo({ onTransform }: PhotoToVideoProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [motionPrompt, setMotionPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_VIDEO_MODELS[0]?.id || 'stabilityai/stable-video-diffusion');
  const [duration, setDuration] = useState<number>(4);
  const [motionStrength, setMotionStrength] = useState<number>(0.5);
  const [loop, setLoop] = useState<boolean>(false);
  const [isTransforming, setIsTransforming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<PhotoToVideoResponse | null>(null);

  const handleFileSelect = useCallback((files: File[]) => {
    if (files.length > 0) {
      setSelectedFile(files[0]);
      setError(null);
    } else {
      setSelectedFile(null);
    }
  }, []);

  const handleFileError = useCallback((errorMessage: string) => {
    setError(errorMessage);
  }, []);

  const handleTransform = useCallback(async () => {
    if (!selectedFile) {
      setError('Please upload an image to animate');
      return;
    }

    setIsTransforming(true);
    setError(null);

    try {
      const response = await transformPhotoToVideo(selectedFile, {
        motion_prompt: motionPrompt.trim() || undefined,
        model: selectedModel,
        duration,
        motion_strength: motionStrength,
        loop,
      });

      setGeneratedVideo(response);

      if (onTransform) {
        onTransform(response);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setGeneratedVideo(null);
    } finally {
      setIsTransforming(false);
    }
  }, [selectedFile, motionPrompt, selectedModel, duration, motionStrength, loop, onTransform]);

  const handleClear = useCallback(() => {
    setSelectedFile(null);
    setMotionPrompt('');
    setDuration(4);
    setMotionStrength(0.5);
    setLoop(false);
    setGeneratedVideo(null);
    setError(null);
  }, []);

  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  const handleDownload = useCallback(() => {
    if (!generatedVideo?.video_url) return;

    const link = document.createElement('a');
    link.href = generatedVideo.video_url;
    link.download = `animated-video-${generatedVideo.job_id}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generatedVideo]);

  return (
    <Card variant="bordered" className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Photo to Video</CardTitle>
        <CardDescription>
          Transform a static photo into an animated video using AI
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <FileUpload
          label="Upload Photo"
          accept="image/*"
          maxSize={10 * 1024 * 1024} // 10MB
          onFileSelect={handleFileSelect}
          onError={handleFileError}
          disabled={isTransforming}
          fullWidth
          helperText="Supported formats: PNG, JPG, WEBP (max 10MB)"
        />

        <TextArea
          label="Motion Prompt (Optional)"
          placeholder="Describe the motion or animation you want..."
          value={motionPrompt}
          onChange={(e) => setMotionPrompt(e.target.value)}
          disabled={isTransforming}
          fullWidth
          rows={3}
          helperText="Describe the motion, e.g., 'gentle camera pan', 'waves moving', 'clouds floating'"
        />

        <ModelSelector
          label="Model"
          models={DEFAULT_VIDEO_MODELS}
          value={selectedModel}
          onChange={setSelectedModel}
          disabled={isTransforming}
          fullWidth
          placeholder="Select an AI model..."
        />

        {/* Animation Settings */}
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Animation Settings
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Duration (seconds)"
                type="number"
                min={1}
                max={30}
                value={duration}
                onChange={(e) => setDuration(Math.max(1, Math.min(30, parseInt(e.target.value) || 4)))}
                disabled={isTransforming}
                fullWidth
                helperText="1-30 seconds"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Motion Strength: {(motionStrength * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={motionStrength}
                onChange={(e) => setMotionStrength(parseFloat(e.target.value))}
                disabled={isTransforming}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Lower = subtle, Higher = dramatic
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="loop-toggle"
              checked={loop}
              onChange={(e) => setLoop(e.target.checked)}
              disabled={isTransforming}
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500"
            />
            <label htmlFor="loop-toggle" className="text-sm text-gray-700 dark:text-gray-200">
              Create looping video
            </label>
          </div>
        </div>

        {error && (
          <ErrorAlert
            message={error}
            title="Transformation Failed"
            onRetry={selectedFile ? handleTransform : undefined}
            onDismiss={handleDismissError}
            isRetrying={isTransforming}
          />
        )}

        {isTransforming && (
          <LoadingState message="Transforming your photo into a video... This may take a few minutes." />
        )}

        {generatedVideo?.video_url && !isTransforming && (
          <div className="space-y-3">
            <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <video
                src={generatedVideo.video_url}
                controls
                loop={loop}
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
          disabled={isTransforming || (!selectedFile && !motionPrompt && !generatedVideo)}
        >
          Clear
        </Button>
        <div className="flex gap-3">
          {generatedVideo?.video_url && (
            <Button
              variant="secondary"
              onClick={handleDownload}
              disabled={isTransforming}
            >
              Download
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleTransform}
            disabled={isTransforming || !selectedFile}
            isLoading={isTransforming}
          >
            {isTransforming ? 'Transforming...' : 'Animate Photo'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default PhotoToVideo;
