'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Input';
import { FileUpload } from '@/components/ui/FileUpload';
import { ModelSelector, DEFAULT_IMAGE_MODELS, DEFAULT_VIDEO_MODELS } from '@/components/ui/ModelSelector';
import { ImageModelPicker } from '@/components/ui/ImageModelPicker';
import { NsfwModeToggle } from '@/components/ui/NsfwModeToggle';
import { LoadingState } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { PhotoCreator } from '@/components/PhotoCreator';
import {
  generateVideo,
  getVideoJobStatus,
  transformPhotoToVideo,
  getPhotoToVideoStatus,
  continueVideo,
  getContinueVideoStatus,
  pollJobStatus,
  getErrorMessage,
  resolveMediaUrl,
  downloadModel,
  getModelDownloadStatus,
} from '@/lib/api';
import { pickDefaultVideoModel, pickPhotoToVideoModel } from '@/lib/models';
import { useVideoModels } from '@/hooks/useModels';
import { useProject } from '@/hooks/useProject';
import { VideoPresetControls } from '@/components/studio/VideoPresetControls';
import { ChainSegmentControls } from '@/components/studio/ChainSegmentControls';
import {
  GenerationAdvancedControls,
  type VideoAdvancedSettings,
} from '@/components/studio/GenerationAdvancedControls';
import type { AspectRatioPreset } from '@/lib/videoPresets';
import type { ClipSource } from '@/lib/project';
import type { VideoCapability } from '@/lib/types';

type CreateMode = 'text' | 'photo' | 'image' | 'chain';

interface PreviewClip {
  jobId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  prompt: string;
  model: string;
  duration: number;
  source: ClipSource;
}

