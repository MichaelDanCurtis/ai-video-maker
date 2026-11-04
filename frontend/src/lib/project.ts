/**
 * Local project state for assembling clips into a reel.
 */

export type ClipSource = 'text-to-video' | 'photo-to-video' | 'chain-continue';

export interface SegmentNarration {
  id: string;
  segmentIndex: number;
  narration: string;
  createdAt: string;
}

export interface ProjectClip {
  id: string;
  jobId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  prompt: string;
  model: string;
  duration: number;
  source: ClipSource;
  addedAt: string;
  segmentIndex?: number;
  shotIndex?: number;
  continuedFromJobId?: string;
}

export interface VideoProject {
  id: string;
  name: string;
  clips: ProjectClip[];
  segmentNarrations: SegmentNarration[];
  updatedAt: string;
}

const STORAGE_KEY = 'ai-video-maker-project-v1';

export function createEmptyProject(name = 'Untitled Project'): VideoProject {
  const now = new Date().toISOString();
  return {
    id: `proj_${crypto.randomUUID().slice(0, 8)}`,
    name,
    clips: [],
    segmentNarrations: [],
    updatedAt: now,
  };
}

export function loadProject(): VideoProject {
  if (typeof window === 'undefined') {
    return createEmptyProject();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyProject();
    const parsed = JSON.parse(raw) as VideoProject;
    if (!parsed?.clips || !Array.isArray(parsed.clips)) {
      return createEmptyProject();
    }
    if (!parsed.segmentNarrations) {
      parsed.segmentNarrations = [];
    }
    return parsed;
  } catch {
    return createEmptyProject();
  }
}

export function saveProject(project: VideoProject): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}

export function createClipId(): string {
  return `clip_${crypto.randomUUID().slice(0, 8)}`;
}

export function totalDuration(clips: ProjectClip[]): number {
  return clips.reduce((sum, clip) => sum + (clip.duration || 0), 0);
}