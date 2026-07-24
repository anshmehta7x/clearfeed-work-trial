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
