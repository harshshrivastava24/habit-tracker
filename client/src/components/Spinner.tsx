import React from 'react';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3',
  }[size];

  return (
    <div className={`flex items-center justify-center p-4 ${className}`} role="status" aria-label="Loading">
      <div
        className={`${sizeClasses} rounded-full border-border border-t-accent animate-spin`}
      />
    </div>
  );
};
