import { ParamsDictionary } from 'express-serve-static-core';

export interface TicketDTO {
  id: string;
  status: 'unassigned' | 'assigned' | 'closed';
  assignedAgentId: string | null;
  assignedAt: string | null;
  reason: string | null;
  closedAt: string | null;
}

export interface GetTicketsResponse {
  tickets: TicketDTO[];
}

interface AvailabilityWindowResponse {
  startMinuteUtc: number;
  durationMinutes: number;
}

export interface AgentDTO {
  id: string;
  name: string;
  utcOffsetMinutes: number;
  scheduledWeeklyHours: number;
  activeTicketCount: number;
  ticketDensity: number | null;
  lastAssignedAt: string | null;
  availabilityWindows: AvailabilityWindowResponse[];
}

export interface GetAgentsResponse {
  agents: AgentDTO[];
}


export interface CompanyParams extends ParamsDictionary {
  companyId: string;
}

export interface TicketParams extends ParamsDictionary {
  companyId: string;
  ticketId: string;
}
