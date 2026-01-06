'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { TextArea } from '@/components/ui/Input';
import { FileUpload } from '@/components/ui/FileUpload';
import { ModelSelector, DEFAULT_VIDEO_MODELS } from '@/components/ui/ModelSelector';
import { LoadingState } from '@/components/ui/LoadingSpinner';
import { editVideo, getErrorMessage } from '@/lib/api';
import type { VideoEditResponse } from '@/lib/types';

interface VideoEditorProps {
  onEdit?: (response: VideoEditResponse) => void;
}

export function VideoEditor({ onEdit }: VideoEditorProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_VIDEO_MODELS[0]?.id || 'stabilityai/stable-video-diffusion');
  const [preserveAudio, setPreserveAudio] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedVideo, setEditedVideo] = useState<VideoEditResponse | null>(null);

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

  const handleEdit = useCallback(async () => {
    if (!selectedFile) {
      setError('Please upload a video to edit');
      return;
    }

    if (!editPrompt.trim()) {
      setError('Please enter an edit prompt');
      return;
    }

    setIsEditing(true);
    setError(null);

    try {
      const response = await editVideo(selectedFile, {
        edit_prompt: editPrompt.trim(),
        model: selectedModel,
        preserve_audio: preserveAudio,
      });

      setEditedVideo(response);

      if (onEdit) {
        onEdit(response);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setEditedVideo(null);
    } finally {
      setIsEditing(false);
    }
  }, [selectedFile, editPrompt, selectedModel, preserveAudio, onEdit]);

  const handleClear = useCallback(() => {
    setSelectedFile(null);
    setEditPrompt('');
    setEditedVideo(null);
    setError(null);
    setPreserveAudio(true);
  }, []);

  const handleDownload = useCallback(() => {
    if (!editedVideo?.edited_video_url) return;

    const link = document.createElement('a');
    link.href = editedVideo.edited_video_url;
    link.download = `edited-video-${editedVideo.job_id}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [editedVideo]);

  return (
    <Card variant="bordered" className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Edit Video</CardTitle>
        <CardDescription>
          Upload a video and describe how you want to edit it using AI
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <FileUpload
          label="Upload Video"
          accept="video/*"
          maxSize={100 * 1024 * 1024} // 100MB
          onFileSelect={handleFileSelect}
          onError={handleFileError}
          disabled={isEditing}
          fullWidth
          helperText="Supported formats: MP4, MOV, AVI, WebM (max 100MB)"
        />

        <TextArea
          label="Edit Prompt"
          placeholder="Describe how you want to edit the video..."
          value={editPrompt}
          onChange={(e) => setEditPrompt(e.target.value)}
          disabled={isEditing}
          fullWidth
          rows={4}
          helperText="Describe the changes you want to make, e.g., 'Add slow motion effect', 'Apply vintage filter', 'Enhance colors'"
        />

        <ModelSelector
          label="Model"
          models={DEFAULT_VIDEO_MODELS}
          value={selectedModel}
          onChange={setSelectedModel}
          disabled={isEditing}
          fullWidth
          placeholder="Select an AI model..."
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="preserve-audio"
            checked={preserveAudio}
            onChange={(e) => setPreserveAudio(e.target.checked)}
            disabled={isEditing}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label
            htmlFor="preserve-audio"
            className="text-sm text-gray-700 dark:text-gray-300"
          >
            Preserve original audio
          </label>
        </div>

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
                  Edit Failed
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {isEditing && (
          <LoadingState message="Editing your video... This may take several minutes." />
        )}

        {editedVideo?.edited_video_url && !isEditing && (
          <div className="space-y-3">
            <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <video
                src={editedVideo.edited_video_url}
                controls
                className="w-full h-auto"
                poster={editedVideo.thumbnail_url}
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Model: {editedVideo.model}</span>
              <span>ID: {editedVideo.job_id}</span>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between gap-3">
        <Button
          variant="outline"
          onClick={handleClear}
          disabled={isEditing || (!selectedFile && !editPrompt && !editedVideo)}
        >
          Clear
        </Button>
        <div className="flex gap-3">
          {editedVideo?.edited_video_url && (
            <Button
              variant="secondary"
              onClick={handleDownload}
              disabled={isEditing}
            >
              Download
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleEdit}
            disabled={isEditing || !selectedFile || !editPrompt.trim()}
            isLoading={isEditing}
          >
            {isEditing ? 'Editing...' : 'Edit Video'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default VideoEditor;
