import { describe, expect, it } from 'vitest';
import {
  assertValidLocalWindows,
  assertValidUtcOffset,
  computeNextWindowStart,
  isCurrentlyAvailable,
  localWindowToUtc,
  localWindowsToUtc,
  mergeLocalWindows,
  normalizeWeekMinute,
  utcDateToWeekMinute,
  utcWindowToLocal,
} from '../../src/lib/availability.js';
import { ApiError } from '../../src/types/errors.js';

describe('normalizeWeekMinute', () => {
  it('leaves values already in range unchanged', () => {
    expect(normalizeWeekMinute(0)).toBe(0);
    expect(normalizeWeekMinute(1410)).toBe(1410);
    expect(normalizeWeekMinute(10079)).toBe(10079);
  });

  it('wraps values at or above one week', () => {
    expect(normalizeWeekMinute(10080)).toBe(0);
    expect(normalizeWeekMinute(10080 + 90)).toBe(90);
  });

  it('normalizes negative values with positive modulo', () => {
    expect(normalizeWeekMinute(-1)).toBe(10079);
    expect(normalizeWeekMinute(-60)).toBe(10020);
  });
});

describe('localWindowToUtc', () => {
  it('converts Monday 00:30–02:00 at UTC+1 to a single circular row', () => {
    expect(
      localWindowToUtc({ dayOfWeek: 1, startMinute: 30, endMinute: 120 }, 60)
    ).toEqual({ startMinuteUtc: 1410, durationMinutes: 90 });
  });

  it('handles UTC+14 boundary offset', () => {
    expect(
      localWindowToUtc({ dayOfWeek: 1, startMinute: 0, endMinute: 60 }, 840)
    ).toEqual({ startMinuteUtc: 600, durationMinutes: 60 });
  });

  it('handles UTC-12 boundary offset', () => {
    expect(
      localWindowToUtc({ dayOfWeek: 0, startMinute: 0, endMinute: 60 }, -720)
    ).toEqual({ startMinuteUtc: 720, durationMinutes: 60 });
  });

  it('handles half-hour offsets', () => {
    // Monday 09:00–17:00 IST (+330): localStart=1440+540=1980 → utc=1980-330=1650
    expect(
      localWindowToUtc({ dayOfWeek: 1, startMinute: 540, endMinute: 1020 }, 330)
    ).toEqual({ startMinuteUtc: 1650, durationMinutes: 480 });
  });
});

describe('UTC/local round-trip', () => {
  it.each([
    [{ dayOfWeek: 1, startMinute: 30, endMinute: 120 }, 60],
    [{ dayOfWeek: 0, startMinute: 0, endMinute: 60 }, 840],
    [{ dayOfWeek: 6, startMinute: 1380, endMinute: 1440 }, -720],
    [{ dayOfWeek: 1, startMinute: 540, endMinute: 1020 }, 330],
  ] as const)('restores the original same-day local window', (localWindow, offset) => {
    expect(utcWindowToLocal(localWindowToUtc(localWindow, offset), offset)).toEqual(
      localWindow
    );
  });

  it('rejects a stored UTC window that cannot originate from a same-day local window', () => {
    expect(() =>
      utcWindowToLocal({ startMinuteUtc: 1380, durationMinutes: 120 }, 0)
    ).toThrow('UTC window does not map to a same-day local window');
  });
});

describe('mergeLocalWindows', () => {
  it('merges overlapping windows on the same day', () => {
    expect(
      mergeLocalWindows([
        { dayOfWeek: 1, startMinute: 540, endMinute: 720 },
        { dayOfWeek: 1, startMinute: 700, endMinute: 1020 },
      ])
    ).toEqual([{ dayOfWeek: 1, startMinute: 540, endMinute: 1020 }]);
  });

  it('merges adjacent half-open windows on the same day', () => {
    expect(
      mergeLocalWindows([
        { dayOfWeek: 2, startMinute: 540, endMinute: 720 },
        { dayOfWeek: 2, startMinute: 720, endMinute: 900 },
      ])
    ).toEqual([{ dayOfWeek: 2, startMinute: 540, endMinute: 900 }]);
  });

  it('does not merge windows on different days', () => {
    const windows = [
      { dayOfWeek: 1, startMinute: 540, endMinute: 720 },
      { dayOfWeek: 2, startMinute: 540, endMinute: 720 },
    ];
    expect(mergeLocalWindows(windows)).toEqual(windows);
  });

  it('returns an empty list unchanged', () => {
    expect(mergeLocalWindows([])).toEqual([]);
  });
});

describe('localWindowsToUtc', () => {
  it('merges before converting', () => {
    expect(
      localWindowsToUtc(
        [
          { dayOfWeek: 1, startMinute: 540, endMinute: 720 },
          { dayOfWeek: 1, startMinute: 700, endMinute: 1020 },
        ],
        330
      )
    ).toEqual([{ startMinuteUtc: 1650, durationMinutes: 480 }]);
  });

  it('returns no rows for an empty schedule', () => {
    expect(localWindowsToUtc([], 330)).toEqual([]);
  });
});

