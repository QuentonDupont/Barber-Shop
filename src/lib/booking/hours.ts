/**
 * The `DayHours` shape and its default week.
 *
 * Deliberately not in `components/business/hours-editor.tsx`, even though
 * that's the only place that renders it: that file is `"use client"`, and a
 * Server Component importing a plain value (not a component) from a client
 * module gets an RSC client-reference placeholder instead of the real value
 * at runtime — `DEFAULT_WEEK.map` would fail with "is not a function" the
 * moment a server page tried to use it. Plain data with no client-only
 * dependency belongs in a plain module both sides can import directly.
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
