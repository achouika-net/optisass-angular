/**
 * Normalizes a date to UTC Noon (12:00:00.000).
 * This ensures that when a date is saved in UTC, it remains in the same calendar day 
 * even if the local timezone is UTC+/-1, preventing month-shifting in dashboards.
 */
export function normalizeToUTCNoon(date: Date | string | undefined | null): Date | null {
    if (!date) return null;
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;

    // Set to 12:00:00 UTC
    return new Date(Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        12, 0, 0, 0
    ));
}
