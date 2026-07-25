import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  AGENT_ID,
  ASSIGNED_TICKET_ID,
  CLOSED_TICKET_ID,
  COMPANY_ID,
  MALFORMED_COMPANY_ID,
  MALFORMED_TICKET_ID,
  TICKET_ID,
  UNKNOWN_COMPANY_ID,
  UNKNOWN_TICKET_ID,
  agentA,
  assignedTicket,
  closedTicket,
  company,
  unassignedTicket,
} from '../helpers/fixtures.js';

vi.mock('../../src/repositories/company.repository.js', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('../../src/repositories/ticket.repository.js', () => ({
  default: {
    findByCompany: vi.fn(),
    findById: vi.fn(),
    claimAssignment: vi.fn(),
    closeAssigned: vi.fn(),
  },
}));

vi.mock('../../src/repositories/agent.repository.js', () => ({
  default: {
    loadCompanyAgentsData: vi.fn(),
  },
}));

import app from '../../src/app.js';
import CompanyRepository from '../../src/repositories/company.repository.js';
import TicketRepository from '../../src/repositories/ticket.repository.js';
import AgentRepository from '../../src/repositories/agent.repository.js';

const findCompanyById = vi.mocked(CompanyRepository.findById);
const findTicketById = vi.mocked(TicketRepository.findById);
const claimAssignment = vi.mocked(TicketRepository.claimAssignment);
const loadCompanyAgentsData = vi.mocked(AgentRepository.loadCompanyAgentsData);

const assignUrl = (companyId: string, ticketId: string) =>
  `/companies/${companyId}/tickets/${ticketId}/assign`;

describe('POST /companies/:companyId/tickets/:ticketId/assign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 200 with the assignment result', async () => {
    findCompanyById.mockResolvedValue(company);
    findTicketById.mockResolvedValue(unassignedTicket);
    loadCompanyAgentsData.mockResolvedValue({
      agents: [agentA],
      windowsByAgent: new Map([
        [AGENT_ID, [{ startMinuteUtc: 1980, durationMinutes: 480 }]],
      ]),
      activeCountByAgent: new Map([[AGENT_ID, 0]]),
    });

    const expectedReason = 'Available; lowest ticket density (0.000)';
    const claimed = {
      ...unassignedTicket,
      status: 'assigned' as const,
      assignedAgentId: AGENT_ID,
      assignedAt: new Date('2026-07-20T10:00:00.000Z'),
      reason: expectedReason,
    };
    claimAssignment.mockResolvedValue(claimed);

    const res = await request(app).post(assignUrl(COMPANY_ID, TICKET_ID));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ticketId: TICKET_ID,
      assignedAgentId: AGENT_ID,
      assignedAt: '2026-07-20T10:00:00.000Z',
      status: 'assigned',
      reason: expectedReason,
    });
    expect(claimAssignment).toHaveBeenCalledWith(
      COMPANY_ID,
      TICKET_ID,
      AGENT_ID,
      new Date('2026-07-20T10:00:00.000Z'),
      expectedReason
    );
  });

  it('returns the existing assignment when the ticket is already assigned', async () => {
    findCompanyById.mockResolvedValue(company);
    findTicketById.mockResolvedValue(assignedTicket);

    const res = await request(app).post(assignUrl(COMPANY_ID, ASSIGNED_TICKET_ID));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ticketId: ASSIGNED_TICKET_ID,
      assignedAgentId: AGENT_ID,
      assignedAt: '2026-07-20T10:00:00.000Z',
      status: 'assigned',
      reason: assignedTicket.reason,
    });
    expect(loadCompanyAgentsData).not.toHaveBeenCalled();
    expect(claimAssignment).not.toHaveBeenCalled();
  });

  it('returns the existing result when the ticket is already closed', async () => {
    findCompanyById.mockResolvedValue(company);
    findTicketById.mockResolvedValue(closedTicket);

    const res = await request(app).post(assignUrl(COMPANY_ID, CLOSED_TICKET_ID));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ticketId: CLOSED_TICKET_ID,
      assignedAgentId: AGENT_ID,
      assignedAt: '2026-07-20T10:00:00.000Z',
      status: 'closed',
      reason: closedTicket.reason,
    });
    expect(claimAssignment).not.toHaveBeenCalled();
  });

  it('returns 400 when companyId is not a well-formed UUID', async () => {
    const res = await request(app).post(assignUrl(MALFORMED_COMPANY_ID, TICKET_ID));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "'companyId' is not a well-formed UUID",
      code: 'BAD_REQUEST',
    });
    expect(findCompanyById).not.toHaveBeenCalled();
  });

  it('returns 400 when ticketId is not a well-formed UUID', async () => {
    const res = await request(app).post(assignUrl(COMPANY_ID, MALFORMED_TICKET_ID));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "'ticketId' is not a well-formed UUID",
      code: 'BAD_REQUEST',
    });
  });

  it('returns 404 when the company does not exist', async () => {
    findCompanyById.mockResolvedValue(null);

    const res = await request(app).post(assignUrl(UNKNOWN_COMPANY_ID, TICKET_ID));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Company not found',
      code: 'NOT_FOUND',
    });
  });

  it('returns 404 when the ticket does not exist', async () => {
    findCompanyById.mockResolvedValue(company);
    findTicketById.mockResolvedValue(null);

    const res = await request(app).post(assignUrl(COMPANY_ID, UNKNOWN_TICKET_ID));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Ticket not found',
      code: 'NOT_FOUND',
    });
  });

  it('returns 422 when the company has no agents', async () => {
    findCompanyById.mockResolvedValue(company);
    findTicketById.mockResolvedValue(unassignedTicket);
    loadCompanyAgentsData.mockResolvedValue({
      agents: [],
      windowsByAgent: new Map(),
      activeCountByAgent: new Map(),
    });

    const res = await request(app).post(assignUrl(COMPANY_ID, TICKET_ID));

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: 'Company has no agents configured',
      code: 'UNPROCESSABLE',
    });
    expect(claimAssignment).not.toHaveBeenCalled();
  });
});
