import type { AgentWithWorkload, Company, Ticket } from '../../src/types/domain.js';

export const COMPANY_ID = '11111111-1111-1111-1111-111111111111';
export const UNKNOWN_COMPANY_ID = '99999999-9999-9999-9999-999999999999';
export const MALFORMED_COMPANY_ID = 'not-a-uuid';

export const company: Company = {
  id: COMPANY_ID,
  name: 'ClearFeed',
};

export const agentsWithWorkload: AgentWithWorkload[] = [
  {
    id: '22222222-2222-2222-2222-222222222221',
    companyId: COMPANY_ID,
    name: 'AgentA',
    utcOffsetMinutes: 330,
    lastAssignedAt: new Date('2026-07-20T10:00:00.000Z'),
    scheduledWeeklyHours: 8.5,
    activeTicketCount: 1,
    ticketDensity: 1 / 8.5,
    availabilityWindows: [{ startMinuteUtc: 210, durationMinutes: 510 }],
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    companyId: COMPANY_ID,
    name: 'AgentB',
    utcOffsetMinutes: -300,
    lastAssignedAt: null,
    scheduledWeeklyHours: 8,
    activeTicketCount: 0,
    ticketDensity: 0,
    availabilityWindows: [{ startMinuteUtc: 780, durationMinutes: 480 }],
  },
];

export const tickets: Ticket[] = [
  {
    id: '33333333-3333-3333-3333-333333333331',
    companyId: COMPANY_ID,
    status: 'unassigned',
    assignedAgentId: null,
    assignedAt: null,
    reason: null,
    closedAt: null,
  },
  {
    id: '33333333-3333-3333-3333-333333333332',
    companyId: COMPANY_ID,
    status: 'assigned',
    assignedAgentId: '22222222-2222-2222-2222-222222222221',
    assignedAt: new Date('2026-07-20T10:00:00.000Z'),
    reason: 'Lowest ticket density among available agents',
    closedAt: null,
  },
];
