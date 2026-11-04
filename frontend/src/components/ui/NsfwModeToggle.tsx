'use client';

interface NsfwModeToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  /** Compact row vs full explainer card */
  variant?: 'card' | 'inline';
}

export function NsfwModeToggle({
  checked,
  onChange,
  disabled = false,
  variant = 'card',
}: NsfwModeToggleProps) {
  const shell =
    variant === 'card'
      ? `flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
          checked
            ? 'border-rose-500/50 bg-gradient-to-br from-rose-950/50 to-black/40 velvet-glow-ring'
            : 'border-white/10 bg-black/25 hover:border-rose-500/25'
        }`
      : `flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors ${
          checked ? 'border-rose-500/40 bg-rose-950/30' : 'border-white/10 bg-black/20'
        }`;

  return (
    <label className={shell}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-rose-900/60 bg-black text-rose-600 focus:ring-rose-500/40"
      />
      <span className={variant === 'card' ? 'flex flex-col gap-1' : 'flex flex-col gap-0.5'}>
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-rose-50">Uncensored mode</span>
          {checked && <span className="nsfw-badge">18+</span>}
        </span>
        {variant === 'card' && (
          <span className="text-xs leading-relaxed text-zinc-400">
            NSFW Flux LoRA, anti-clothing negative prompt, and automatic nude prompt expansion.
            Stays on the explicit tier — no surprise modesty filters.
          </span>
        )}
        {variant === 'inline' && (
          <span className="text-[11px] text-zinc-500">LoRA + anti-clothing negatives</span>
        )}
      </span>
    </label>
  );
}