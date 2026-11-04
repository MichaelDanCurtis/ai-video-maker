/**
 * TypeScript type definitions for API request and response types.
 * These types mirror the backend Pydantic schemas for type-safe communication.
 */

// =============================================================================
// Enums
// =============================================================================

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type MediaType = 'image' | 'video';

// =============================================================================
// Common Response Types
// =============================================================================

export interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description?: string;
  capabilities: string[];
}

export interface ModelListResponse {
  models: ModelInfo[];
  media_type: MediaType;
}

// =============================================================================
// Photo Generation Types
// =============================================================================

export interface PhotoGenerationRequest {
  prompt: string;
  model?: string;
  size?: string;
  quality?: 'standard' | 'hd';
  style?: string;
  n?: number;
}

export interface PhotoGenerationResponse {
  job_id: string;
  status: JobStatus;
  image_url?: string;
  image_base64?: string;
  model: string;
  prompt: string;
  created_at: string;
  error?: string;
}

// =============================================================================
// Photo Edit Types
// =============================================================================

export interface PhotoEditRequest {
  edit_prompt: string;
  model?: string;
  strength?: number;
}

export interface PhotoEditResponse {
  job_id: string;
  status: JobStatus;
  original_filename?: string;
  edited_image_url?: string;
  edited_image_base64?: string;
  model: string;
  edit_prompt: string;
  created_at: string;
  error?: string;
}

// =============================================================================
// Video Generation Types
// =============================================================================

export interface VideoGenerationRequest {
  prompt: string;
  model?: string;
  duration?: number;
  fps?: number;
  resolution?: string;
}

export interface VideoGenerationResponse {
  job_id: string;
  status: JobStatus;
  video_url?: string;
  thumbnail_url?: string;
  model: string;
  prompt: string;
  duration: number;
  created_at: string;
  estimated_completion?: string;
  progress?: number;
  error?: string;
  unavailable_message?: string;
}

// =============================================================================
// Video Edit Types
// =============================================================================

export interface VideoEditRequest {
  edit_prompt: string;
  model?: string;
  preserve_audio?: boolean;
}

export interface VideoEditResponse {
  job_id: string;
  status: JobStatus;
  original_filename?: string;
  edited_video_url?: string;
  thumbnail_url?: string;
  model: string;
  edit_prompt: string;
  created_at: string;
  progress?: number;
  error?: string;
}

// =============================================================================
// Photo-to-Video Transform Types
// =============================================================================

export interface PhotoToVideoRequest {
  motion_prompt?: string;
  model?: string;
  duration?: number;
  motion_strength?: number;
  loop?: boolean;
  fps?: number;
}

export interface PhotoToVideoResponse {
  job_id: string;
  status: JobStatus;
  original_filename?: string;
  video_url?: string;
  thumbnail_url?: string;
  model: string;
  duration: number;
  created_at: string;
  progress?: number;
  error?: string;
}

// =============================================================================
// API Client Types
// =============================================================================

export interface ApiConfig {
  baseUrl: string;
  timeout?: number;
}

export interface ApiError {
  status: number;
  message: string;
  details?: Record<string, unknown>;
}

export class ApiException extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiException';
  }
}
