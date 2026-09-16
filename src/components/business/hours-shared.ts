/**
 * Shared shape + default for the weekly-hours editor.
 *
 * Deliberately NOT a `"use client"` module: Server Components (the Hours and
 * Onboarding pages) import `DEFAULT_WEEK` as an actual value. Exported from the
 * client `hours-editor.tsx` instead, that import would arrive on the server as a
 * client-reference stub rather than the array, and `DEFAULT_WEEK.map` would
 * throw "is not a function".
 */

export interface DayHours {
  weekday: number;
  isClosed: boolean;
  open: string;
  close: string;
  breakEnabled: boolean;
  breakStart: string;
  breakEnd: string;
}

export const DEFAULT_WEEK: DayHours[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  isClosed: weekday === 0,
  open: "09:00",
  close: "18:00",
  breakEnabled: false,
  breakStart: "12:00",
  breakEnd: "13:00",
}));
