/**
 * API client library for frontend-backend communication.
 * Provides type-safe methods for all API endpoints.
 */

import {
  ApiConfig,
  ApiException,
  HealthResponse,
  ModelListResponse,
  PhotoGenerationRequest,
  PhotoGenerationResponse,
  PhotoEditRequest,
  PhotoEditResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
  VideoEditRequest,
  VideoEditResponse,
  PhotoToVideoRequest,
  PhotoToVideoResponse,
} from './types';

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  timeout: 120000, // 2 minutes for AI operations
};

let currentConfig: ApiConfig = { ...DEFAULT_CONFIG };

/**
 * Configure the API client with custom settings.
 */
export function configureApi(config: Partial<ApiConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Get the current API configuration.
 */
export function getApiConfig(): ApiConfig {
  return { ...currentConfig };
}

// =============================================================================
// HTTP Client Utilities
// =============================================================================

/**
 * Build a full URL from the base URL and path.
 */
function buildUrl(path: string): string {
  const base = currentConfig.baseUrl.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Create an AbortController with timeout.
 */
function createTimeoutController(timeout?: number): { controller: AbortController; timeoutId: number } {
  const controller = new AbortController();
  const timeoutMs = timeout ?? currentConfig.timeout ?? 120000;
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeoutId };
}

/**
 * Handle API response and parse JSON.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `API Error: ${response.status} ${response.statusText}`;
    let details: Record<string, unknown> | undefined;

    try {
      const errorData = await response.json();
      if (errorData.message) {
        message = errorData.message;
      } else if (errorData.detail) {
        message = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
      }
      details = errorData;
    } catch {
      // Response body is not JSON, use default message
    }

    throw new ApiException(response.status, message, details);
  }

  return response.json() as Promise<T>;
}

/**
 * Make a JSON API request.
 */
async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  timeout?: number
): Promise<T> {
  const { controller, timeoutId } = createTimeoutController(timeout);

  try {
    const response = await fetch(buildUrl(path), {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    return handleResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiException) {
      throw error;
    }
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new ApiException(408, 'Request timeout - the operation took too long');
      }
      throw new ApiException(0, error.message);
    }
    throw new ApiException(0, 'An unexpected error occurred');
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Make a multipart form data API request (for file uploads).
 */
async function apiUpload<T>(
  method: string,
  path: string,
  file: File,
  additionalData?: Record<string, string | number | boolean>,
  timeout?: number
): Promise<T> {
  const { controller, timeoutId } = createTimeoutController(timeout);

  const formData = new FormData();
  formData.append('file', file);

  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, String(value));
    });
  }

  try {
    const response = await fetch(buildUrl(path), {
      method,
      headers: {
        Accept: 'application/json',
        // Note: Don't set Content-Type for FormData - browser sets it with boundary
      },
      body: formData,
      signal: controller.signal,
    });

    return handleResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiException) {
      throw error;
    }
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new ApiException(408, 'Upload timeout - the operation took too long');
      }
      throw new ApiException(0, error.message);
    }
    throw new ApiException(0, 'An unexpected error occurred');
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// Health API
// =============================================================================

/**
 * Check API health status.
 */
export async function checkHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('GET', '/api/v1/health');
}

// =============================================================================
// Models API
// =============================================================================

/**
 * Get available image generation models.
 */
export async function getImageModels(): Promise<ModelListResponse> {
  return apiRequest<ModelListResponse>('GET', '/api/v1/models/image');
}

/**
 * Get available video generation models.
 */
export async function getVideoModels(): Promise<ModelListResponse> {
  return apiRequest<ModelListResponse>('GET', '/api/v1/models/video');
}

// =============================================================================
// Photo Generation API
// =============================================================================

/**
 * Generate a photo from a text prompt.
 */
export async function generatePhoto(
  request: PhotoGenerationRequest
): Promise<PhotoGenerationResponse> {
  return apiRequest<PhotoGenerationResponse>('POST', '/api/v1/photo/generate', request);
}

/**
 * Get the status of a photo generation job.
 */
export async function getPhotoJobStatus(jobId: string): Promise<PhotoGenerationResponse> {
  return apiRequest<PhotoGenerationResponse>('GET', `/api/v1/photo/status/${jobId}`);
}

// =============================================================================
// Photo Edit API
// =============================================================================

/**
 * Edit a photo with AI assistance.
 * @param file - The photo file to edit
 * @param request - Edit parameters
 */
export async function editPhoto(
  file: File,
  request: PhotoEditRequest
): Promise<PhotoEditResponse> {
  return apiUpload<PhotoEditResponse>('POST', '/api/v1/transform/photo-edit', file, {
    edit_prompt: request.edit_prompt,
    ...(request.model && { model: request.model }),
    ...(request.strength !== undefined && { strength: request.strength }),
  });
}

/**
 * Get the status of a photo edit job.
 */
export async function getPhotoEditStatus(jobId: string): Promise<PhotoEditResponse> {
  return apiRequest<PhotoEditResponse>('GET', `/api/v1/transform/photo-edit/status/${jobId}`);
}

// =============================================================================
// Video Generation API
// =============================================================================

