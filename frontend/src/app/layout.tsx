import type { Metadata } from 'next';
import { DM_Sans, Syne } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
});

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'After Dark — Uncensored AI Studio',
  description:
    'Local NSFW image and video generation on Apple Silicon. Flux LoRAs, explicit keyframes, cinematic motion — all on your Mac.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${dmSans.variable} ${syne.variable} font-sans bg-[#060508] text-zinc-100 antialiased`}
        style={{ fontFamily: 'var(--font-dm-sans), system-ui, sans-serif' }}
      >
        {children}
      </body>
    </html>
  );
}