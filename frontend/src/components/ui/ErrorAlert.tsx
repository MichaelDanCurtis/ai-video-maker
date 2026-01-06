'use client';

import { HTMLAttributes, forwardRef, useCallback } from 'react';

// =============================================================================
// Error Types and Utilities
// =============================================================================

export type ErrorType =
  | 'error'       // General error (red)
  | 'warning'     // Warning state (yellow)
  | 'network'     // Network/connection error
  | 'auth'        // Authentication/API key error
  | 'rate_limit'  // Rate limit exceeded
  | 'timeout'     // Request timeout
  | 'validation'; // Input validation error

export interface ErrorInfo {
  type: ErrorType;
  title: string;
  message: string;
  suggestion?: string;
  canRetry?: boolean;
}

/**
 * Classify an error message into a specific error type for better UX.
 */
export function classifyError(message: string): ErrorInfo {
  const lowerMessage = message.toLowerCase();

  // Network/Connection errors
  if (
    lowerMessage.includes('unable to connect') ||
    lowerMessage.includes('network') ||
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('connection')
  ) {
    return {
      type: 'network',
      title: 'Connection Error',
      message: message,
      suggestion: 'Please check your internet connection and verify the API server is running.',
      canRetry: true,
    };
  }

  // Authentication errors
  if (
    lowerMessage.includes('authentication') ||
    lowerMessage.includes('api key') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('401')
  ) {
    return {
      type: 'auth',
      title: 'Authentication Error',
      message: message,
      suggestion: 'Please verify your API key is configured correctly in the server settings.',
      canRetry: false,
    };
  }

  // Rate limit errors
  if (
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('too many requests') ||
    lowerMessage.includes('429')
  ) {
    return {
      type: 'rate_limit',
      title: 'Rate Limit Exceeded',
      message: message,
      suggestion: 'Please wait a moment before trying again. Consider reducing request frequency.',
      canRetry: true,
    };
  }

  // Timeout errors
  if (
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('timed out') ||
    lowerMessage.includes('took too long')
  ) {
    return {
      type: 'timeout',
      title: 'Request Timeout',
      message: message,
      suggestion: 'The operation took too long. This may be due to high server load. Please try again.',
      canRetry: true,
    };
  }

  // Validation errors
  if (
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('required') ||
    lowerMessage.includes('must be') ||
    lowerMessage.includes('please enter') ||
    lowerMessage.includes('please upload')
  ) {
    return {
      type: 'validation',
      title: 'Validation Error',
      message: message,
      canRetry: false,
    };
  }

  // Default error
  return {
    type: 'error',
    title: 'Operation Failed',
    message: message,
    suggestion: 'Please try again. If the problem persists, check the server logs for more details.',
    canRetry: true,
  };
}

// =============================================================================
// Icon Components
// =============================================================================

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function NetworkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.05 3.636a1 1 0 010 1.414 7 7 0 000 9.9 1 1 0 11-1.414 1.414 9 9 0 010-12.728 1 1 0 011.414 0zm9.9 0a1 1 0 011.414 0 9 9 0 010 12.728 1 1 0 11-1.414-1.414 7 7 0 000-9.9 1 1 0 010-1.414zM7.879 6.464a1 1 0 010 1.414 3 3 0 000 4.243 1 1 0 11-1.415 1.414 5 5 0 010-7.07 1 1 0 011.415 0zm4.242 0a1 1 0 011.415 0 5 5 0 010 7.072 1 1 0 01-1.415-1.415 3 3 0 000-4.242 1 1 0 010-1.415zM10 9a1 1 0 011 1v.01a1 1 0 11-2 0V10a1 1 0 011-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// =============================================================================
// Styles
// =============================================================================

const variantStyles = {
  error: {
    container: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    icon: 'text-red-500 dark:text-red-400',
    title: 'text-red-800 dark:text-red-200',
    message: 'text-red-700 dark:text-red-300',
    suggestion: 'text-red-600 dark:text-red-400',
    button: 'text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40',
    retryButton: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900/60',
  },
  warning: {
    container: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    icon: 'text-yellow-500 dark:text-yellow-400',
    title: 'text-yellow-800 dark:text-yellow-200',
    message: 'text-yellow-700 dark:text-yellow-300',
    suggestion: 'text-yellow-600 dark:text-yellow-400',
    button: 'text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/40',
    retryButton: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-900/60',
  },
  network: {
    container: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    icon: 'text-orange-500 dark:text-orange-400',
    title: 'text-orange-800 dark:text-orange-200',
    message: 'text-orange-700 dark:text-orange-300',
    suggestion: 'text-orange-600 dark:text-orange-400',
    button: 'text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40',
    retryButton: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 hover:bg-orange-200 dark:hover:bg-orange-900/60',
  },
  auth: {
    container: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    icon: 'text-purple-500 dark:text-purple-400',
    title: 'text-purple-800 dark:text-purple-200',
    message: 'text-purple-700 dark:text-purple-300',
    suggestion: 'text-purple-600 dark:text-purple-400',
    button: 'text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40',
    retryButton: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-900/60',
  },
  rate_limit: {
    container: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    icon: 'text-amber-500 dark:text-amber-400',
    title: 'text-amber-800 dark:text-amber-200',
    message: 'text-amber-700 dark:text-amber-300',
    suggestion: 'text-amber-600 dark:text-amber-400',
    button: 'text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40',
    retryButton: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/60',
  },
  timeout: {
    container: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    icon: 'text-blue-500 dark:text-blue-400',
    title: 'text-blue-800 dark:text-blue-200',
    message: 'text-blue-700 dark:text-blue-300',
    suggestion: 'text-blue-600 dark:text-blue-400',
    button: 'text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40',
    retryButton: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900/60',
  },
  validation: {
    container: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    icon: 'text-red-500 dark:text-red-400',
    title: 'text-red-800 dark:text-red-200',
    message: 'text-red-700 dark:text-red-300',
    suggestion: 'text-red-600 dark:text-red-400',
    button: 'text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40',
    retryButton: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900/60',
  },
};

