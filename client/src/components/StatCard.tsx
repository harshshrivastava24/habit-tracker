import React from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  isFirst?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  isFirst = false,
}) => {
  return (
    <div
      className={`flex-1 py-1 ${
        isFirst ? 'pr-6' : 'px-6 border-l border-border'
      }`}
    >
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <div className="text-2xl font-semibold text-text-primary tabular-nums">
        {value}
      </div>
      {subtext && (
        <div className="text-[11px] text-text-muted mt-1 tabular-nums">
          {subtext}
        </div>
      )}
    </div>
  );
};
