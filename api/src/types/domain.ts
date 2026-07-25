export interface Company {
  id: string;
  name: string;
}

export interface Agent {
  id: string;
  companyId: string;
  name: string;
  utcOffsetMinutes: number;
  lastAssignedAt: Date | null;
}

export interface AvailabilityWindow {
  id: string;
  agentId: string;
  startMinuteUtc: number;   // 0..10079, circular UTC week
  durationMinutes: number;  // 1..1440
}

/** Stored/circular UTC window without row identity (read models + writes). */
export type UtcAvailabilityWindow = Pick<AvailabilityWindow, 'startMinuteUtc' | 'durationMinutes'>;

/** Raw persistence payload for one agent before workload fields are derived. */
export interface AgentData {
  agent: Agent;
  windows: UtcAvailabilityWindow[];
  activeTicketCount: number;
}

/** Raw persistence payload for a company's agents before workload fields are derived. */
export interface CompanyAgentsData {
  agents: Agent[];
  windowsByAgent: Map<string, UtcAvailabilityWindow[]>;
  activeCountByAgent: Map<string, number>;
}

export type TicketStatus = 'unassigned' | 'assigned' | 'closed';

export interface Ticket {
  id: string;
  companyId: string;
  status: TicketStatus;
  assignedAgentId: string | null;
  assignedAt: Date | null;
  reason: string | null;
  closedAt: Date | null;
}

// Derived, not stored - computed by services/repositories on read.
export interface AgentWithWorkload extends Agent {
  scheduledWeeklyHours: number;
  activeTicketCount: number;
  ticketDensity: number | null;
  availabilityWindows: UtcAvailabilityWindow[];
}
