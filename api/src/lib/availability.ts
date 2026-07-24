import { ApiError } from '../types/errors.js';
import type { LocalAvailabilityWindow } from '../types/dto.js';
import type { UtcAvailabilityWindow } from '../types/domain.js';

export const MINUTES_PER_DAY = 1440;
export const MINUTES_PER_WEEK = 10080;
export const MIN_UTC_OFFSET_MINUTES = -720;
export const MAX_UTC_OFFSET_MINUTES = 840;

export function normalizeWeekMinute(value: number): number {
  return ((value % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
}

export function assertValidUtcOffset(utcOffsetMinutes: unknown): asserts utcOffsetMinutes is number {
  if (
    typeof utcOffsetMinutes !== 'number' ||
    !Number.isInteger(utcOffsetMinutes) ||
    utcOffsetMinutes < MIN_UTC_OFFSET_MINUTES ||
    utcOffsetMinutes > MAX_UTC_OFFSET_MINUTES
  ) {
    throw new ApiError(
      'BAD_REQUEST',
      `utcOffsetMinutes must be an integer between ${MIN_UTC_OFFSET_MINUTES} and ${MAX_UTC_OFFSET_MINUTES}`
    );
  }
}

export function assertValidLocalWindows(
  windows: unknown
): asserts windows is LocalAvailabilityWindow[] {
  if (!Array.isArray(windows)) {
    throw new ApiError('BAD_REQUEST', 'windows must be an array');
  }

  for (let i = 0; i < windows.length; i++) {
    const window = windows[i];
    if (window === null || typeof window !== 'object') {
      throw new ApiError('BAD_REQUEST', `windows[${i}] must be an object`);
    }

    const { dayOfWeek, startMinute, endMinute } = window as Record<string, unknown>;

    if (typeof dayOfWeek !== 'number' || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      throw new ApiError('BAD_REQUEST', `windows[${i}].dayOfWeek must be an integer between 0 and 6`);
    }
    if (
      typeof startMinute !== 'number' ||
      !Number.isInteger(startMinute) ||
      startMinute < 0 ||
      startMinute > 1439
    ) {
      throw new ApiError('BAD_REQUEST', `windows[${i}].startMinute must be an integer between 0 and 1439`);
    }
    if (
      typeof endMinute !== 'number' ||
      !Number.isInteger(endMinute) ||
      endMinute < 1 ||
      endMinute > 1440
    ) {
      throw new ApiError('BAD_REQUEST', `windows[${i}].endMinute must be an integer between 1 and 1440`);
    }
    if (startMinute >= endMinute) {
      throw new ApiError('BAD_REQUEST', `windows[${i}].startMinute must be less than endMinute`);
    }
  }
}

/**
 * Merge overlapping or adjacent windows within each local day.
 * Input must already be validated same-day windows.
 */
export function mergeLocalWindows(
  windows: LocalAvailabilityWindow[]
): LocalAvailabilityWindow[] {
  const byDay = new Map<number, LocalAvailabilityWindow[]>();

  for (const window of windows) {
    const list = byDay.get(window.dayOfWeek) ?? [];
    list.push(window);
    byDay.set(window.dayOfWeek, list);
  }

  const merged: LocalAvailabilityWindow[] = [];

  for (const [, dayWindows] of [...byDay.entries()].sort(([a], [b]) => a - b)) {
    const sorted = [...dayWindows].sort((a, b) => a.startMinute - b.startMinute);
    let current = { ...sorted[0]! };

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i]!;
      // Adjacent (end === start) merges because intervals are half-open.
      if (next.startMinute <= current.endMinute) {
        current.endMinute = Math.max(current.endMinute, next.endMinute);
      } else {
        merged.push(current);
        current = { ...next };
      }
    }

    merged.push(current);
  }

  return merged;
}

export function localWindowToUtc(
  window: LocalAvailabilityWindow,
  utcOffsetMinutes: number
): UtcAvailabilityWindow {
  const localStart = window.dayOfWeek * MINUTES_PER_DAY + window.startMinute;
  return {
    startMinuteUtc: normalizeWeekMinute(localStart - utcOffsetMinutes),
    durationMinutes: window.endMinute - window.startMinute,
  };
}

/** Validate → merge same-day overlaps → convert each window to circular UTC. */
export function localWindowsToUtc(
  windows: LocalAvailabilityWindow[],
  utcOffsetMinutes: number
): UtcAvailabilityWindow[] {
  return mergeLocalWindows(windows).map((window) => localWindowToUtc(window, utcOffsetMinutes));
}
