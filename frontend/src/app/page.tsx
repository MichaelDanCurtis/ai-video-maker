import { PhotoCreator } from '@/components/PhotoCreator';
import { PhotoEditor } from '@/components/PhotoEditor';

export default function Home() {
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
        {/* Feature Overview */}
        <div className="mb-12">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <FeatureCard
              title="Image Creation"
              description="Create stunning images from text descriptions"
              icon="🖼️"
              isActive
            />
            <FeatureCard
              title="Video Creation"
              description="Generate videos from text prompts using AI models"
              icon="🎬"
            />
            <FeatureCard
              title="Photo to Video"
              description="Transform static photos into animated videos"
              icon="✨"
            />
            <FeatureCard
              title="Photo Editing"
              description="Apply AI-powered edits to your photos"
              icon="🎨"
            />
            <FeatureCard
              title="Video Editing"
              description="Edit videos with AI assistance"
              icon="🎥"
            />
          </div>
        </div>

        {/* Photo Creator Section */}
        <section className="mb-12">
          <PhotoCreator />
        </section>

        {/* Photo Editor Section */}
        <section className="mb-12">
          <PhotoEditor />
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
}

function FeatureCard({ title, description, icon, isActive = false }: FeatureCardProps) {
  return (
    <div
      className={`
        rounded-xl border p-4 shadow-sm hover:shadow-md transition-all cursor-pointer
        ${isActive
          ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
        }
      `}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className={`text-sm font-semibold mb-1 ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
        {title}
      </h3>
      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
        {description}
      </p>
    </div>
  );
}