// =============================================================================
// ErrorAlert Component
// =============================================================================

export interface ErrorAlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** The error message to display */
  message: string;
  /** Optional custom title (defaults to auto-detected based on error type) */
  title?: string;
  /** Force a specific error type instead of auto-detecting */
  type?: ErrorType;
  /** Show a retry button */
  showRetry?: boolean;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Show a dismiss button */
  showDismiss?: boolean;
  /** Callback when dismiss button is clicked */
  onDismiss?: () => void;
  /** Whether retry is currently in progress */
  isRetrying?: boolean;
}

export const ErrorAlert = forwardRef<HTMLDivElement, ErrorAlertProps>(
  (
    {
      message,
      title,
      type,
      showRetry = true,
      onRetry,
      showDismiss = true,
      onDismiss,
      isRetrying = false,
      className = '',
      ...props
    },
    ref
  ) => {
    // Classify the error for better UX
    const errorInfo = classifyError(message);
    const effectiveType = type || errorInfo.type;
    const effectiveTitle = title || errorInfo.title;
    const styles = variantStyles[effectiveType];

    // Determine if we should show retry based on error classification
    const canRetry = showRetry && errorInfo.canRetry && onRetry;

    const handleDismiss = useCallback(() => {
      if (onDismiss) {
        onDismiss();
      }
    }, [onDismiss]);

    const handleRetry = useCallback(() => {
      if (onRetry && !isRetrying) {
        onRetry();
      }
    }, [onRetry, isRetrying]);

    // Select the appropriate icon based on error type
    const IconComponent = {
      error: ErrorIcon,
      warning: WarningIcon,
      network: NetworkIcon,
      auth: KeyIcon,
      rate_limit: ClockIcon,
      timeout: ClockIcon,
      validation: ErrorIcon,
    }[effectiveType];

    return (
      <div
        ref={ref}
        role="alert"
        aria-live="assertive"
        className={`
          rounded-lg border p-4
          ${styles.container}
          ${className}
        `.trim()}
        {...props}
      >
        <div className="flex">
          <div className="flex-shrink-0">
            <IconComponent className={`h-5 w-5 ${styles.icon}`} />
          </div>
          <div className="ml-3 flex-1">
            <h3 className={`text-sm font-medium ${styles.title}`}>
              {effectiveTitle}
            </h3>
            <p className={`text-sm mt-1 ${styles.message}`}>
              {message}
            </p>
            {errorInfo.suggestion && (
              <p className={`text-sm mt-2 ${styles.suggestion}`}>
                {errorInfo.suggestion}
              </p>
            )}
            {/* Action buttons */}
            {(canRetry || (showDismiss && onDismiss)) && (
              <div className="mt-3 flex gap-2">
                {canRetry && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className={`
                      inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md
                      transition-colors duration-150
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${styles.retryButton}
                    `}
                  >
                    <RefreshIcon className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                    {isRetrying ? 'Retrying...' : 'Try Again'}
                  </button>
                )}
              </div>
            )}
          </div>
          {showDismiss && onDismiss && (
            <div className="ml-auto pl-3">
              <button
                type="button"
                onClick={handleDismiss}
                className={`
                  inline-flex rounded-md p-1.5
                  transition-colors duration-150
                  ${styles.button}
                `}
                aria-label="Dismiss error"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
);
ErrorAlert.displayName = 'ErrorAlert';

// =============================================================================
// WarningAlert Component (for non-error warnings like "Feature Unavailable")
// =============================================================================

export interface WarningAlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** The warning message to display */
  message: string;
  /** Optional custom title */
  title?: string;
  /** Show a dismiss button */
  showDismiss?: boolean;
  /** Callback when dismiss button is clicked */
  onDismiss?: () => void;
}

export const WarningAlert = forwardRef<HTMLDivElement, WarningAlertProps>(
  (
    {
      message,
      title = 'Warning',
      showDismiss = false,
      onDismiss,
      className = '',
      ...props
    },
    ref
  ) => {
    const styles = variantStyles.warning;

    return (
      <div
        ref={ref}
        role="alert"
        className={`
          rounded-lg border p-4
          ${styles.container}
          ${className}
        `.trim()}
        {...props}
      >
        <div className="flex">
          <div className="flex-shrink-0">
            <WarningIcon className={`h-5 w-5 ${styles.icon}`} />
          </div>
          <div className="ml-3 flex-1">
            <h3 className={`text-sm font-medium ${styles.title}`}>
              {title}
            </h3>
            <p className={`text-sm mt-1 ${styles.message}`}>
              {message}
            </p>
          </div>
          {showDismiss && onDismiss && (
            <div className="ml-auto pl-3">
              <button
                type="button"
                onClick={onDismiss}
                className={`
                  inline-flex rounded-md p-1.5
                  transition-colors duration-150
                  ${styles.button}
                `}
                aria-label="Dismiss warning"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
);
WarningAlert.displayName = 'WarningAlert';

export default ErrorAlert;
