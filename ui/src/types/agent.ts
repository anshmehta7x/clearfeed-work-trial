import type { AvailabilityWindow } from './availability';

export interface Agent {
  id: string;
  name: string;
  utcOffsetMinutes: number;
  scheduledWeeklyHours: number;
  activeTicketCount: number;
  ticketDensity: number | null;
  lastAssignedAt: string | null;
  availabilityWindows: AvailabilityWindow[];
}
