'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingState } from '@/components/ui/LoadingSpinner';
import { concatProject, getErrorMessage, resolveMediaUrl } from '@/lib/api';
import { useProject } from '@/hooks/useProject';
import type { ProjectClip } from '@/lib/project';

const PX_PER_SECOND = 52;

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds * 10) / 10}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 24);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

function clipLabel(source: ProjectClip['source']): string {
  if (source === 'chain-continue') return 'Continue';
  if (source === 'photo-to-video') return 'Photo';
  return 'Text';
}

export function ClipTimeline() {
  const {
    project,
    clipCount,
    totalSeconds,
    removeClip,
    moveClip,
    renameProject,
    clearProject,
  } = useProject();

  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const selectedClip =
    project.clips.find((clip) => clip.id === selectedClipId) ??
    project.clips[project.clips.length - 1] ??
    null;

  const playheadSeconds = useMemo(() => {
    let elapsed = 0;
    for (const clip of project.clips) {
      if (clip.id === selectedClipId) return elapsed;
      elapsed += clip.duration || 0;
    }
    return Math.max(0, totalSeconds - (selectedClip?.duration || 0));
  }, [project.clips, selectedClip, selectedClipId, totalSeconds]);

  const timelineWidth = Math.max(720, totalSeconds * PX_PER_SECOND + 160);

  const segmentNarrationByIndex = useMemo(() => {
    const map = new Map<number, string>();
    for (const entry of project.segmentNarrations) {
      map.set(entry.segmentIndex, entry.narration);
    }
    return map;
  }, [project.segmentNarrations]);

  const playSequence = useCallback(() => {
    if (project.clips.length === 0) return;
    setSequenceIndex(0);
    setIsPlayingSequence(true);
    setExportUrl(null);
  }, [project.clips.length]);

  useEffect(() => {
    if (!isPlayingSequence || !videoRef.current || project.clips.length === 0) return;
    const clip = project.clips[sequenceIndex];
    const url = resolveMediaUrl(clip.videoUrl);
    if (!url) return;
    videoRef.current.src = url;
    videoRef.current.play().catch(() => {});
  }, [isPlayingSequence, sequenceIndex, project.clips]);

  const handleSequenceEnded = useCallback(() => {
    if (sequenceIndex < project.clips.length - 1) {
      setSequenceIndex((i) => i + 1);
    } else {
      setIsPlayingSequence(false);
      setSequenceIndex(0);
    }
  }, [sequenceIndex, project.clips.length]);

  const handleExport = useCallback(async () => {
    if (project.clips.length < 2) {
      setExportError('Add at least two clips before exporting a full movie');
      return;
    }

    setIsExporting(true);
    setExportError(null);
    setExportUrl(null);

    try {
      const result = await concatProject({
        clip_urls: project.clips.map((c) => c.videoUrl),
        project_name: project.name,
      });
      setExportUrl(resolveMediaUrl(result.video_url));
    } catch (err) {
      setExportError(getErrorMessage(err));
    } finally {
      setIsExporting(false);
    }
  }, [project]);

  const handleDownload = useCallback((url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const activeClip = isPlayingSequence ? project.clips[sequenceIndex] : selectedClip;
  const monitorUrl = resolveMediaUrl(activeClip?.videoUrl);
  const monitorPoster = resolveMediaUrl(activeClip?.thumbnailUrl);

  let railOffset = 0;

  return (
    <div className="velvet-panel flex h-full flex-col overflow-hidden">
      <div className="border-b border-rose-500/15 bg-black/40 px-4 py-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-400/70">
              Preview
            </label>
            <input
              type="text"
              value={project.name}
              onChange={(e) => renameProject(e.target.value)}
              className="mt-1 w-full rounded-lg border border-rose-500/20 bg-black/50 px-3 py-1.5 text-sm font-medium text-white focus:border-rose-500/50 focus:outline-none focus:ring-1 focus:ring-rose-500/30"
            />
          </div>
          <div className="text-right text-xs text-zinc-400">
            <div>{clipCount} clips</div>
            <div>{formatDuration(totalSeconds)}</div>
            <div className="font-mono text-zinc-500">{formatTimecode(playheadSeconds)}</div>
          </div>
        </div>

        <div className="aspect-video overflow-hidden rounded-lg border border-zinc-800 bg-black">
          {project.clips.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-zinc-500">
              <span className="text-3xl text-rose-900/80">◇</span>
              <p className="text-sm text-zinc-400">Your clips appear here</p>
              <p className="text-xs text-zinc-600">Render a still or motion clip to fill the timeline</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              key={isPlayingSequence ? `seq-${sequenceIndex}` : selectedClip?.id}
              src={monitorUrl || undefined}
              controls
              className="h-full w-full object-contain"
              poster={monitorPoster || undefined}
              onEnded={isPlayingSequence ? handleSequenceEnded : undefined}
            />
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={playSequence} disabled={project.clips.length === 0}>
            Play sequence
          </Button>
          {isPlayingSequence && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsPlayingSequence(false);
                setSequenceIndex(0);
              }}
            >
              Stop
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={clearProject}>
            Clear timeline
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExport}
            disabled={isExporting || project.clips.length < 2}
            isLoading={isExporting}
          >
            Export
          </Button>
        </div>
      </div>

      {/* Premiere-style rails */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Timeline
          </span>
          <span className="text-xs text-zinc-500">Film rails · click a clip to preview</span>
        </div>

        <div ref={railRef} className="flex-1 overflow-x-auto overflow-y-hidden px-4 py-3">
          {project.clips.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-rose-500/25 bg-rose-950/10 text-sm text-zinc-500">
              Clips land here automatically — stack scenes, then export your film
            </div>
          ) : (
            <div style={{ width: timelineWidth }} className="relative min-h-[148px]">
              {/* Time ruler */}
              <div className="mb-2 flex h-6 border-b border-zinc-800 text-[10px] font-mono text-zinc-500">
                {Array.from({ length: Math.ceil(totalSeconds) + 1 }).map((_, second) => (
                  <div
                    key={second}
                    className="relative shrink-0 border-l border-zinc-800/80"
                    style={{ width: PX_PER_SECOND }}
                  >
                    <span className="absolute left-1 top-0.5">{second}s</span>
                  </div>
                ))}
              </div>

              {/* Playhead */}
              <div
                className="pointer-events-none absolute bottom-0 top-8 z-20 w-px bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.85)]"
                style={{ left: playheadSeconds * PX_PER_SECOND }}
              />

              {/* Track label + clip rail */}
              <div className="flex gap-3">
                <div className="flex w-10 shrink-0 flex-col justify-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  <span>V1</span>
                </div>
                <div className="relative min-h-[88px] flex-1 rounded-md border border-zinc-800 bg-[#15151d]">
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:52px_100%]" />
                  <div className="relative flex h-full items-center py-2">
                    {project.clips.map((clip, index) => {
                      const width = Math.max(72, (clip.duration || 3) * PX_PER_SECOND);
                      const left = railOffset;
                      railOffset += width;

                      const prevSegment = project.clips[index - 1]?.segmentIndex ?? 0;
                      const segment = clip.segmentIndex ?? 0;
                      const showSegmentBreak =
                        index > 0 && segment !== prevSegment && segmentNarrationByIndex.has(segment);

                      return (
                        <div key={clip.id} className="contents">
                          {showSegmentBreak && (
                            <div
                              className="mx-1 flex w-28 shrink-0 flex-col items-center justify-center rounded border border-amber-500/40 bg-amber-950/30 px-2 py-2 text-center"
                              title={segmentNarrationByIndex.get(segment)}
                            >
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                                Segment {segment + 1}
                              </span>
                              <span className="mt-1 line-clamp-3 text-[10px] leading-tight text-amber-100/80">
                                {segmentNarrationByIndex.get(segment)}
                              </span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClipId(clip.id);
                              setIsPlayingSequence(false);
                            }}
                            className={`group relative mr-1 flex h-16 shrink-0 flex-col overflow-hidden rounded-md border text-left transition-all ${
                              selectedClipId === clip.id
                                ? 'border-rose-400 ring-2 ring-rose-500/40'
                                : 'border-zinc-700 hover:border-rose-500/50'
                            } ${clip.source === 'chain-continue' ? 'bg-violet-950/50' : 'bg-zinc-900/80'}`}
                            style={{ width }}
                            title={clip.prompt}
                          >
                            {resolveMediaUrl(clip.thumbnailUrl) ? (
                              <img
                                src={resolveMediaUrl(clip.thumbnailUrl) || ''}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover opacity-50"
                              />
                            ) : null}
                            <div className="relative z-10 flex h-full flex-col justify-between p-2">
                              <div className="flex items-center justify-between gap-1">
                                <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                  {index + 1}
                                </span>
                                <span className="text-[10px] text-zinc-300">{clipLabel(clip.source)}</span>
                              </div>
                              <div>
                                <p className="line-clamp-1 text-[11px] font-medium text-white">
                                  {clip.prompt || 'Untitled'}
                                </p>
                                <p className="text-[10px] text-zinc-400">{clip.duration}s</p>
                              </div>
                            </div>
                            {clip.continuedFromJobId && (
                              <span className="absolute right-1 top-1 rounded bg-violet-600/80 px-1 text-[9px] text-white">
                                ↪
                              </span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Clip inspector row */}
        {selectedClip && (
          <div className="border-t border-white/10 px-4 py-3">
            <ClipInspector
              clip={selectedClip}
              index={project.clips.findIndex((c) => c.id === selectedClip.id)}
              total={project.clips.length}
              onMoveUp={() => moveClip(selectedClip.id, 'up')}
              onMoveDown={() => moveClip(selectedClip.id, 'down')}
              onRemove={() => removeClip(selectedClip.id)}
            />
          </div>
        )}

        {exportError && (
          <div className="px-4 pb-3">
            <ErrorAlert message={exportError} title="Export failed" onDismiss={() => setExportError(null)} />
          </div>
        )}

        {isExporting && (
          <div className="px-4 pb-3">
            <LoadingState message="Stitching clips with ffmpeg..." />
          </div>
        )}

        {exportUrl && !isExporting && (
          <div className="border-t border-emerald-500/20 bg-emerald-950/10 px-4 py-3">
            <p className="mb-2 text-sm font-medium text-emerald-300">Export ready</p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleDownload(exportUrl, `${project.name.replace(/\s+/g, '-')}.mp4`)}
            >
              Download movie
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ClipInspector({
  clip,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  clip: ProjectClip;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-violet-600/20 text-sm font-bold text-violet-300">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-white">{clip.prompt || 'Untitled clip'}</p>
        <p className="text-xs text-zinc-500">
          {clip.duration}s · {clipLabel(clip.source)}
          {clip.segmentIndex !== undefined ? ` · Segment ${clip.segmentIndex + 1}` : ''}
          {clip.shotIndex !== undefined ? ` · Shot ${clip.shotIndex + 1}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <button type="button" onClick={onMoveUp} disabled={index === 0} className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-white/10 disabled:opacity-30">↑</button>
        <button type="button" onClick={onMoveDown} disabled={index === total - 1} className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-white/10 disabled:opacity-30">↓</button>
        <button type="button" onClick={onRemove} className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-950/40">Remove</button>
      </div>
    </div>
  );
}