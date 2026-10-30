import React from 'react';
import { Link } from 'react-router-dom';
import type { Habit } from '../api/habits';

export interface HabitCardProps {
  habit: Habit;
  variant: 'list' | 'dashboard';
  // List variant props
  onEdit?: (habit: Habit) => void;
  onArchive?: (habit: Habit) => void;
  onUnarchive?: (habit: Habit) => void;
  onDelete?: (habit: Habit) => void;
  // Dashboard variant props
  isCompleted?: boolean;
  onToggle?: (habit: Habit) => void;
  isToggling?: boolean;
}

export const HabitCard: React.FC<HabitCardProps> = ({
  habit,
  variant,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
  isCompleted = false,
  onToggle,
  isToggling = false,
}) => {
  const isArchived = Boolean(habit.archivedAt);

  if (variant === 'dashboard') {
    return (
      <div className="border-b border-border py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3.5 min-w-0">
          <button
            type="button"
            onClick={() => onToggle && !isToggling && onToggle(habit)}
            disabled={isToggling}
            className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 ${
              isCompleted
                ? 'bg-accent border border-accent text-background'
                : 'border border-border hover:border-text-muted'
            }`}
            aria-label={isCompleted ? `Mark ${habit.name} incomplete` : `Mark ${habit.name} complete`}
          >
            {isCompleted && (
              <svg
                className="w-3 h-3 stroke-current"
                viewBox="0 0 12 12"
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2.5 6.5L4.5 8.5L9.5 3.5" />
              </svg>
            )}
          </button>
          <Link
            to={`/habits/${habit._id}`}
            className="text-sm font-medium text-text-primary hover:underline truncate"
          >
            {habit.name}
          </Link>
        </div>
        <span className="text-xs text-text-muted shrink-0 ml-4">Daily</span>
      </div>
    );
  }

  // List variant
  return (
    <div className="border-b border-border py-4 flex items-center justify-between">
      <div className="min-w-0 pr-4">
        <div className="flex items-center space-x-2">
          <Link
            to={`/habits/${habit._id}`}
            className="text-sm font-medium text-text-primary hover:underline truncate"
          >
            {habit.name}
          </Link>
          {isArchived && (
            <span className="text-[10px] uppercase tracking-wider text-text-muted border border-border px-1.5 py-0.5 rounded">
              Archived
            </span>
          )}
        </div>
        {habit.description && (
          <p className="text-xs text-text-muted mt-1 line-clamp-1">
            {habit.description}
          </p>
        )}
        <p className="text-xs text-text-muted mt-1 tabular-nums">
          Started {habit.startDate}
        </p>
      </div>

      <div className="flex items-center space-x-2 shrink-0">
        <button
          type="button"
          onClick={() => onEdit && onEdit(habit)}
          className="text-xs text-text-muted hover:text-text-primary px-2 py-1 transition-colors cursor-pointer"
        >
          Edit
        </button>

        {isArchived ? (
          <button
            type="button"
            onClick={() => onUnarchive && onUnarchive(habit)}
            className="text-xs text-text-muted hover:text-text-primary px-2 py-1 transition-colors cursor-pointer"
          >
            Unarchive
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onArchive && onArchive(habit)}
            className="text-xs text-text-muted hover:text-text-primary px-2 py-1 transition-colors cursor-pointer"
          >
            Archive
          </button>
        )}

        <button
          type="button"
          onClick={() => onDelete && onDelete(habit)}
          className="text-xs text-danger hover:opacity-80 px-2 py-1 transition-opacity cursor-pointer"
        >
          Delete
        </button>
      </div>
    </div>
  );
};
