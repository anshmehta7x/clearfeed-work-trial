export type TicketStatus = 'unassigned' | 'assigned' | 'closed';

export interface Ticket {
  id: string;
  status: TicketStatus;
  assignedAgentId: string | null;
  assignedAt: string | null;
  reason: string | null;
  closedAt: string | null;
}
