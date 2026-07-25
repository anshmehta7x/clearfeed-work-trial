import type { Agent } from './agent';
import type { Ticket } from './ticket';

export interface GetAgentsResponse {
  agents: Agent[];
}

export interface GetTicketsResponse {
  tickets: Ticket[];
}

export interface AssignTicketResponse {
  ticketId: string;
  assignedAgentId: string;
  assignedAt: string;
  status: 'assigned' | 'closed';
  reason: string;
}

export interface CloseTicketResponse {
  ticketId: string;
  status: 'closed';
  closedAt: string;
}
