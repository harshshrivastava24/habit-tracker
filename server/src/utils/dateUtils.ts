/**
 * Validates that a string is in YYYY-MM-DD format and corresponds to a real calendar date.
 * Rejects invalid dates such as 2026-02-30 or non-leap-year 2026-02-29.
 */
export const isValidDateString = (dateStr: string): boolean => {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

/**
 * Returns UTC today formatted as YYYY-MM-DD.
 */
export const getTodayUTC = (): string => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Adds (or subtracts) days to a YYYY-MM-DD date string in UTC and returns YYYY-MM-DD.
 */
export const addDaysToDate = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Returns the maximum allowed completion date (UTC today + 1 day) formatted as YYYY-MM-DD.
 */
export const getMaxAllowedCompletionDate = (): string => {
  return addDaysToDate(getTodayUTC(), 1);
};

/**
 * Returns the difference in calendar days between two YYYY-MM-DD strings (to - from).
 */
export const getDaysDifference = (from: string, to: string): number => {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
};

/**
 * Returns the ISO week range (Monday to Sunday) containing the given date string.
 */
export const getISOWeekRange = (dateStr: string): { from: string; to: string } => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = dt.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = addDaysToDate(dateStr, diffToMonday);
  const sunday = addDaysToDate(monday, 6);
  return { from: monday, to: sunday };
};
