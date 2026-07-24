import { describe, expect, it } from 'vitest';
import {
  assertValidLocalWindows,
  assertValidUtcOffset,
  localWindowToUtc,
  localWindowsToUtc,
  mergeLocalWindows,
  normalizeWeekMinute,
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
    // Design doc §3.1 example
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
