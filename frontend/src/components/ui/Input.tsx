'use client';

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';

interface BaseInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>, BaseInputProps {
  size?: 'sm' | 'md' | 'lg';
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, BaseInputProps {
  rows?: number;
  variant?: 'default' | 'studio';
}

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-4 py-3 text-lg',
};

const baseInputStyles = `
  block rounded-lg border transition-colors
  bg-white dark:bg-gray-900
  text-gray-900 dark:text-white
  placeholder-gray-400 dark:placeholder-gray-500
  focus:outline-none focus:ring-2 focus:ring-offset-0
`;

const normalBorderStyles = `
  border-gray-300 dark:border-gray-600
  focus:border-blue-500 focus:ring-blue-500
`;

const errorBorderStyles = `
  border-red-500 dark:border-red-500
  focus:border-red-500 focus:ring-red-500
`;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = false,
      size = 'md',
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            ${baseInputStyles}
            ${error ? errorBorderStyles : normalBorderStyles}
            ${sizeStyles[size]}
            ${fullWidth ? 'w-full' : ''}
            ${props.disabled ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}
            ${className}
          `.trim()}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-sm text-red-500">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = false,
      rows = 4,
      variant = 'default',
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const isStudio = variant === 'studio';

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label
            htmlFor={inputId}
            className={
              isStudio
                ? 'studio-label mb-1.5'
                : 'block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1'
            }
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          className={`
            ${isStudio ? 'studio-input resize-none text-base' : `${baseInputStyles} ${error ? errorBorderStyles : normalBorderStyles} px-4 py-2 text-base resize-none`}
            ${fullWidth ? 'w-full' : ''}
            ${!isStudio && props.disabled ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}
            ${isStudio && props.disabled ? 'cursor-not-allowed opacity-50' : ''}
            ${className}
          `.trim()}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-sm text-red-500">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p
            id={`${inputId}-helper`}
            className={`mt-1.5 text-xs ${isStudio ? 'text-zinc-500' : 'text-sm text-gray-500 dark:text-gray-400'}`}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
TextArea.displayName = 'TextArea';

export default Input;