export function CreatePanel() {
  const [mode, setMode] = useState<CreateMode>('image');
  const videoCapability: VideoCapability =
    mode === 'text' ? 'text-to-video' : mode === 'photo' ? 'image-to-video' : 'all';
  const { models, loading: modelsLoading, refresh: refreshModels } = useVideoModels(
    DEFAULT_VIDEO_MODELS,
    videoCapability
  );
  const { addClip, clipCount, setSegmentNarration } = useProject();

  const [prompt, setPrompt] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textModel, setTextModel] = useState('ltx2-distilled');
  const [photoModel, setPhotoModel] = useState('ltx2-distilled');
  const [textKeyframeModel, setTextKeyframeModel] = useState(
    DEFAULT_IMAGE_MODELS[0]?.id || 'flux-dev-nsfw-lora'
  );
  const [textNsfwMode, setTextNsfwMode] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewClip | null>(null);
  const [justAdded, setJustAdded] = useState(false);
  const [isDownloadingModel, setIsDownloadingModel] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [textAspect, setTextAspect] = useState<AspectRatioPreset>('9:16');
  const [photoAspect, setPhotoAspect] = useState<AspectRatioPreset>('auto');
  const [duration, setDuration] = useState(4);
  const [fps, setFps] = useState(24);
  const [chainModel, setChainModel] = useState('ltx2-distilled');
  const [chainAspect, setChainAspect] = useState<AspectRatioPreset>('16:9');
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [segmentNarration, setSegmentNarrationText] = useState('');
  const [chainStart, setChainStart] = useState<'text' | 'photo'>('text');
  const [openingPrompt, setOpeningPrompt] = useState('');
  const [continuationPrompt, setContinuationPrompt] = useState(
    'Continue the motion smoothly with a subtle cinematic camera move'
  );
  const [shotCount, setShotCount] = useState(5);
  const [chainFile, setChainFile] = useState<File | null>(null);
  const [chainNsfwMode, setChainNsfwMode] = useState(true);
  const [chainKeyframeModel, setChainKeyframeModel] = useState(
    DEFAULT_IMAGE_MODELS[0]?.id || 'flux-dev-nsfw-lora'
  );
  const [textVideoAdvanced, setTextVideoAdvanced] = useState<VideoAdvancedSettings>({
    motionStrength: 0.5,
  });
  const [photoVideoAdvanced, setPhotoVideoAdvanced] = useState<VideoAdvancedSettings>({
    motionStrength: 0.5,
  });
  const [chainVideoAdvanced, setChainVideoAdvanced] = useState<VideoAdvancedSettings>({
    motionStrength: 0.5,
  });

  useEffect(() => {
    if (models.length === 0) return;
    setTextModel(pickDefaultVideoModel(models));
    setPhotoModel(pickPhotoToVideoModel(models));
    setChainModel(pickPhotoToVideoModel(models));
  }, [models]);

  const resetPreview = useCallback(() => {
    setPreview(null);
    setJustAdded(false);
    setError(null);
  }, []);

  const activeModelId =
    mode === 'text' ? textModel : mode === 'chain' ? chainModel : photoModel;

  const handleDownloadModel = useCallback(async () => {
    setIsDownloadingModel(true);
    setDownloadMessage('Starting Hugging Face download…');
    setError(null);

    try {
      let status = await downloadModel({ model_id: activeModelId, kind: 'video' });

      while (status.status === 'pending' || status.status === 'downloading' || status.status === 'converting') {
        setDownloadMessage(status.message);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        status = await getModelDownloadStatus(status.download_id);
      }

      if (status.status === 'failed') {
        throw new Error(status.error || 'Model download failed');
      }

      setDownloadMessage('Download complete — model is ready.');
      await refreshModels();
    } catch (err) {
      setError(getErrorMessage(err));
      setDownloadMessage(null);
    } finally {
      setIsDownloadingModel(false);
    }
  }, [activeModelId, refreshModels]);

  const handleGenerateText = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Describe the scene you want to generate');
      return;
    }

    setIsWorking(true);
    setError(null);
    setJustAdded(false);
    setProgressMessage('Queued on your Mac — local MLX is working...');

    try {
      const initial = await generateVideo({
        prompt: prompt.trim(),
        model: textModel,
        duration,
        fps,
        aspect_ratio: textAspect,
        image_model: textKeyframeModel,
        nsfw_mode: textNsfwMode,
        seed: textVideoAdvanced.seed,
        negative_prompt: textVideoAdvanced.negativePrompt,
        motion_negative_prompt: textVideoAdvanced.motionNegativePrompt,
        pure_t2v: textVideoAdvanced.pureT2v,
      });
      let response = initial;

      if (initial.status === 'pending' || initial.status === 'processing') {
        response = await pollJobStatus(() => getVideoJobStatus(initial.job_id), {
          intervalMs: 3000,
          maxAttempts: 800,
          onProgress: (status) => {
            if (status.progress && status.progress < 40) {
              setProgressMessage('Rendering keyframes...');
            } else {
              setProgressMessage('Generating motion...');
            }
          },
        });
      }

      if (!response.video_url) {
        throw new Error('Video finished but no file was returned');
      }

      setPreview({
        jobId: response.job_id,
        videoUrl: response.video_url,
        thumbnailUrl: response.thumbnail_url,
        prompt: response.prompt,
        model: response.model,
        duration: response.duration,
        source: 'text-to-video',
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setPreview(null);
    } finally {
      setIsWorking(false);
      setProgressMessage(null);
    }
  }, [prompt, textModel, textKeyframeModel, textNsfwMode, textVideoAdvanced, duration, fps, textAspect]);

  const handleGeneratePhoto = useCallback(async () => {
    if (!selectedFile) {
      setError('Upload a photo to animate');
      return;
    }

    setIsWorking(true);
    setError(null);
    setJustAdded(false);
    setProgressMessage('Animating your photo locally...');

    try {
      const initial = await transformPhotoToVideo(selectedFile, {
        motion_prompt: prompt.trim() || undefined,
        model: photoModel,
        duration,
        fps,
        aspect_ratio: photoAspect,
        motion_strength: photoVideoAdvanced.motionStrength ?? 0.5,
        seed: photoVideoAdvanced.seed,
        negative_prompt: photoVideoAdvanced.negativePrompt,
        motion_negative_prompt: photoVideoAdvanced.motionNegativePrompt,
        refine_prompt: photoVideoAdvanced.refinePrompt,
        refine_strength: photoVideoAdvanced.refineStrength,
      });

      let response = initial;
      if (initial.status === 'pending' || initial.status === 'processing') {
        response = await pollJobStatus(() => getPhotoToVideoStatus(initial.job_id), {
          intervalMs: 3000,
          maxAttempts: 800,
          onProgress: () => setProgressMessage('Applying motion to your image...'),
        });
      }

      if (!response.video_url) {
        throw new Error('Animation finished but no file was returned');
      }

      setPreview({
        jobId: response.job_id,
        videoUrl: response.video_url,
        thumbnailUrl: response.thumbnail_url,
        prompt: prompt.trim() || selectedFile.name,
        model: response.model,
        duration: response.duration,
        source: 'photo-to-video',
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setPreview(null);
    } finally {
      setIsWorking(false);
      setProgressMessage(null);
    }
  }, [selectedFile, prompt, photoModel, photoVideoAdvanced, duration, fps, photoAspect]);

  const handleRunChainSegment = useCallback(async () => {
    const canStart = chainStart === 'text' ? openingPrompt.trim() : chainFile;
    if (!canStart) {
      setError(chainStart === 'text' ? 'Write an opening shot prompt' : 'Upload a first-frame photo');
      return;
    }

    setIsWorking(true);
    setError(null);
    setSegmentNarration(segmentIndex, segmentNarration);

    try {
      let lastJobId: string;
      let lastVideoUrl: string;
      let lastPrompt: string;
      let lastModel: string;
      let lastDuration: number;
      let lastThumb: string | undefined;

      setProgressMessage(`Shot 1 of ${shotCount} — starting segment ${segmentIndex + 1}...`);

      if (chainStart === 'photo' && chainFile) {
        const initial = await transformPhotoToVideo(chainFile, {
          motion_prompt: openingPrompt.trim() || segmentNarration.trim() || undefined,
          model: chainModel,
          duration,
          fps,
          aspect_ratio: chainAspect,
          motion_strength: chainVideoAdvanced.motionStrength ?? 0.5,
          seed: chainVideoAdvanced.seed,
          motion_negative_prompt: chainVideoAdvanced.motionNegativePrompt,
          refine_prompt: chainVideoAdvanced.refinePrompt,
          refine_strength: chainVideoAdvanced.refineStrength,
        });
        const first = await pollJobStatus(() => getPhotoToVideoStatus(initial.job_id), {
          intervalMs: 3000,
          maxAttempts: 800,
          onProgress: () => setProgressMessage(`Shot 1 of ${shotCount} — animating opening frame...`),
        });
        if (!first.video_url) throw new Error('Opening shot finished without a video');
        lastJobId = first.job_id;
        lastVideoUrl = first.video_url;
        lastPrompt = openingPrompt.trim() || chainFile.name;
        lastModel = first.model;
        lastDuration = first.duration;
        lastThumb = first.thumbnail_url;
        addClip({
          jobId: first.job_id,
          videoUrl: first.video_url,
          thumbnailUrl: first.thumbnail_url,
          prompt: openingPrompt.trim() || chainFile.name,
          model: first.model,
          duration: first.duration,
          source: 'photo-to-video',
          segmentIndex,
          shotIndex: 0,
        });
      } else {
        const initial = await generateVideo({
          prompt: openingPrompt.trim(),
          model: chainModel,
          duration,
          fps,
          aspect_ratio: chainAspect,
          image_model: chainKeyframeModel,
          nsfw_mode: chainNsfwMode,
          seed: chainVideoAdvanced.seed,
          negative_prompt: chainVideoAdvanced.negativePrompt,
          motion_negative_prompt: chainVideoAdvanced.motionNegativePrompt,
          pure_t2v: chainVideoAdvanced.pureT2v,
        });
        const first = await pollJobStatus(() => getVideoJobStatus(initial.job_id), {
          intervalMs: 3000,
          maxAttempts: 800,
          onProgress: () => setProgressMessage(`Shot 1 of ${shotCount} — rendering opening shot...`),
        });
        if (!first.video_url) throw new Error('Opening shot finished without a video');
        lastJobId = first.job_id;
        lastVideoUrl = first.video_url;
        lastPrompt = first.prompt;
        lastModel = first.model;
        lastDuration = first.duration;
        lastThumb = first.thumbnail_url;
        addClip({
          jobId: first.job_id,
          videoUrl: first.video_url,
          thumbnailUrl: first.thumbnail_url,
          prompt: first.prompt,
          model: first.model,
          duration: first.duration,
          source: 'text-to-video',
          segmentIndex,
          shotIndex: 0,
        });
      }

      for (let shot = 1; shot < shotCount; shot += 1) {
        setProgressMessage(
          `Shot ${shot + 1} of ${shotCount} — seeding from last frame...`
        );
        const queued = await continueVideo({
          source_job_id: lastJobId,
          motion_prompt: continuationPrompt.trim() || lastPrompt,
          model: chainModel,
          duration,
          fps,
          aspect_ratio: 'auto',
          segment_index: segmentIndex,
          shot_index: shot,
          nsfw_mode: chainNsfwMode,
          negative_prompt: chainVideoAdvanced.negativePrompt,
          motion_negative_prompt: chainVideoAdvanced.motionNegativePrompt,
          seed: chainVideoAdvanced.seed,
          motion_strength: chainVideoAdvanced.motionStrength,
        });
        const continued = await pollJobStatus(() => getContinueVideoStatus(queued.job_id), {
          intervalMs: 3000,
          maxAttempts: 800,
          onProgress: () =>
            setProgressMessage(`Shot ${shot + 1} of ${shotCount} — generating motion...`),
        });
        if (!continued.video_url) throw new Error(`Shot ${shot + 1} finished without a video`);

        addClip({
          jobId: continued.job_id,
          videoUrl: continued.video_url,
          thumbnailUrl: continued.thumbnail_url,
          prompt: continued.prompt,
          model: continued.model,
          duration: continued.duration,
          source: 'chain-continue',
          segmentIndex,
          shotIndex: shot,
          continuedFromJobId: lastJobId,
        });

        lastJobId = continued.job_id;
        lastVideoUrl = continued.video_url;
        lastPrompt = continued.prompt;
        lastModel = continued.model;
        lastDuration = continued.duration;
        lastThumb = continued.thumbnail_url;
      }

      setPreview({
        jobId: lastJobId,
        videoUrl: lastVideoUrl,
        thumbnailUrl: lastThumb,
        prompt: lastPrompt,
        model: lastModel,
        duration: lastDuration,
        source: 'chain-continue',
      });
      setJustAdded(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsWorking(false);
      setProgressMessage(null);
    }
  }, [
    addClip,
    chainAspect,
    chainFile,
    chainModel,
    chainStart,
    chainKeyframeModel,
    chainNsfwMode,
    chainVideoAdvanced,
    continuationPrompt,
    duration,
    fps,
    openingPrompt,
    segmentIndex,
    segmentNarration,
    setSegmentNarration,
    shotCount,
  ]);

  const handleNextSegment = useCallback(() => {
    setSegmentNarration(segmentIndex, segmentNarration);
    setSegmentIndex((value) => value + 1);
    setSegmentNarrationText('');
    setOpeningPrompt('');
    setChainFile(null);
    setError(null);
  }, [segmentIndex, segmentNarration, setSegmentNarration]);

  const handleAddToProject = useCallback(() => {
    if (!preview) return;
    addClip({
      jobId: preview.jobId,
      videoUrl: preview.videoUrl,
      thumbnailUrl: preview.thumbnailUrl,
      prompt: preview.prompt,
      model: preview.model,
      duration: preview.duration,
      source: preview.source,
    });
    setJustAdded(true);
  }, [preview, addClip]);

  const videoUrl = resolveMediaUrl(preview?.videoUrl);
  const posterUrl = resolveMediaUrl(preview?.thumbnailUrl);

  return (
    <div className="velvet-panel flex h-full flex-col">
      <div className="border-b border-rose-500/15 px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2
              className="font-display text-lg font-bold text-rose-50 sm:text-xl"
              style={{ fontFamily: 'var(--font-syne), system-ui, sans-serif' }}
            >
              {mode === 'image' ? 'Still frame' : 'Motion clip'}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {mode === 'image'
                ? 'Uncensored Flux LoRAs — render explicit stills, then animate them on Video.'
                : 'Build clips for the timeline. Appearance comes from Image; motion from Wan / LTX.'}
            </p>
          </div>
          {mode === 'image' && <span className="nsfw-badge shrink-0">18+</span>}
        </div>

        <div className="mt-4 flex items-stretch gap-2">
          <div className="flex min-w-[7.5rem] flex-col rounded-xl bg-black/30 p-1">
            <span className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-rose-400">
              Stills
            </span>
            <button
              type="button"
              onClick={() => {
                setMode('image');
                resetPreview();
              }}
              className={`flex flex-1 flex-col items-center justify-center rounded-lg px-2 py-2.5 text-sm font-medium transition-colors ${
                mode === 'image'
                  ? 'bg-gradient-to-br from-rose-600 to-rose-800 text-white shadow-lg shadow-rose-950/50'
                  : 'text-zinc-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>Image</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90">
                8 explicit
              </span>
            </button>
          </div>

          <div className="w-px shrink-0 bg-white/10" aria-hidden />

          <div className="flex min-w-0 flex-1 flex-col rounded-xl bg-black/30 p-1">
            <span className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-400/90">
              Motion
            </span>
            <div className="flex flex-1 gap-1">
              {([
                { id: 'text' as const, label: 'Text' },
                { id: 'photo' as const, label: 'Photo' },
                { id: 'chain' as const, label: 'Chain' },
              ]).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setMode(tab.id);
                    resetPreview();
                  }}
                  className={`flex flex-1 items-center justify-center rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
                    mode === tab.id
                      ? 'bg-gradient-to-br from-fuchsia-700 to-violet-800 text-white shadow-lg shadow-fuchsia-950/40'
                      : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {mode === 'image' ? (
          <div className="space-y-3">
            <PhotoCreator variant="studio" />
          </div>
        ) : mode === 'chain' ? (
          <>
            {chainStart === 'text' && (
              <div className="space-y-3 rounded-xl border border-rose-500/25 bg-rose-950/15 px-3 py-3">
                <p className="text-xs text-rose-200/80">
                  Opening shot uses an explicit Flux keyframe — same uncensored pipeline as Stills.
                </p>
                <ImageModelPicker
                  value={chainKeyframeModel}
                  onChange={setChainKeyframeModel}
                  disabled={isWorking}
                  variant="studio"
                  defaultTier={chainNsfwMode ? 'nsfw' : 'all'}
                />
                <NsfwModeToggle
                  checked={chainNsfwMode}
                  onChange={setChainNsfwMode}
                  disabled={isWorking}
                  variant="inline"
                />
              </div>
            )}
            <ModelSelector
              label="Motion engine"
              models={models}
              value={chainModel}
              onChange={setChainModel}
              disabled={isWorking}
              isLoading={modelsLoading}
              fullWidth
              variant="studio"
              onDownload={handleDownloadModel}
              isDownloading={isDownloadingModel}
              downloadMessage={downloadMessage}
            />
            <GenerationAdvancedControls
              mode="video"
              videoSettings={chainVideoAdvanced}
              onVideoChange={setChainVideoAdvanced}
              disabled={isWorking}
            />

            <ChainSegmentControls
              segmentIndex={segmentIndex}
              segmentNarration={segmentNarration}
              onSegmentNarrationChange={setSegmentNarrationText}
              chainStart={chainStart}
              onChainStartChange={setChainStart}
              openingPrompt={openingPrompt}
              onOpeningPromptChange={setOpeningPrompt}
              continuationPrompt={continuationPrompt}
              onContinuationPromptChange={setContinuationPrompt}
              shotCount={shotCount}
              onShotCountChange={setShotCount}
              selectedFile={chainFile}
              onFileSelect={setChainFile}
              modelId={chainModel}
              aspectRatio={chainAspect}
              duration={duration}
              fps={fps}
              disabled={isWorking}
              isWorking={isWorking}
              onRunSegment={handleRunChainSegment}
              onNextSegment={handleNextSegment}
              onAspectChange={setChainAspect}
              onDurationChange={setDuration}
              onFpsChange={setFps}
            />
            {error && (
              <ErrorAlert
                message={error}
                title="Chain failed"
                onRetry={handleRunChainSegment}
                onDismiss={() => setError(null)}
                isRetrying={isWorking}
              />
            )}
            {isWorking && (
              <LoadingState message={progressMessage || 'Building linked shots...'} />
            )}
            {justAdded && !isWorking && (
              <p className="text-sm text-emerald-400">
                Segment added to timeline — {shotCount} shots on the V1 rail.
              </p>
            )}
          </>
        ) : (
          <>
            {mode === 'photo' && (
              <FileUpload
                label="Source photo"
                accept="image/*"
                maxSize={10 * 1024 * 1024}
                onFileSelect={(files) => {
                  setSelectedFile(files[0] ?? null);
                  setError(null);
                }}
                onError={setError}
                disabled={isWorking}
                fullWidth
                helperText="PNG, JPG, or WEBP — up to 10MB"
              />
            )}

            <TextArea
              label={mode === 'text' ? 'Scene & subject' : 'Motion direction (optional)'}
              placeholder={
                mode === 'text'
                  ? 'Woman standing in a dim hotel room, fully nude, slow turn toward camera, candlelight on skin, shallow focus...'
                  : 'Slow hip sway, hair drifting, subtle push-in, breathing motion...'
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isWorking}
              fullWidth
              rows={4}
              variant="studio"
            />

            {mode === 'text' && (
              <div className="space-y-3 rounded-xl border border-rose-500/30 bg-gradient-to-br from-rose-950/30 to-black/30 px-3 py-3">
                <p className="text-xs leading-relaxed text-rose-200/85">
                  <strong className="font-semibold text-rose-100">Two beats:</strong> an explicit Flux
                  keyframe sets the body, then the motion engine brings it to life. All the heat is in
                  the look model below.
                </p>
                <ImageModelPicker
                  value={textKeyframeModel}
                  onChange={setTextKeyframeModel}
                  disabled={isWorking}
                  variant="studio"
                  defaultTier={textNsfwMode ? 'nsfw' : 'all'}
                />
                <NsfwModeToggle
                  checked={textNsfwMode}
                  onChange={setTextNsfwMode}
                  disabled={isWorking}
                  variant="inline"
                />
              </div>
            )}

            {mode === 'photo' && (
              <p className="rounded-lg border border-rose-500/20 bg-black/30 px-3 py-2 text-xs text-zinc-400">
                Your upload <em className="text-rose-300/90 not-italic">is</em> the frame — render an
                explicit still on the Stills tab first, or drop in your own uncensored image.
              </p>
            )}

            <ModelSelector
              label={mode === 'text' ? 'Motion engine' : 'Animate with'}
              models={models}
              value={mode === 'text' ? textModel : photoModel}
              onChange={mode === 'text' ? setTextModel : setPhotoModel}
              disabled={isWorking}
              isLoading={modelsLoading}
              fullWidth
              variant="studio"
              onDownload={handleDownloadModel}
              isDownloading={isDownloadingModel}
              downloadMessage={downloadMessage}
            />

            <VideoPresetControls
              mode={mode}
              aspectRatio={mode === 'text' ? textAspect : photoAspect}
              duration={duration}
              fps={fps}
              modelId={mode === 'text' ? textModel : photoModel}
              disabled={isWorking}
              onAspectChange={mode === 'text' ? setTextAspect : setPhotoAspect}
              onDurationChange={setDuration}
              onFpsChange={setFps}
            />

            <GenerationAdvancedControls
              mode="video"
              videoSettings={mode === 'text' ? textVideoAdvanced : photoVideoAdvanced}
              onVideoChange={mode === 'text' ? setTextVideoAdvanced : setPhotoVideoAdvanced}
              disabled={isWorking}
            />

            {error && (
              <ErrorAlert
                message={error}
                title="Could not generate"
                onRetry={mode === 'text' ? handleGenerateText : handleGeneratePhoto}
                onDismiss={() => setError(null)}
                isRetrying={isWorking}
              />
            )}

            {isWorking && (
              <LoadingState message={progressMessage || 'Working on your clip...'} />
            )}

            {videoUrl && !isWorking && preview && (
              <div className="space-y-3 rounded-xl border border-rose-500/35 bg-rose-950/20 p-4 velvet-glow-ring">
                <div className="overflow-hidden rounded-lg border border-white/10">
                  <video
                    src={videoUrl}
                    controls
                    className="mx-auto w-full max-h-[70vh] object-contain"
                    poster={posterUrl || undefined}
                  />
                </div>
                <p className="text-sm text-zinc-300 line-clamp-2">{preview.prompt}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="primary" onClick={handleAddToProject} disabled={justAdded}>
                    {justAdded ? 'Added to project' : 'Add to project'}
                  </Button>
                  <Button variant="outline" onClick={resetPreview}>
                    Discard
                  </Button>
                  {justAdded && (
                    <span className="text-sm text-emerald-400">
                      Clip #{clipCount} ready in timeline →
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {mode !== 'image' && mode !== 'chain' && (
        <div className="border-t border-rose-500/15 px-5 py-4">
          <Button
            variant="velvet"
            size="lg"
            fullWidth
            onClick={mode === 'text' ? handleGenerateText : handleGeneratePhoto}
            disabled={isWorking || (mode === 'text' ? !prompt.trim() : !selectedFile)}
            isLoading={isWorking}
          >
            {isWorking ? 'Rendering...' : mode === 'text' ? 'Render motion clip' : 'Animate still'}
          </Button>
        </div>
      )}
    </div>
  );
}