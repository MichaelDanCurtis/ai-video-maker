import type { ModelOption } from '@/components/ui/ModelSelector';

/** Prefer a ready local model; LTX when available, else first ready, else first listed. */
export function pickDefaultVideoModel(models: ModelOption[]): string {
  if (models.length === 0) return 'ltx2-distilled';

  const ready = models.filter((m) => m.ready !== false);
  const pool = ready.length > 0 ? ready : models;

  const ltx = pool.find((m) => m.id === 'ltx2-distilled');
  if (ltx) return ltx.id;

  const t2v = pool.find((m) => m.id === 'wan22-t2v-lightning');
  if (t2v) return t2v.id;

  const i2v = pool.find((m) => m.id === 'wan22-i2v-lightning');
  if (i2v) return i2v.id;

  return pool[0].id;
}

/** Photo animation: prefer LTX, then Wan I2V — never Wan T2V (text-only weights). */
export function pickPhotoToVideoModel(models: ModelOption[]): string {
  if (models.length === 0) return 'ltx2-distilled';

  const ready = models.filter((m) => m.ready !== false);
  const pool = ready.length > 0 ? ready : models;

  const ltx = pool.find((m) => m.id === 'ltx2-distilled');
  if (ltx) return ltx.id;

  const wanI2v = pool.find((m) => m.id === 'wan22-i2v-lightning');
  if (wanI2v) return wanI2v.id;

  const i2v = pool.find((m) => m.capabilities?.includes('image-to-video'));
  if (i2v) return i2v.id;

  return pool[0].id;
}