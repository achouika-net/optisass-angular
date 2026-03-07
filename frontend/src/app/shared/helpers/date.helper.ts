import {
  format as formatDate,
  intervalToDuration,
  parse,
  setHours,
  setMinutes,
} from 'date-fns';
import { RemainingTime } from '@app/models';

export const getTimeDate = (hour: number, minutes = 0): Date => {
  return setHours(setMinutes(new Date(), minutes), hour);
};

export const formaterDate = (
  date: string | Date,
  formatStr = 'yyyy-MM-dd'
): string => {
  if (!date) return null;

  const parsedDate =
    typeof date === 'string' ? parse(date, formatStr, new Date()) : date;

  return formatDate(parsedDate, formatStr);
};

export const displayDateFormatter = (date: string | Date): string => {
  const formatStr = 'dd/MM/yyyy';
  const parsedDate =
    typeof date === 'string' ? parse(date, formatStr, new Date()) : date;

  return formatDate(parsedDate, formatStr);
};

/**
 * Calculates the duration between two dates and returns it as a formatted string.
 *
 * @param start - The start date.
 * @param end - The end date.
 * @returns The formatted duration string representing the time difference between start and end.
 *
 * @remarks
 * This function computes the difference in milliseconds between the two dates
 * and formats it using the `displayRemainingTime` helper.
 */
export const getDuration = (start: Date, end: Date): string => {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return displayRemainingTime(diff);
};

/**
 * Formatte une durée en jours, heures, minutes et secondes à partir d'un horodatage donné.
 * @param {number} date
 * @returns {RemainingTime }
 */
export const formatDuration = (date: number): RemainingTime | null => {
  if (date < 0) return null;
  const days = Math.floor(date / (1000 * 60 * 60 * 24));
  const hours = Math.floor((date % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((date % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((date % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds };
};

/**
 * Calculates and displays the remaining time in a formatted string.
 * @param {number} date
 * @returns {string}
 */
export const displayRemainingTime = (date: number): string => {
  if (!date) return;
  const remainingTime = formatDuration(date);
  if (!remainingTime) return;
  const days = remainingTime.days ? `${remainingTime.days}j` : '';
  const hours = remainingTime.hours ? `${remainingTime.hours}h` : '';
  const minutes = remainingTime.minutes ? `${remainingTime.minutes}min` : '';
  const seconds = remainingTime.seconds ? `${remainingTime.seconds}s` : '';
  return `${days} ${hours} ${minutes} ${seconds}`;
};

/**
 * Calculates duration in HH:mm format between start and end dates
 *
 * @param startDate - Start date string or Date object
 * @param endDate - End date string or Date object
 * @returns Duration string in format 'HH:mm' (e.g., '04:30' for 4 hours 30 minutes)
 *
 * @remarks
 * This function is specifically designed for FullCalendar's duration property:
 * - Uses date-fns intervalToDuration for accurate calculation
 * - Works across day boundaries (handles multi-day durations)
 * - Result is zero-padded to ensure proper HH:mm format
 * - Used primarily for recurring events where duration is needed instead of end time
 * - Handles both string and Date object inputs
 *
 * @example
 * ```typescript
 * // 2 hours duration
 * calculateDuration('2024-11-18 09:00:00', '2024-11-18 11:00:00');
 * // Returns: '02:00'
 *
 * // 4 hours 30 minutes duration
 * calculateDuration('2024-11-18 09:00:00', '2024-11-18 13:30:00');
 * // Returns: '04:30'
 *
 * // Cross-day duration
 * calculateDuration('2024-11-18 22:00:00', '2024-11-19 02:30:00');
 * // Returns: '04:30'
 * ```
 */
export const calculateDuration = (
  startDate: string | Date,
  endDate: string | Date
): string => {
  // Calculate duration using date-fns intervalToDuration
  const duration = intervalToDuration({
    start: new Date(startDate),
    end: new Date(endDate),
  });

  // Extract and zero-pad hours and minutes
  const hours = duration.hours?.toString().padStart(2, '0') || '00';
  const minutes = duration.minutes?.toString().padStart(2, '0') || '00';

  // Return zero-padded format (e.g., '04:30')
  return `${hours}:${minutes}`;
};
