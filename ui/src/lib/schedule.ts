import type { AvailabilityWindow, LocalAvailabilityWindow } from '../types';

export const MINUTES_PER_DAY = 1440;
export const MINUTES_PER_WEEK = 10080;

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Common fixed offsets in the API-allowed range (−720 … +840). */
export const UTC_OFFSET_OPTIONS: { label: string; value: number }[] = [
  { label: 'UTC−12', value: -720 },
  { label: 'UTC−11', value: -660 },
  { label: 'UTC−10', value: -600 },
  { label: 'UTC−9:30', value: -570 },
  { label: 'UTC−9', value: -540 },
  { label: 'UTC−8', value: -480 },
  { label: 'UTC−7', value: -420 },
  { label: 'UTC−6', value: -360 },
  { label: 'UTC−5', value: -300 },
  { label: 'UTC−4', value: -240 },
  { label: 'UTC−3:30', value: -210 },
  { label: 'UTC−3', value: -180 },
  { label: 'UTC−2', value: -120 },
  { label: 'UTC−1', value: -60 },
  { label: 'UTC+0', value: 0 },
  { label: 'UTC+1', value: 60 },
  { label: 'UTC+2', value: 120 },
  { label: 'UTC+3', value: 180 },
  { label: 'UTC+3:30', value: 210 },
  { label: 'UTC+4', value: 240 },
  { label: 'UTC+4:30', value: 270 },
  { label: 'UTC+5', value: 300 },
  { label: 'UTC+5:30', value: 330 },
  { label: 'UTC+5:45', value: 345 },
  { label: 'UTC+6', value: 360 },
  { label: 'UTC+6:30', value: 390 },
  { label: 'UTC+7', value: 420 },
  { label: 'UTC+8', value: 480 },
  { label: 'UTC+8:45', value: 525 },
  { label: 'UTC+9', value: 540 },
  { label: 'UTC+9:30', value: 570 },
  { label: 'UTC+10', value: 600 },
  { label: 'UTC+10:30', value: 630 },
  { label: 'UTC+11', value: 660 },
  { label: 'UTC+12', value: 720 },
  { label: 'UTC+12:45', value: 765 },
  { label: 'UTC+13', value: 780 },
  { label: 'UTC+14', value: 840 },
];

/** 30-minute options for start (0..1430) and end (30..1440). */
export const START_TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => i * 30);
export const END_TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => (i + 1) * 30);

export function normalizeWeekMinute(value: number): number {
  return ((value % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
}

export function formatMinuteOfDay(minutes: number): string {
  if (minutes === 1440) return '24:00';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/** Parse an HH:MM wall-clock value. Only end times may use the 24:00 boundary. */
export function parseTimeOfDay(value: string, allowEndOfDay = false): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) return null;
  if (hours === 24) return allowEndOfDay && minutes === 0 ? MINUTES_PER_DAY : null;
  if (hours > 23) return null;

  return hours * 60 + minutes;
}

export function utcWindowToLocal(
  window: AvailabilityWindow,
  utcOffsetMinutes: number,
): LocalAvailabilityWindow {
  const localStart = normalizeWeekMinute(window.startMinuteUtc + utcOffsetMinutes);
  const startMinute = localStart % MINUTES_PER_DAY;
  return {
    dayOfWeek: Math.floor(localStart / MINUTES_PER_DAY),
    startMinute,
    endMinute: startMinute + window.durationMinutes,
  };
}

export function utcWindowsToLocal(
  windows: AvailabilityWindow[],
  utcOffsetMinutes: number,
): LocalAvailabilityWindow[] {
  return windows
    .map((w) => utcWindowToLocal(w, utcOffsetMinutes))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute);
}

export interface EditableWindow extends LocalAvailabilityWindow {
  key: string;
}

let keyCounter = 0;

export function createEditableWindow(
  dayOfWeek: number,
  startMinute = 540,
  endMinute = 1020,
): EditableWindow {
  keyCounter += 1;
  return { key: `w-${keyCounter}`, dayOfWeek, startMinute, endMinute };
}

export function toEditableWindows(
  windows: AvailabilityWindow[],
  utcOffsetMinutes: number,
): EditableWindow[] {
  return utcWindowsToLocal(windows, utcOffsetMinutes).map((w) =>
    createEditableWindow(w.dayOfWeek, w.startMinute, w.endMinute),
  );
}

export function validateEditableWindows(windows: EditableWindow[]): string | null {
  for (const w of windows) {
    if (w.startMinute >= w.endMinute) {
      return `${DAY_NAMES[w.dayOfWeek]}: start must be before end`;
    }
    if (w.startMinute < 0 || w.startMinute > 1439) {
      return `${DAY_NAMES[w.dayOfWeek]}: invalid start time`;
    }
    if (w.endMinute < 1 || w.endMinute > 1440) {
      return `${DAY_NAMES[w.dayOfWeek]}: invalid end time`;
    }
  }
  return null;
}
