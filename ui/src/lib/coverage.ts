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

function windowCoversUtcMinute(
  window: AvailabilityWindow,
  utcMinute: number,
): boolean {
  return normalize(utcMinute - window.startMinuteUtc) < window.durationMinutes;
}

function slotMinuteUtc(
  slotIndex: number,
  minuteWithinSlot: number,
  browserOffsetMinutes: number,
): number {
  const localStart = slotIndex * SLOT_MINUTES;
  return normalize(localStart + minuteWithinSlot - browserOffsetMinutes);
}

function isAgentAvailableAtUtcMinute(agent: Agent, utcMinute: number): boolean {
  return agent.availabilityWindows.some((window) =>
    windowCoversUtcMinute(window, utcMinute),
  );
}

/** Whether any part of a display slot overlaps an agent's availability. */
export function isAgentAvailableInSlot(
  agent: Agent,
  slotIndex: number,
  browserOffsetMinutes = getBrowserOffsetMinutes(),
): boolean {
  for (let minute = 0; minute < SLOT_MINUTES; minute += 1) {
    const utcMinute = slotMinuteUtc(slotIndex, minute, browserOffsetMinutes);
    if (isAgentAvailableAtUtcMinute(agent, utcMinute)) return true;
  }
  return false;
}

export function isSlotCovered(
  agents: Agent[],
  slotIndex: number,
  browserOffsetMinutes = getBrowserOffsetMinutes(),
): boolean {
  for (let minute = 0; minute < SLOT_MINUTES; minute += 1) {
    const utcMinute = slotMinuteUtc(slotIndex, minute, browserOffsetMinutes);
    const covered = agents.some((agent) =>
      isAgentAvailableAtUtcMinute(agent, utcMinute),
    );
    if (!covered) return false;
  }
  return true;
}

export function getDailyCoverageGaps(
  agents: Agent[],
  dayIndex: number,
  browserOffsetMinutes = getBrowserOffsetMinutes(),
): TimeRange[] {
  const dayStartSlot = dayIndex * SLOTS_PER_DAY;
  const gaps: TimeRange[] = [];
  let gapStart: number | null = null;

  for (let slot = 0; slot < SLOTS_PER_DAY; slot += 1) {
    const covered = isSlotCovered(
      agents,
      dayStartSlot + slot,
      browserOffsetMinutes,
    );

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
