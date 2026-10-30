import React from 'react';

export interface EmptyStateProps {
  message: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message,
  description,
  action,
}) => {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-text-muted font-medium">{message}</p>
      {description && (
        <p className="mt-1 text-xs text-text-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
