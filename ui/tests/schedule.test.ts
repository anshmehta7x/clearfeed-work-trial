import { describe, expect, it } from 'vitest';
import {
  parseTimeOfDay,
  utcWindowToLocal,
  utcWindowsToLocal,
  validateEditableWindows,
  type EditableWindow,
} from '../src/lib/schedule';

describe('parseTimeOfDay', () => {
  it('accepts minute-precision times and the end-of-day boundary', () => {
    expect(parseTimeOfDay('09:17')).toBe(557);
    expect(parseTimeOfDay('24:00', true)).toBe(1440);
  });

  it('rejects malformed and out-of-range times', () => {
    expect(parseTimeOfDay('9:17')).toBeNull();
    expect(parseTimeOfDay('23:60')).toBeNull();
    expect(parseTimeOfDay('24:00')).toBeNull();
    expect(parseTimeOfDay('24:01', true)).toBeNull();
  });
});

describe('utcWindowToLocal', () => {
  it('converts a UTC window to the agent local timezone', () => {
    expect(
      utcWindowToLocal(
        { startMinuteUtc: 1_650, durationMinutes: 480 },
        330,
      ),
    ).toEqual({
      dayOfWeek: 1,
      startMinute: 540,
      endMinute: 1_020,
    });
  });

  it('handles conversion across the weekly boundary', () => {
    expect(
      utcWindowToLocal(
        { startMinuteUtc: 10_050, durationMinutes: 30 },
        60,
      ),
    ).toEqual({
      dayOfWeek: 0,
      startMinute: 30,
      endMinute: 60,
    });
  });
});

describe('utcWindowsToLocal', () => {
  it('sorts converted windows by local day and start time', () => {
    const windows = utcWindowsToLocal(
      [
        { startMinuteUtc: 2_040, durationMinutes: 60 },
        { startMinuteUtc: 1_500, durationMinutes: 60 },
      ],
      0,
    );

    expect(windows.map(({ dayOfWeek, startMinute }) => ({
      dayOfWeek,
      startMinute,
    }))).toEqual([
      { dayOfWeek: 1, startMinute: 60 },
      { dayOfWeek: 1, startMinute: 600 },
    ]);
  });
});

describe('validateEditableWindows', () => {
  function window(overrides: Partial<EditableWindow> = {}): EditableWindow {
    return {
      key: 'window-1',
      dayOfWeek: 1,
      startMinute: 540,
      endMinute: 1_020,
      ...overrides,
    };
  }

  it('accepts valid same-day windows', () => {
    expect(validateEditableWindows([window()])).toBeNull();
  });

  it('rejects a window whose start is not before its end', () => {
    expect(
      validateEditableWindows([window({ startMinute: 600, endMinute: 600 })]),
    ).toBe('Monday: start must be before end');
  });

  it('rejects out-of-range times', () => {
    expect(
      validateEditableWindows([window({ startMinute: -1 })]),
    ).toBe('Monday: invalid start time');

    expect(
      validateEditableWindows([window({ endMinute: 1_441 })]),
    ).toBe('Monday: invalid end time');
  });
});
