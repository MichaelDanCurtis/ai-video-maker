'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createClipId,
  createEmptyProject,
  loadProject,
  saveProject,
  totalDuration,
  type ClipSource,
  type ProjectClip,
  type SegmentNarration,
  type VideoProject,
} from '@/lib/project';

interface AddClipInput {
  jobId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  prompt: string;
  model: string;
  duration: number;
  source: ClipSource;
  segmentIndex?: number;
  shotIndex?: number;
  continuedFromJobId?: string;
}

interface ProjectContextValue {
  project: VideoProject;
  clipCount: number;
  totalSeconds: number;
  addClip: (input: AddClipInput) => ProjectClip;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, direction: 'up' | 'down') => void;
  renameProject: (name: string) => void;
  clearProject: () => void;
  setSegmentNarration: (segmentIndex: number, narration: string) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<VideoProject>(() => createEmptyProject());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProject(loadProject());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveProject(project);
  }, [project, hydrated]);

  const addClip = useCallback((input: AddClipInput): ProjectClip => {
    const clip: ProjectClip = {
      id: createClipId(),
      jobId: input.jobId,
      videoUrl: input.videoUrl,
      thumbnailUrl: input.thumbnailUrl,
      prompt: input.prompt,
      model: input.model,
      duration: input.duration,
      source: input.source,
      segmentIndex: input.segmentIndex,
      shotIndex: input.shotIndex,
      continuedFromJobId: input.continuedFromJobId,
      addedAt: new Date().toISOString(),
    };

    setProject((prev) => ({
      ...prev,
      clips: [...prev.clips, clip],
      updatedAt: new Date().toISOString(),
    }));

    return clip;
  }, []);

  const removeClip = useCallback((clipId: string) => {
    setProject((prev) => ({
      ...prev,
      clips: prev.clips.filter((c) => c.id !== clipId),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const moveClip = useCallback((clipId: string, direction: 'up' | 'down') => {
    setProject((prev) => {
      const index = prev.clips.findIndex((c) => c.id === clipId);
      if (index < 0) return prev;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.clips.length) return prev;

      const next = [...prev.clips];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, clips: next, updatedAt: new Date().toISOString() };
    });
  }, []);

  const renameProject = useCallback((name: string) => {
    setProject((prev) => ({
      ...prev,
      name: name.trim() || 'Untitled Project',
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const clearProject = useCallback(() => {
    setProject(createEmptyProject());
  }, []);

  const setSegmentNarration = useCallback((segmentIndex: number, narration: string) => {
    const trimmed = narration.trim();
    setProject((prev) => {
      const existing = prev.segmentNarrations.filter((s) => s.segmentIndex !== segmentIndex);
      const next: SegmentNarration[] = trimmed
        ? [
            ...existing,
            {
              id: `seg_${segmentIndex}`,
              segmentIndex,
              narration: trimmed,
              createdAt: new Date().toISOString(),
            },
          ]
        : existing;
      return { ...prev, segmentNarrations: next, updatedAt: new Date().toISOString() };
    });
  }, []);

  const value = useMemo(
    () => ({
      project,
      clipCount: project.clips.length,
      totalSeconds: totalDuration(project.clips),
      addClip,
      removeClip,
      moveClip,
      renameProject,
      clearProject,
      setSegmentNarration,
    }),
    [project, addClip, removeClip, moveClip, renameProject, clearProject, setSegmentNarration]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error('useProject must be used within ProjectProvider');
  }
  return ctx;
}