'use client';

import { HTMLAttributes } from 'react';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface LoadingSpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize;
  color?: string;
  label?: string;
  fullScreen?: boolean;
}

const sizeStyles: Record<SpinnerSize, string> = {
  xs: 'h-4 w-4',
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

const strokeWidths: Record<SpinnerSize, number> = {
  xs: 4,
  sm: 4,
  md: 4,
  lg: 3,
  xl: 3,
};

export function LoadingSpinner({
  size = 'md',
  color = 'currentColor',
  label = 'Loading...',
  fullScreen = false,
  className = '',
  ...props
}: LoadingSpinnerProps) {
  const spinner = (
    <div
      role="status"
      aria-label={label}
      className={`inline-flex flex-col items-center justify-center ${className}`}
      {...props}
    >
      <svg
        className={`animate-spin ${sizeStyles[size]} text-blue-600 dark:text-blue-400`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke={color}
          strokeWidth={strokeWidths[size]}
        />
        <path
          className="opacity-75"
          fill={color}
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
}

interface LoadingOverlayProps {
  isLoading: boolean;
  children: React.ReactNode;
  label?: string;
}

export function LoadingOverlay({
  isLoading,
  children,
  label = 'Loading...',
}: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg">
          <LoadingSpinner label={label} />
        </div>
      )}
    </div>
  );
}

interface LoadingStateProps {
  message?: string;
  size?: SpinnerSize;
}

export function LoadingState({
  message = 'Loading...',
  size = 'lg',
}: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <LoadingSpinner size={size} />
      <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">
        {message}
      </p>
    </div>
  );
}

export default LoadingSpinner;