describe('assertValidUtcOffset', () => {
  it('accepts boundary offsets', () => {
    expect(() => assertValidUtcOffset(-720)).not.toThrow();
    expect(() => assertValidUtcOffset(840)).not.toThrow();
  });

  it('rejects out-of-range and non-integer offsets', () => {
    expect(() => assertValidUtcOffset(841)).toThrow(ApiError);
    expect(() => assertValidUtcOffset(-721)).toThrow(ApiError);
    expect(() => assertValidUtcOffset(330.5)).toThrow(ApiError);
    expect(() => assertValidUtcOffset('330')).toThrow(ApiError);
  });
});

describe('assertValidLocalWindows', () => {
  it('accepts a valid window and an empty list', () => {
    expect(() => assertValidLocalWindows([])).not.toThrow();
    expect(() =>
      assertValidLocalWindows([{ dayOfWeek: 0, startMinute: 0, endMinute: 1440 }])
    ).not.toThrow();
  });

  it('rejects invalid ranges', () => {
    expect(() =>
      assertValidLocalWindows([{ dayOfWeek: 7, startMinute: 0, endMinute: 60 }])
    ).toThrow(ApiError);
    expect(() =>
      assertValidLocalWindows([{ dayOfWeek: 1, startMinute: 1020, endMinute: 540 }])
    ).toThrow(ApiError);
    expect(() =>
      assertValidLocalWindows([{ dayOfWeek: 1, startMinute: 540, endMinute: 540 }])
    ).toThrow(ApiError);
    expect(() => assertValidLocalWindows('nope')).toThrow(ApiError);
  });
});

describe('utcDateToWeekMinute', () => {
  it('maps Sunday 00:00 UTC to 0', () => {
    expect(utcDateToWeekMinute(new Date('2026-07-19T00:00:00.000Z'))).toBe(0);
  });

  it('maps Monday 00:30 UTC to 1470', () => {
    expect(utcDateToWeekMinute(new Date('2026-07-20T00:30:00.000Z'))).toBe(1470);
  });
});

describe('isCurrentlyAvailable', () => {
  it('returns true inside a normal window and false outside', () => {
    // Monday 09:00–17:00 UTC → start 1980, duration 480
    const windows = [{ startMinuteUtc: 1980, durationMinutes: 480 }];
    expect(isCurrentlyAvailable(windows, new Date('2026-07-20T10:00:00.000Z'))).toBe(true);
    expect(isCurrentlyAvailable(windows, new Date('2026-07-20T08:59:00.000Z'))).toBe(false);
    expect(isCurrentlyAvailable(windows, new Date('2026-07-20T17:00:00.000Z'))).toBe(false);
  });

  it('handles a window that crosses UTC midnight', () => {
    const windows = [{ startMinuteUtc: 1410, durationMinutes: 90 }];
    expect(isCurrentlyAvailable(windows, new Date('2026-07-19T23:45:00.000Z'))).toBe(true);
    expect(isCurrentlyAvailable(windows, new Date('2026-07-20T00:30:00.000Z'))).toBe(true);
    expect(isCurrentlyAvailable(windows, new Date('2026-07-20T01:00:00.000Z'))).toBe(false);
  });

  it('handles a window that crosses the Saturday/Sunday week boundary', () => {
    // Saturday 23:00–Sunday 01:00 UTC
    const windows = [{ startMinuteUtc: 10020, durationMinutes: 120 }];
    expect(isCurrentlyAvailable(windows, new Date('2026-07-25T23:30:00.000Z'))).toBe(true);
    expect(isCurrentlyAvailable(windows, new Date('2026-07-26T00:30:00.000Z'))).toBe(true);
    expect(isCurrentlyAvailable(windows, new Date('2026-07-26T01:00:00.000Z'))).toBe(false);
  });

  it('returns false when there are no windows', () => {
    expect(isCurrentlyAvailable([], new Date('2026-07-20T10:00:00.000Z'))).toBe(false);
  });
});

describe('computeNextWindowStart', () => {
  it('returns now when currently inside a window', () => {
    const windows = [{ startMinuteUtc: 1980, durationMinutes: 480 }];
    const now = new Date('2026-07-20T10:00:00.000Z');
    expect(computeNextWindowStart(windows, now)).toBe(now);
  });

  it('returns the soonest future window start when outside all windows', () => {
    const windows = [{ startMinuteUtc: 1980, durationMinutes: 480 }]; // Mon 09:00–17:00 UTC
    const now = new Date('2026-07-20T08:00:00.000Z'); // Monday 08:00
    expect(computeNextWindowStart(windows, now)).toEqual(
      new Date('2026-07-20T09:00:00.000Z')
    );
  });

  it('wraps across the week boundary to the next occurrence', () => {
    const windows = [{ startMinuteUtc: 0, durationMinutes: 60 }]; // Sunday 00:00–01:00
    const now = new Date('2026-07-25T12:00:00.000Z'); // Saturday noon
    expect(computeNextWindowStart(windows, now)).toEqual(
      new Date('2026-07-26T00:00:00.000Z')
    );
  });
});
