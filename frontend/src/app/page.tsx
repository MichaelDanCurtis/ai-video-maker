'use client';

import { useState } from 'react';
import { PhotoCreator } from '@/components/PhotoCreator';
import { PhotoEditor } from '@/components/PhotoEditor';
import { VideoCreator } from '@/components/VideoCreator';
import { PhotoToVideo } from '@/components/PhotoToVideo';
import { VideoEditor } from '@/components/VideoEditor';

type FeatureTab = 'image-creation' | 'video-creation' | 'photo-to-video' | 'photo-editing' | 'video-editing';

interface Feature {
  id: FeatureTab;
  title: string;
  description: string;
  icon: string;
}

const FEATURES: Feature[] = [
  {
    id: 'image-creation',
    title: 'Image Creation',
    description: 'Create stunning images from text descriptions',
    icon: '🖼️',
  },
  {
    id: 'video-creation',
    title: 'Video Creation',
    description: 'Generate videos from text prompts using AI models',
    icon: '🎬',
  },
  {
    id: 'photo-to-video',
    title: 'Photo to Video',
    description: 'Transform static photos into animated videos',
    icon: '✨',
  },
  {
    id: 'photo-editing',
    title: 'Photo Editing',
    description: 'Apply AI-powered edits to your photos',
    icon: '🎨',
  },
  {
    id: 'video-editing',
    title: 'Video Editing',
    description: 'Edit videos with AI assistance',
    icon: '🎥',
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<FeatureTab>('image-creation');

  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'image-creation':
        return <PhotoCreator />;
      case 'video-creation':
        return <VideoCreator />;
      case 'photo-to-video':
        return <PhotoToVideo />;
      case 'photo-editing':
        return <PhotoEditor />;
      case 'video-editing':
        return <VideoEditor />;
      default:
        return <PhotoCreator />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            AI Video Maker
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Create stunning videos and images with the power of AI
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Feature Tabs */}
        <nav className="mb-8" aria-label="Feature navigation">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {FEATURES.map((feature) => (
              <FeatureCard
                key={feature.id}
                title={feature.title}
                description={feature.description}
                icon={feature.icon}
                isActive={activeTab === feature.id}
                onClick={() => setActiveTab(feature.id)}
              />
            ))}
          </div>
        </nav>

        {/* Active Feature Content */}
        <section className="mb-12" aria-label={`${FEATURES.find(f => f.id === activeTab)?.title} feature`}>
          {renderActiveComponent()}
        </section>

        {/* Footer note */}
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            More features coming soon. Stay tuned for updates!
          </p>
        </div>
      </main>
    </div>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
  isActive?: boolean;
  onClick?: () => void;
}

function FeatureCard({ title, description, icon, isActive = false, onClick }: FeatureCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full text-left rounded-xl border p-4 shadow-sm hover:shadow-md transition-all cursor-pointer
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900
        ${isActive
          ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
        }
      `}
      aria-pressed={isActive}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className={`text-sm font-semibold mb-1 ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
        {title}
      </h3>
      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
        {description}
      </p>
    </button>
  );
}
