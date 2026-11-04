'use client';

import { useEffect, useState } from 'react';
import { ProjectProvider } from '@/hooks/useProject';
import { checkHealth } from '@/lib/api';
import { CreatePanel } from './CreatePanel';
import { ClipTimeline } from './ClipTimeline';

export function StudioApp() {
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    checkHealth()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));
  }, []);

  return (
    <ProjectProvider>
      <div className="relative z-10 flex min-h-screen flex-col text-white">
        <header className="sticky top-0 z-30 border-b border-rose-500/15 bg-[#060508]/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-4">
              <div
                className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-gradient-to-br from-rose-950 to-black sm:flex velvet-glow-ring"
                aria-hidden
              >
                <span className="font-display text-lg font-bold text-rose-300">◆</span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1
                    className="font-display text-xl font-bold tracking-tight sm:text-2xl"
                    style={{ fontFamily: 'var(--font-syne), system-ui, sans-serif' }}
                  >
                    <span className="bg-gradient-to-r from-rose-300 via-rose-400 to-fuchsia-400 bg-clip-text text-transparent">
                      After Dark
                    </span>
                  </h1>
                  <span className="nsfw-badge">Uncensored · Local MLX</span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">
                  Explicit stills · NSFW keyframes · motion clips · private on your Mac
                </p>
              </div>
            </div>
            <StatusPill
              label="Engine"
              ok={apiOnline}
              okText="Ready to render"
              failText="Offline — start backend :8000"
            />
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
          <div className="grid min-h-[420px] flex-1 grid-cols-1 gap-4 xl:grid-cols-[400px_minmax(0,1fr)]">
            <section aria-label="Create and chain clips" className="min-h-[480px] xl:min-h-0">
              <CreatePanel />
            </section>
            <section aria-label="Program monitor and timeline" className="min-h-[520px] xl:min-h-0">
              <ClipTimeline />
            </section>
          </div>
        </main>

        <footer className="border-t border-rose-500/10 py-3 text-center text-[11px] text-zinc-600">
          Everything runs locally. Eight NSFW Flux LoRAs · no cloud moderation · clips stay in your browser until export.
        </footer>
      </div>
    </ProjectProvider>
  );
}

function StatusPill({
  label,
  ok,
  okText,
  failText,
}: {
  label: string;
  ok: boolean | null;
  okText: string;
  failText: string;
}) {
  const color =
    ok === null
      ? 'border-zinc-700 bg-zinc-900/80 text-zinc-400'
      : ok
        ? 'border-rose-500/30 bg-rose-950/40 text-rose-300'
        : 'border-red-900/50 bg-red-950/50 text-red-400';

  return (
    <div className={`rounded-full border px-3 py-1.5 text-xs font-medium ${color}`}>
      <span className="opacity-60">{label}:</span>{' '}
      {ok === null ? '…' : ok ? okText : failText}
    </div>
  );
}