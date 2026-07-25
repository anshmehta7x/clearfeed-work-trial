import type { Agent, AgentWithWorkload, UtcAvailabilityWindow } from '../types/domain.js';

/**
 * Derives scheduled weekly hours and ticket density from stored windows + active count.
 */
export function buildAgentWithWorkload(
  agent: Agent,
  availabilityWindows: UtcAvailabilityWindow[],
  activeTicketCount: number
): AgentWithWorkload {
  const scheduledWeeklyMinutes = availabilityWindows.reduce(
    (sum, w) => sum + w.durationMinutes,
    0
  );
  const scheduledWeeklyHours = scheduledWeeklyMinutes / 60;
  const ticketDensity =
    scheduledWeeklyHours > 0 ? activeTicketCount / scheduledWeeklyHours : null;

  return {
    ...agent,
    scheduledWeeklyHours,
    activeTicketCount,
    ticketDensity,
    availabilityWindows,
  };
}
