export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full space-y-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
          AI Video Maker
        </h1>
        <p className="text-lg leading-8 text-gray-600 dark:text-gray-300">
          Create stunning videos and images with the power of AI. Transform your ideas into visual content with our intelligent multimedia tools.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-12">
          <FeatureCard
            title="Video Creation"
            description="Generate videos from text prompts using AI models"
            icon="🎬"
          />
          <FeatureCard
            title="Image Creation"
            description="Create stunning images from text descriptions"
            icon="🖼️"
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
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-8">
          Features coming soon. Stay tuned for updates!
        </p>
      </div>
    </div>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
}

function FeatureCard({ title, description, icon }: FeatureCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {description}
      </p>
    </div>
  );
}
