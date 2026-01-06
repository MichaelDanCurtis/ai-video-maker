'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { TextArea } from '@/components/ui/Input';
import { FileUpload } from '@/components/ui/FileUpload';
import { ModelSelector, DEFAULT_IMAGE_MODELS } from '@/components/ui/ModelSelector';
import { LoadingState } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { editPhoto, getErrorMessage } from '@/lib/api';
import type { PhotoEditResponse } from '@/lib/types';

interface PhotoEditorProps {
  onEdit?: (response: PhotoEditResponse) => void;
}

export function PhotoEditor({ onEdit }: PhotoEditorProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_IMAGE_MODELS[0]?.id || 'openai/dall-e-3');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<PhotoEditResponse | null>(null);

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
      setError('Please upload an image to edit');
      return;
    }

    if (!editPrompt.trim()) {
      setError('Please enter an edit prompt describing the changes you want');
      return;
    }

    setIsEditing(true);
    setError(null);

    try {
      const response = await editPhoto(selectedFile, {
        edit_prompt: editPrompt.trim(),
        model: selectedModel,
      });

      setEditedImage(response);

      if (onEdit) {
        onEdit(response);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setEditedImage(null);
    } finally {
      setIsEditing(false);
    }
  }, [selectedFile, editPrompt, selectedModel, onEdit]);

  const handleClear = useCallback(() => {
    setSelectedFile(null);
    setEditPrompt('');
    setEditedImage(null);
    setError(null);
  }, []);

  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  const handleDownload = useCallback(() => {
    if (!editedImage) return;

    const imageUrl = editedImage.edited_image_url ||
      (editedImage.edited_image_base64 ? `data:image/png;base64,${editedImage.edited_image_base64}` : null);

    if (!imageUrl) return;

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `edited-image-${editedImage.job_id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [editedImage]);

  const imageSource = editedImage?.edited_image_url ||
    (editedImage?.edited_image_base64 ? `data:image/png;base64,${editedImage.edited_image_base64}` : null);

  // Determine if retry should be available
  const canRetry = selectedFile && editPrompt.trim();

  return (
    <Card variant="bordered" className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Edit Photo</CardTitle>
        <CardDescription>
          Upload a photo and describe how you want to edit it using AI
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <FileUpload
          label="Upload Photo"
          accept="image/*"
          maxSize={10 * 1024 * 1024} // 10MB
          onFileSelect={handleFileSelect}
          onError={handleFileError}
          disabled={isEditing}
          fullWidth
          helperText="Supported formats: PNG, JPG, WEBP (max 10MB)"
        />

        <TextArea
          label="Edit Prompt"
          placeholder="Describe how you want to edit the image..."
          value={editPrompt}
          onChange={(e) => setEditPrompt(e.target.value)}
          disabled={isEditing}
          fullWidth
          rows={4}
          helperText="Describe the changes you want to make, e.g., 'Remove the background', 'Add a sunset sky', 'Make it look like a painting'"
        />

        <ModelSelector
          label="Model"
          models={DEFAULT_IMAGE_MODELS}
          value={selectedModel}
          onChange={setSelectedModel}
          disabled={isEditing}
          fullWidth
          placeholder="Select an AI model..."
        />

        {error && (
          <ErrorAlert
            message={error}
            title="Edit Failed"
            onRetry={canRetry ? handleEdit : undefined}
            onDismiss={handleDismissError}
            isRetrying={isEditing}
          />
        )}

        {isEditing && (
          <LoadingState message="Editing your photo... This may take a moment." />
        )}

        {imageSource && !isEditing && (
          <div className="space-y-3">
            <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <img
                src={imageSource}
                alt={editedImage?.edit_prompt || 'Edited image'}
                className="w-full h-auto"
              />
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Model: {editedImage?.model}</span>
              <span>ID: {editedImage?.job_id}</span>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between gap-3">
        <Button
          variant="outline"
          onClick={handleClear}
          disabled={isEditing || (!selectedFile && !editPrompt && !editedImage)}
        >
          Clear
        </Button>
        <div className="flex gap-3">
          {editedImage && imageSource && (
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
            {isEditing ? 'Editing...' : 'Edit Photo'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default PhotoEditor;
