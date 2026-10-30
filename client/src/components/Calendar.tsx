import React from 'react';
import { getLocalDateString } from '../utils/date';

export interface CalendarProps {
  currentMonth: Date;
  onMonthChange: (newMonth: Date) => void;
  habitStartDate: string;
  isArchived: boolean;
  completedDates: Set<string>;
  onToggleDate: (dateStr: string) => void;
  isToggling?: boolean;
}

export const Calendar: React.FC<CalendarProps> = ({
  currentMonth,
  onMonthChange,
  habitStartDate,
  isArchived,
  completedDates,
  onToggleDate,
  isToggling = false,
}) => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth(); // 0-indexed

  const todayStr = getLocalDateString();

  // Days of week: Mon - Sun
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Day of week of the 1st (0 = Sun, 1 = Mon, ..., 6 = Sat)
  // Convert so Mon = 0, ..., Sun = 6
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;

  const handlePrevMonth = () => {
    onMonthChange(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(new Date(year, month + 1, 1));
  };

  // Generate date strings for all days in this month
  const monthDates: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    monthDates.push(dStr);
  }

  // Calculate X of Y completed
  const completedThisMonth = monthDates.filter((d) => completedDates.has(d)).length;
  const eligibleThisMonth = monthDates.filter(
    (d) => d >= habitStartDate && d <= todayStr
  ).length;

  const monthLabel = currentMonth.toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="w-full max-w-md">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-text-primary">{monthLabel}</h3>
        <div className="flex space-x-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 text-xs text-text-muted hover:text-text-primary border border-border rounded-md transition-colors cursor-pointer"
            aria-label="Previous month"
          >
            ←
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 text-xs text-text-muted hover:text-text-primary border border-border rounded-md transition-colors cursor-pointer"
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </div>

      {/* Days of Week Header */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {weekDays.map((wd) => (
          <div
            key={wd}
            className="text-[11px] font-medium text-text-muted py-1"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Grid of Days */}
      <div className="grid grid-cols-7 gap-1">
        {/* Leading blanks */}
        {Array.from({ length: firstDayOfWeek }).map((_, index) => (
          <div key={`blank-${index}`} className="h-10" />
        ))}

        {/* Days */}
        {monthDates.map((dateStr, idx) => {
          const dayNum = idx + 1;
          const isCompleted = completedDates.has(dateStr);
          const isToday = dateStr === todayStr;
          const isBeforeStart = dateStr < habitStartDate;
          const isFuture = dateStr > todayStr;
          const isDisabled = isBeforeStart || isFuture || isArchived;

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isDisabled || isToggling}
              onClick={() => {
                if (!isDisabled && !isToggling) {
                  onToggleDate(dateStr);
                }
              }}
              className={`h-10 text-xs rounded-md relative flex flex-col items-center justify-center tabular-nums transition-colors ${
                isDisabled
                  ? 'text-text-muted/40 cursor-not-allowed'
                  : 'cursor-pointer hover:border-text-muted'
              } ${
                isCompleted
                  ? 'bg-accent-subtle text-accent font-semibold'
                  : 'text-text-primary bg-surface/40'
              } ${
                isToday ? 'outline outline-1 outline-text-primary' : ''
              }`}
              title={
                isBeforeStart
                  ? 'Before habit start date'
                  : isFuture
                  ? 'Future date'
                  : isArchived
                  ? 'Habit is archived (read-only)'
                  : dateStr
              }
            >
              <span>{dayNum}</span>
              {isCompleted && (
                <span className="text-[10px] leading-none mt-0.5 text-accent">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Completion summary below calendar */}
      <div className="mt-4 pt-3 border-t border-border text-xs text-text-muted tabular-nums">
        {completedThisMonth} of {eligibleThisMonth} days completed this month
      </div>
    </div>
  );
};
