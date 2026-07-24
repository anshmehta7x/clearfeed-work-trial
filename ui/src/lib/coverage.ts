import type { Agent, AvailabilityWindow } from '../types';

export const MINUTES_PER_WEEK = 7 * 24 * 60; // 10080
export const SLOT_MINUTES = 30;
export const SLOTS_PER_WEEK = MINUTES_PER_WEEK / SLOT_MINUTES; // 336
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const SLOTS_PER_DAY = 24 * 60 / SLOT_MINUTES; // 48

export interface TimeRange {
  startMinute: number;
  endMinute: number;
}

export function normalize(value: number): number {
  return ((value % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
}

export function getBrowserOffsetMinutes(): number {
  return new Date().getTimezoneOffset() * -1;
}

function windowCoversSlot(
  window: AvailabilityWindow,
  slotStartUtc: number,
  slotEndUtc: number,
): boolean {
  const winStart = window.startMinuteUtc;
  const winEnd = winStart + window.durationMinutes;

  function intervalInside(a: number, b: number): boolean {
    if (winEnd <= MINUTES_PER_WEEK) {
      return a >= winStart && b <= winEnd;
    }

    const winEndWrapped = winEnd % MINUTES_PER_WEEK;
    return (a >= winStart && b <= MINUTES_PER_WEEK) || (a >= 0 && b <= winEndWrapped);
  }

  if (slotEndUtc > slotStartUtc) {
    return intervalInside(slotStartUtc, slotEndUtc);
  }

  return (
    intervalInside(slotStartUtc, MINUTES_PER_WEEK) &&
    intervalInside(0, slotEndUtc)
  );
}

export function isAgentAvailableInSlot(agent: Agent, slotIndex: number): boolean {
  const offset = getBrowserOffsetMinutes();
  const localStart = slotIndex * SLOT_MINUTES;
  const slotStartUtc = normalize(localStart - offset);
  const slotEndUtc = normalize(slotStartUtc + SLOT_MINUTES);

  return agent.availabilityWindows.some((window) =>
    windowCoversSlot(window, slotStartUtc, slotEndUtc),
  );
}

export function isSlotCovered(agents: Agent[], slotIndex: number): boolean {
  return agents.some((agent) => isAgentAvailableInSlot(agent, slotIndex));
}

export function getDailyCoverageGaps(agents: Agent[], dayIndex: number): TimeRange[] {
  const dayStartSlot = dayIndex * SLOTS_PER_DAY;
  const gaps: TimeRange[] = [];
  let gapStart: number | null = null;

  for (let slot = 0; slot < SLOTS_PER_DAY; slot += 1) {
    const covered = isSlotCovered(agents, dayStartSlot + slot);

    if (!covered && gapStart === null) {
      gapStart = slot * SLOT_MINUTES;
    }

    if (covered && gapStart !== null) {
      gaps.push({ startMinute: gapStart, endMinute: slot * SLOT_MINUTES });
      gapStart = null;
    }
  }

  if (gapStart !== null) {
    gaps.push({ startMinute: gapStart, endMinute: 24 * 60 });
  }

  return gaps;
}

export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${remainder
    .toString()
    .padStart(2, '0')}`;
}

export function getCurrentSlotIndex(): number {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const hour = now.getHours();
  const minute = now.getMinutes();
  return ((day * 24 + hour) * 60 + minute) / SLOT_MINUTES;
}

export function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const hours = Math.floor(Math.abs(offsetMinutes) / 60);
  const minutes = Math.abs(offsetMinutes) % 60;
  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
}
