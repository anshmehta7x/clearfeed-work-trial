import { describe, expect, it } from 'vitest';
import type { Agent, AvailabilityWindow } from '../types';
import { isSlotCovered } from './coverage';

let agentNumber = 0;

function agent(windows: AvailabilityWindow[]): Agent {
  agentNumber += 1;
  return {
    id: `agent-${agentNumber}`,
    name: 'Test agent',
    utcOffsetMinutes: 0,
    scheduledWeeklyHours: 0,
    activeTicketCount: 0,
    ticketDensity: null,
    lastAssignedAt: null,
    availabilityWindows: windows,
  };
}

describe('isSlotCovered', () => {
  it('rejects a partially covered 30-minute slot', () => {
    const agents = [agent([{ startMinuteUtc: 0, durationMinutes: 15 }])];

    expect(isSlotCovered(agents, 0, 0)).toBe(false);
  });

  it('accepts full coverage formed by multiple agents', () => {
    const agents = [
      agent([{ startMinuteUtc: 0, durationMinutes: 15 }]),
      agent([{ startMinuteUtc: 15, durationMinutes: 15 }]),
    ];

    expect(isSlotCovered(agents, 0, 0)).toBe(true);
  });

  it('rejects union coverage containing a gap', () => {
    const agents = [
      agent([{ startMinuteUtc: 0, durationMinutes: 10 }]),
      agent([{ startMinuteUtc: 15, durationMinutes: 15 }]),
    ];

    expect(isSlotCovered(agents, 0, 0)).toBe(false);
  });

  it('handles coverage across the weekly boundary', () => {
    const agents = [
      agent([{ startMinuteUtc: 10065, durationMinutes: 15 }]),
      agent([{ startMinuteUtc: 0, durationMinutes: 15 }]),
    ];

    expect(isSlotCovered(agents, 0, 15)).toBe(true);
  });
});
