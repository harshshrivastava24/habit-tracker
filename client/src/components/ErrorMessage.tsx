import React from 'react';

export interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry }) => {
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-text-primary mb-3">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs bg-surface border border-border text-text-primary px-3 py-1.5 rounded-md hover:border-text-primary transition-colors cursor-pointer"
        >
          Retry
        </button>
      )}
    </div>
  );
};
