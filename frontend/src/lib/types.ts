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

export type ContentTier = 'all' | 'nsfw' | 'general' | 'fast';

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description?: string;
  capabilities: string[];
  nsfw?: boolean;
  uncensored?: boolean;
  content_tier?: ContentTier | null;
  ready?: boolean;
}

export interface ModelListResponse {
  models: ModelInfo[];
  media_type: MediaType;
}

export interface ModelDownloadRequest {
  model_id: string;
  kind: MediaType;
}

export interface ModelDownloadResponse {
  download_id: string;
  model_id: string;
  kind: MediaType;
  status: 'pending' | 'downloading' | 'converting' | 'completed' | 'failed';
  message: string;
  error?: string;
  ready?: boolean;
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
  /** Explicit mode: NSFW LoRA + anti-clothing negative prompt */
  nsfw_mode?: boolean;
  negative_prompt?: string;
  seed?: number;
  seed_walk?: number;
  steps?: number;
  guidance?: number;
  lora_scale?: number;
}

export interface PhotoGenerationResponse {
  job_id: string;
  status: JobStatus;
  image_url?: string;
  image_urls?: string[];
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

export interface VideoContinueRequest {
  source_job_id: string;
  motion_prompt?: string;
  model?: string;
  duration?: number;
  fps?: number;
  aspect_ratio?: string;
  segment_index?: number;
  shot_index?: number;
  nsfw_mode?: boolean;
  negative_prompt?: string;
  motion_negative_prompt?: string;
  seed?: number;
  motion_strength?: number;
}

export interface VideoContinueResponse {
  job_id: string;
  status: JobStatus;
  source_job_id: string;
  seed_frame_url?: string;
  video_url?: string;
  thumbnail_url?: string;
  model: string;
  prompt: string;
  duration: number;
  created_at: string;
  progress?: number;
  error?: string;
}

export type VideoCapability = 'text-to-video' | 'image-to-video' | 'all';

export interface VideoGenerationRequest {
  prompt: string;
  model?: string;
  duration?: number;
  fps?: number;
  resolution?: string;
  aspect_ratio?: string;
  /** Keyframe model from image catalog (text-to-video appearance / NSFW) */
  image_model?: string;
  nsfw_mode?: boolean;
  seed?: number;
  negative_prompt?: string;
  motion_negative_prompt?: string;
  pure_t2v?: boolean;
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
  aspect_ratio?: string;
  seed?: number;
  negative_prompt?: string;
  motion_negative_prompt?: string;
  source_image_job_id?: string;
  refine_prompt?: string;
  refine_strength?: number;
}

export interface StillAnimateRequest {
  source_image_job_id: string;
  motion_prompt?: string;
  model?: string;
  duration?: number;
  fps?: number;
  aspect_ratio?: string;
  motion_strength?: number;
  seed?: number;
  negative_prompt?: string;
  motion_negative_prompt?: string;
  refine_prompt?: string;
  refine_strength?: number;
}

export interface ImageRefineRequest {
  source_image_job_id: string;
  refine_prompt: string;
  strength?: number;
  model?: string;
  seed?: number;
  negative_prompt?: string;
  nsfw_mode?: boolean;
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

// =============================================================================
// Project Assembly Types
// =============================================================================

export interface ConcatProjectRequest {
  clip_urls: string[];
  project_name?: string;
}

export interface ConcatProjectResponse {
  job_id: string;
  video_url: string;
  clip_count: number;
  duration: number;
  project_name?: string;
  created_at: string;
}
