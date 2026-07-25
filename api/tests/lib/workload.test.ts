import { describe, expect, it } from 'vitest';
import { buildAgentWithWorkload } from '../../src/lib/workload.js';
import { agentA } from '../helpers/fixtures.js';

describe('buildAgentWithWorkload', () => {
  it('computes scheduled hours and density from windows and active count', () => {
    const result = buildAgentWithWorkload(
      agentA,
      [{ startMinuteUtc: 1650, durationMinutes: 480 }],
      2
    );

    expect(result.scheduledWeeklyHours).toBe(8);
    expect(result.activeTicketCount).toBe(2);
    expect(result.ticketDensity).toBe(0.25);
  });

  it('sets ticketDensity to null when there are no scheduled hours', () => {
    const result = buildAgentWithWorkload(agentA, [], 3);

    expect(result.scheduledWeeklyHours).toBe(0);
    expect(result.ticketDensity).toBeNull();
    expect(result.activeTicketCount).toBe(3);
  });
});
