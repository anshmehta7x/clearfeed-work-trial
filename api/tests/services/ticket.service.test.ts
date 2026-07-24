import { describe, expect, it } from 'vitest';
import type { AgentWithWorkload } from '../../src/types/domain.js';
import { selectAgentForAssignment } from '../../src/services/ticket.service.js';
import { AGENT_B_ID, AGENT_ID, COMPANY_ID } from '../helpers/fixtures.js';

const mondayTenAm = new Date('2026-07-20T10:00:00.000Z');

function agent(overrides: Partial<AgentWithWorkload> & { id: string }): AgentWithWorkload {
  return {
    companyId: COMPANY_ID,
    name: overrides.id,
    utcOffsetMinutes: 0,
    lastAssignedAt: null,
    scheduledWeeklyHours: 40,
    activeTicketCount: 0,
    ticketDensity: 0,
    availabilityWindows: [{ startMinuteUtc: 1980, durationMinutes: 480 }], // Mon 09:00–17:00 UTC
    ...overrides,
  };
}

describe('selectAgentForAssignment', () => {
  it('picks the eligible agent with lowest ticket density', () => {
    const agents = [
      agent({
        id: AGENT_ID,
        ticketDensity: 0.2,
        activeTicketCount: 8,
        lastAssignedAt: new Date('2026-07-01T00:00:00.000Z'),
      }),
      agent({
        id: AGENT_B_ID,
        ticketDensity: 0.1,
        activeTicketCount: 4,
        lastAssignedAt: new Date('2026-07-10T00:00:00.000Z'),
      }),
    ];

    const choice = selectAgentForAssignment(agents, mondayTenAm);

    expect(choice.agent.id).toBe(AGENT_B_ID);
    expect(choice.reason).toBe('Available; lowest ticket density (0.100)');
  });

  it('tie-breaks eligible agents by least recently assigned, then id', () => {
    const sharedDensity = 0.1;
    const agents = [
      agent({
        id: AGENT_B_ID,
        ticketDensity: sharedDensity,
        lastAssignedAt: new Date('2026-07-10T00:00:00.000Z'),
      }),
      agent({
        id: AGENT_ID,
        ticketDensity: sharedDensity,
        lastAssignedAt: null,
      }),
    ];

    const choice = selectAgentForAssignment(agents, mondayTenAm);
    expect(choice.agent.id).toBe(AGENT_ID);
    expect(choice.reason).toBe(
      'Available; tied on density (0.100), least recently assigned'
    );
  });

  it('uses ascending id when eligible density and assignment time are tied', () => {
    const tiedAt = new Date('2026-07-10T00:00:00.000Z');
    const agents = [
      agent({ id: AGENT_B_ID, ticketDensity: 0.1, lastAssignedAt: tiedAt }),
      agent({ id: AGENT_ID, ticketDensity: 0.1, lastAssignedAt: tiedAt }),
    ];

    const choice = selectAgentForAssignment(agents, mondayTenAm);
    expect(choice.agent.id).toBe(AGENT_ID);
    expect(choice.reason).toBe(
      'Available; tied on density (0.100) and last assignment, lowest agent ID'
    );
  });

  it('excludes agents at or above the density threshold from eligible path', () => {
    const agents = [
      agent({
        id: AGENT_ID,
        ticketDensity: 0.25,
        activeTicketCount: 10,
        lastAssignedAt: new Date('2026-07-01T00:00:00.000Z'),
      }),
      agent({
        id: AGENT_B_ID,
        ticketDensity: 0.1,
        activeTicketCount: 4,
      }),
    ];

    expect(selectAgentForAssignment(agents, mondayTenAm).agent.id).toBe(AGENT_B_ID);
  });

  it('uses next-window fallback when no agent is eligible', () => {
    // Monday 08:00 — both windows start at 09:00, neither currently available
    const now = new Date('2026-07-20T08:00:00.000Z');
    const agents = [
      agent({
        id: AGENT_ID,
        ticketDensity: 0.1,
        availabilityWindows: [{ startMinuteUtc: 1800, durationMinutes: 60 }], // Mon 12:00
      }),
      agent({
        id: AGENT_B_ID,
        ticketDensity: 0.2,
        availabilityWindows: [{ startMinuteUtc: 1650, durationMinutes: 60 }], // Mon 09:00
      }),
    ];

    const choice = selectAgentForAssignment(agents, now);

    expect(choice.agent.id).toBe(AGENT_B_ID);
    expect(choice.reason).toMatch(/^Fallback: not currently available; next window soonest/);
  });

  it('on fallback, prefers a currently working over-threshold agent (nextWindow = now)', () => {
    const agents = [
      agent({
        id: AGENT_ID,
        ticketDensity: 0.5,
        activeTicketCount: 20,
        availabilityWindows: [{ startMinuteUtc: 1980, durationMinutes: 480 }], // currently available
      }),
      agent({
        id: AGENT_B_ID,
        ticketDensity: 0.1,
        availabilityWindows: [{ startMinuteUtc: 3000, durationMinutes: 60 }], // later in week
      }),
    ];

    const choice = selectAgentForAssignment(agents, mondayTenAm);

    expect(choice.agent.id).toBe(AGENT_ID);
    expect(choice.reason).toMatch(
      /^Fallback: available but at\/above density threshold \(0\.500\)/
    );
  });

  it('tie-breaks fallback by density, then assignment time, then id', () => {
    const nextWindow = [{ startMinuteUtc: 3000, durationMinutes: 60 }];
    const agents = [
      agent({
        id: AGENT_B_ID,
        ticketDensity: 0.2,
        availabilityWindows: nextWindow,
        lastAssignedAt: null,
      }),
      agent({
        id: AGENT_ID,
        ticketDensity: 0.1,
        availabilityWindows: nextWindow,
        lastAssignedAt: new Date('2026-07-10T00:00:00.000Z'),
      }),
    ];
    expect(selectAgentForAssignment(agents, mondayTenAm).agent.id).toBe(AGENT_ID);

    agents[0]!.ticketDensity = 0.1;
    expect(selectAgentForAssignment(agents, mondayTenAm).agent.id).toBe(AGENT_B_ID);

    agents[1]!.lastAssignedAt = null;
    expect(selectAgentForAssignment(agents, mondayTenAm).agent.id).toBe(AGENT_ID);
  });

  it('uses last-resort when no agent has availability configured', () => {
    const agents = [
      agent({
        id: AGENT_B_ID,
        scheduledWeeklyHours: 0,
        ticketDensity: null,
        activeTicketCount: 5,
        availabilityWindows: [],
        lastAssignedAt: new Date('2026-07-01T00:00:00.000Z'),
      }),
      agent({
        id: AGENT_ID,
        scheduledWeeklyHours: 0,
        ticketDensity: null,
        activeTicketCount: 2,
        availabilityWindows: [],
        lastAssignedAt: new Date('2026-07-10T00:00:00.000Z'),
      }),
    ];

    const choice = selectAgentForAssignment(agents, mondayTenAm);

    expect(choice.agent.id).toBe(AGENT_ID);
    expect(choice.reason).toMatch(
      /^Last resort: no availability configured; fewest active tickets \(2\)/
    );
  });

  it('tie-breaks last resort by assignment time, then id', () => {
    const agents = [
      agent({
        id: AGENT_B_ID,
        scheduledWeeklyHours: 0,
        ticketDensity: null,
        activeTicketCount: 2,
        availabilityWindows: [],
        lastAssignedAt: null,
      }),
      agent({
        id: AGENT_ID,
        scheduledWeeklyHours: 0,
        ticketDensity: null,
        activeTicketCount: 2,
        availabilityWindows: [],
        lastAssignedAt: new Date('2026-07-10T00:00:00.000Z'),
      }),
    ];
    expect(selectAgentForAssignment(agents, mondayTenAm).agent.id).toBe(AGENT_B_ID);

    agents[1]!.lastAssignedAt = null;
    expect(selectAgentForAssignment(agents, mondayTenAm).agent.id).toBe(AGENT_ID);
  });
});
