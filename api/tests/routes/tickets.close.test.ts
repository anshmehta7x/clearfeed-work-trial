import { beforeEach, describe, expect, it, vi } from 'vitest';
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

import app from '../../src/app.js';
import CompanyRepository from '../../src/repositories/company.repository.js';
import TicketRepository from '../../src/repositories/ticket.repository.js';

const findCompanyById = vi.mocked(CompanyRepository.findById);
const findTicketById = vi.mocked(TicketRepository.findById);
const closeAssigned = vi.mocked(TicketRepository.closeAssigned);

const closeUrl = (companyId: string, ticketId: string) =>
  `/companies/${companyId}/tickets/${ticketId}/close`;

describe('POST /companies/:companyId/tickets/:ticketId/close', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 when closing an assigned ticket', async () => {
    findCompanyById.mockResolvedValue(company);
    findTicketById.mockResolvedValue(assignedTicket);
    const closed = {
      ...assignedTicket,
      status: 'closed' as const,
      closedAt: new Date('2026-07-20T12:00:00.000Z'),
    };
    closeAssigned.mockResolvedValue(closed);

    const res = await request(app).post(closeUrl(COMPANY_ID, ASSIGNED_TICKET_ID));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ticketId: ASSIGNED_TICKET_ID,
      status: 'closed',
      closedAt: '2026-07-20T12:00:00.000Z',
    });
    expect(closeAssigned).toHaveBeenCalledWith(
      COMPANY_ID,
      ASSIGNED_TICKET_ID,
      expect.any(Date)
    );
  });

  it('returns the existing closedAt when the ticket is already closed', async () => {
    findCompanyById.mockResolvedValue(company);
    findTicketById.mockResolvedValue(closedTicket);

    const res = await request(app).post(closeUrl(COMPANY_ID, CLOSED_TICKET_ID));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ticketId: CLOSED_TICKET_ID,
      status: 'closed',
      closedAt: '2026-07-20T12:00:00.000Z',
    });
    expect(closeAssigned).not.toHaveBeenCalled();
  });

  it('returns 409 when the ticket is unassigned', async () => {
    findCompanyById.mockResolvedValue(company);
    findTicketById.mockResolvedValue(unassignedTicket);

    const res = await request(app).post(closeUrl(COMPANY_ID, TICKET_ID));

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: 'Ticket is unassigned and cannot be closed',
      code: 'CONFLICT',
    });
    expect(closeAssigned).not.toHaveBeenCalled();
  });

  it('returns 400 when companyId is not a well-formed UUID', async () => {
    const res = await request(app).post(closeUrl(MALFORMED_COMPANY_ID, ASSIGNED_TICKET_ID));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "'companyId' is not a well-formed UUID",
      code: 'BAD_REQUEST',
    });
  });

  it('returns 400 when ticketId is not a well-formed UUID', async () => {
    const res = await request(app).post(closeUrl(COMPANY_ID, MALFORMED_TICKET_ID));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "'ticketId' is not a well-formed UUID",
      code: 'BAD_REQUEST',
    });
  });

  it('returns 404 when the company does not exist', async () => {
    findCompanyById.mockResolvedValue(null);

    const res = await request(app).post(closeUrl(UNKNOWN_COMPANY_ID, ASSIGNED_TICKET_ID));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Company not found',
      code: 'NOT_FOUND',
    });
  });

  it('returns 404 when the ticket does not exist', async () => {
    findCompanyById.mockResolvedValue(company);
    findTicketById.mockResolvedValue(null);

    const res = await request(app).post(closeUrl(COMPANY_ID, UNKNOWN_TICKET_ID));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Ticket not found',
      code: 'NOT_FOUND',
    });
  });
});
