/**
 * Recurring event scope type
 * Represents the scope of a recurring event operation (edit or delete)
 * - 'unique': Non-recurring event (single occurrence)
 * - 'series': Apply to entire recurring series
 * - 'single': Apply to single occurrence only of a recurring event
 * - 'following': Apply to this and all following occurrences
 * - 'cancel': User cancelled the operation
 */
export type RecurringEventScope =
  | 'unique'
  | 'series'
  | 'single'
  | 'following'
  | 'cancel';
