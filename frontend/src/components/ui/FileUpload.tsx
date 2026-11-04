'use client';

import { forwardRef, useCallback, useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Button } from './Button';

export type FileUploadSize = 'sm' | 'md' | 'lg';

interface FileUploadProps {
  /** Label displayed above the upload area */
  label?: string;
  /** Helper text displayed below the upload area */
  helperText?: string;
  /** Error message to display */
  error?: string;
  /** Accepted file types (e.g., 'image/*', '.png,.jpg') */
  accept?: string;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Whether multiple files can be selected */
  multiple?: boolean;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Size variant of the upload area */
  size?: FileUploadSize;
  /** Whether to take full width */
  fullWidth?: boolean;
  /** Callback when file(s) are selected */
  onFileSelect?: (files: File[]) => void;
  /** Callback when there's a validation error */
  onError?: (error: string) => void;
  /** Custom class name */
  className?: string;
  /** ID for the input element */
  id?: string;
  /** Preview mode for selected file */
  showPreview?: boolean;
}

const sizeStyles: Record<FileUploadSize, string> = {
  sm: 'py-6 px-4',
  md: 'py-8 px-6',
  lg: 'py-12 px-8',
};

const iconSizes: Record<FileUploadSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
};

const textSizes: Record<FileUploadSize, { title: string; description: string }> = {
  sm: { title: 'text-sm', description: 'text-xs' },
  md: { title: 'text-base', description: 'text-sm' },
  lg: { title: 'text-lg', description: 'text-base' },
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getAcceptedFileTypesDisplay(accept?: string): string {
  if (!accept) return 'All files';

  const types = accept.split(',').map(t => t.trim());
  const readable = types.map(type => {
    if (type === 'image/*') return 'Images';
    if (type === 'video/*') return 'Videos';
    if (type === 'audio/*') return 'Audio';
    if (type.startsWith('.')) return type.toUpperCase().slice(1);
    return type;
  });

  return readable.join(', ');
}

export const FileUpload = forwardRef<HTMLInputElement, FileUploadProps>(
  (
    {
      label,
      helperText,
      error,
      accept,
      maxSize,
      multiple = false,
      disabled = false,
      size = 'md',
      fullWidth = false,
      onFileSelect,
      onError,
      className = '',
      id,
      showPreview = true,
    },
    ref
  ) => {
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-') || 'file-upload';

    const validateFiles = useCallback((files: File[]): { valid: File[]; errors: string[] } => {
      const valid: File[] = [];
      const errors: string[] = [];

      for (const file of files) {
        // Check file size
        if (maxSize && file.size > maxSize) {
          errors.push(`${file.name} exceeds maximum size of ${formatFileSize(maxSize)}`);
          continue;
        }

        // Check file type
        if (accept) {
          const acceptedTypes = accept.split(',').map(t => t.trim());
          const fileType = file.type;
          const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

          const isAccepted = acceptedTypes.some(type => {
            if (type.endsWith('/*')) {
              return fileType.startsWith(type.slice(0, -1));
            }
            if (type.startsWith('.')) {
              return fileExt === type.toLowerCase();
            }
            return fileType === type;
          });

          if (!isAccepted) {
            errors.push(`${file.name} is not an accepted file type`);
            continue;
          }
        }

        valid.push(file);
      }

      return { valid, errors };
    }, [accept, maxSize]);

    const handleFiles = useCallback((files: FileList | null) => {
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);
      const filesToProcess = multiple ? fileArray : [fileArray[0]];

      const { valid, errors } = validateFiles(filesToProcess);

      if (errors.length > 0) {
        onError?.(errors.join('. '));
      }

      if (valid.length > 0) {
        setSelectedFiles(valid);

        // Generate preview URLs for images
        const newPreviewUrls: string[] = [];
        valid.forEach(file => {
          if (file.type.startsWith('image/')) {
            newPreviewUrls.push(URL.createObjectURL(file));
          }
        });

        // Cleanup old preview URLs
        previewUrls.forEach(url => URL.revokeObjectURL(url));
        setPreviewUrls(newPreviewUrls);

        onFileSelect?.(valid);
      }
    }, [multiple, validateFiles, onFileSelect, onError, previewUrls]);

    const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragging(true);
      }
    }, [disabled]);

    const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    }, []);

    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (!disabled) {
        handleFiles(e.dataTransfer.files);
      }
    }, [disabled, handleFiles]);

    const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
    }, [handleFiles]);

    const handleClick = useCallback(() => {
      if (!disabled) {
        inputRef.current?.click();
      }
    }, [disabled]);

    const handleRemoveFile = useCallback((index: number) => {
      const newFiles = [...selectedFiles];
      newFiles.splice(index, 1);
      setSelectedFiles(newFiles);

      if (previewUrls[index]) {
        URL.revokeObjectURL(previewUrls[index]);
        const newPreviews = [...previewUrls];
        newPreviews.splice(index, 1);
        setPreviewUrls(newPreviews);
      }

      onFileSelect?.(newFiles);

      // Reset input value so the same file can be selected again
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }, [selectedFiles, previewUrls, onFileSelect]);

    const clearAll = useCallback(() => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      setSelectedFiles([]);
      setPreviewUrls([]);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      onFileSelect?.([]);
    }, [previewUrls, onFileSelect]);

    const baseDropZoneStyles = `
      flex flex-col items-center justify-center
      border-2 border-dashed rounded-lg
      transition-colors cursor-pointer
    `;

    const normalBorderStyles = `
      border-gray-300 dark:border-gray-600
      hover:border-blue-400 dark:hover:border-blue-500
      bg-gray-50 dark:bg-gray-800/50
    `;

    const draggingStyles = `
      border-blue-500 dark:border-blue-400
      bg-blue-50 dark:bg-blue-900/20
    `;

    const errorStyles = `
      border-red-500 dark:border-red-500
      bg-red-50 dark:bg-red-900/10
    `;

    const disabledStyles = `
      opacity-50 cursor-not-allowed
      bg-gray-100 dark:bg-gray-800
    `;

    return (
      <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2"
          >
            {label}
          </label>
        )}

        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleClick}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick();
            }
          }}
          aria-label={`Upload ${multiple ? 'files' : 'file'}`}
          aria-disabled={disabled}
          aria-invalid={error ? 'true' : 'false'}
          className={`
            ${baseDropZoneStyles}
            ${sizeStyles[size]}
            ${error ? errorStyles : isDragging ? draggingStyles : normalBorderStyles}
            ${disabled ? disabledStyles : ''}
          `.trim()}
        >
          <input
            ref={(node) => {
              // Handle both refs
              (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
              if (typeof ref === 'function') {
                ref(node);
              } else if (ref) {
                ref.current = node;
              }
            }}
            type="file"
            id={inputId}
            accept={accept}
            multiple={multiple}
            disabled={disabled}
            onChange={handleInputChange}
            className="sr-only"
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          />

          {/* Upload Icon */}
          <svg
            className={`${iconSizes[size]} text-gray-400 dark:text-gray-500 mb-3`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          {/* Upload Text */}
          <p className={`${textSizes[size].title} font-medium text-gray-700 dark:text-gray-200 mb-1`}>
            {isDragging ? 'Drop files here' : 'Click to upload or drag and drop'}
          </p>
          <p className={`${textSizes[size].description} text-gray-500 dark:text-gray-400`}>
            {getAcceptedFileTypesDisplay(accept)}
            {maxSize && ` (max ${formatFileSize(maxSize)})`}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <p id={`${inputId}-error`} className="mt-2 text-sm text-red-500">
            {error}
          </p>
        )}

        {/* Helper Text */}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        )}

        {/* Selected Files Preview */}
        {showPreview && selectedFiles.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Selected {selectedFiles.length === 1 ? 'file' : 'files'}
              </span>
              {selectedFiles.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAll();
                  }}
                >
                  Clear all
                </Button>
              )}
            </div>

            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                {/* Preview Thumbnail */}
                {previewUrls[index] ? (
                  <div className="h-12 w-12 flex-shrink-0 rounded overflow-hidden bg-gray-200 dark:bg-gray-700">
                    <img
                      src={previewUrls[index]}
                      alt={`Preview of ${file.name}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-12 w-12 flex-shrink-0 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <svg
                      className="h-6 w-6 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                )}

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(file.size)}
                  </p>
                </div>

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(index);
                  }}
                  className="flex-shrink-0 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  aria-label={`Remove ${file.name}`}
                >
                  <svg
                    className="h-5 w-5 text-gray-500 dark:text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

FileUpload.displayName = 'FileUpload';

export default FileUpload;