/**
 * Generate a video from a text prompt.
 */
export async function generateVideo(
  request: VideoGenerationRequest
): Promise<VideoGenerationResponse> {
  return apiRequest<VideoGenerationResponse>('POST', '/api/v1/video/generate', request);
}

/**
 * Get the status of a video generation job.
 */
export async function getVideoJobStatus(jobId: string): Promise<VideoGenerationResponse> {
  return apiRequest<VideoGenerationResponse>('GET', `/api/v1/video/status/${jobId}`);
}

// =============================================================================
// Video Edit API
// =============================================================================

/**
 * Edit a video with AI assistance.
 * @param file - The video file to edit
 * @param request - Edit parameters
 */
export async function editVideo(
  file: File,
  request: VideoEditRequest
): Promise<VideoEditResponse> {
  return apiUpload<VideoEditResponse>('POST', '/api/v1/transform/video-edit', file, {
    edit_prompt: request.edit_prompt,
    ...(request.model && { model: request.model }),
    ...(request.preserve_audio !== undefined && { preserve_audio: request.preserve_audio }),
  });
}

/**
 * Get the status of a video edit job.
 */
export async function getVideoEditStatus(jobId: string): Promise<VideoEditResponse> {
  return apiRequest<VideoEditResponse>('GET', `/api/v1/transform/video-edit/status/${jobId}`);
}

// =============================================================================
// Photo-to-Video API
// =============================================================================

/**
 * Transform a static photo into a video (animation).
 * @param file - The photo file to animate
 * @param request - Animation parameters
 */
export async function transformPhotoToVideo(
  file: File,
  request: PhotoToVideoRequest
): Promise<PhotoToVideoResponse> {
  const additionalData: Record<string, string | number | boolean> = {};

  if (request.motion_prompt) {
    additionalData.motion_prompt = request.motion_prompt;
  }
  if (request.model) {
    additionalData.model = request.model;
  }
  if (request.duration !== undefined) {
    additionalData.duration = request.duration;
  }
  if (request.motion_strength !== undefined) {
    additionalData.motion_strength = request.motion_strength;
  }
  if (request.loop !== undefined) {
    additionalData.loop = request.loop;
  }
  if (request.fps !== undefined) {
    additionalData.fps = request.fps;
  }

  return apiUpload<PhotoToVideoResponse>(
    'POST',
    '/api/v1/transform/photo-to-video',
    file,
    Object.keys(additionalData).length > 0 ? additionalData : undefined
  );
}

/**
 * Get the status of a photo-to-video transformation job.
 */
export async function getPhotoToVideoStatus(jobId: string): Promise<PhotoToVideoResponse> {
  return apiRequest<PhotoToVideoResponse>('GET', `/api/v1/transform/photo-to-video/status/${jobId}`);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Poll a job status until completion or failure.
 * @param pollFn - Function that fetches the job status
 * @param options - Polling options
 * @returns The final job status
 */
export async function pollJobStatus<T extends { status: string; error?: string }>(
  pollFn: () => Promise<T>,
  options: {
    intervalMs?: number;
    maxAttempts?: number;
    onProgress?: (status: T) => void;
  } = {}
): Promise<T> {
  const { intervalMs = 2000, maxAttempts = 150, onProgress } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await pollFn();

    if (onProgress) {
      onProgress(status);
    }

    if (status.status === 'completed') {
      return status;
    }

    if (status.status === 'failed') {
      throw new ApiException(
        500,
        status.error || 'Job failed without error message'
      );
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new ApiException(408, 'Job polling timeout - operation took too long');
}

/**
 * Check if an error is a network/connection error.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof ApiException) {
    return error.status === 0;
  }
  return false;
}

/**
 * Check if an error is an authentication error.
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof ApiException) {
    return error.status === 401;
  }
  return false;
}

/**
 * Check if an error is a rate limit error.
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof ApiException) {
    return error.status === 429;
  }
  return false;
}

/**
 * Get a user-friendly error message from an error.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiException) {
    if (error.status === 0) {
      return 'Unable to connect to the server. Please check your connection and try again.';
    }
    if (error.status === 401) {
      return 'Authentication failed. Please check your API key configuration.';
    }
    if (error.status === 429) {
      return 'Rate limit exceeded. Please wait a moment and try again.';
    }
    if (error.status === 408) {
      return 'The operation timed out. Please try again.';
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

// =============================================================================
// Export API Client Object
// =============================================================================

export const api = {
  // Configuration
  configure: configureApi,
  getConfig: getApiConfig,

  // Health
  health: checkHealth,

  // Models
  getImageModels,
  getVideoModels,

  // Photo
  generatePhoto,
  getPhotoJobStatus,

  // Photo Edit
  editPhoto,
  getPhotoEditStatus,

  // Video
  generateVideo,
  getVideoJobStatus,

  // Video Edit
  editVideo,
  getVideoEditStatus,

  // Photo-to-Video
  transformPhotoToVideo,
  getPhotoToVideoStatus,

  // Utilities
  pollJobStatus,
  isNetworkError,
  isAuthError,
  isRateLimitError,
  getErrorMessage,
};

export default api;
