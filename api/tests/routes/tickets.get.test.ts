import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  COMPANY_ID,
  MALFORMED_COMPANY_ID,
  UNKNOWN_COMPANY_ID,
  company,
  tickets,
} from '../helpers/fixtures.js';

vi.mock('../../src/repositories/company.repository.js', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('../../src/repositories/ticket.repository.js', () => ({
  default: {
    findByCompany: vi.fn(),
  },
}));

import app from '../../src/app.js';
import CompanyRepository from '../../src/repositories/company.repository.js';
import TicketRepository from '../../src/repositories/ticket.repository.js';

const findCompanyById = vi.mocked(CompanyRepository.findById);
const findTicketsByCompany = vi.mocked(TicketRepository.findByCompany);

describe('GET /companies/:companyId/tickets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with tickets and ISO date fields', async () => {
    findCompanyById.mockResolvedValue(company);
    findTicketsByCompany.mockResolvedValue(tickets);

    const res = await request(app).get(`/companies/${COMPANY_ID}/tickets`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      tickets: [
        {
          id: '33333333-3333-3333-3333-333333333331',
          status: 'unassigned',
          assignedAgentId: null,
          assignedAt: null,
          reason: null,
          closedAt: null,
        },
        {
          id: '33333333-3333-3333-3333-333333333332',
          status: 'assigned',
          assignedAgentId: '22222222-2222-2222-2222-222222222221',
          assignedAt: '2026-07-20T10:00:00.000Z',
          reason: 'Assigned based on availability and lowest ticket density',
          closedAt: null,
        },
      ],
    });
    expect(findCompanyById).toHaveBeenCalledWith(COMPANY_ID);
    expect(findTicketsByCompany).toHaveBeenCalledWith(COMPANY_ID);
  });

  it('returns 200 with an empty tickets list when the company has none', async () => {
    findCompanyById.mockResolvedValue(company);
    findTicketsByCompany.mockResolvedValue([]);

    const res = await request(app).get(`/companies/${COMPANY_ID}/tickets`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tickets: [] });
  });

  it('returns 400 when companyId is not a well-formed UUID', async () => {
    const res = await request(app).get(`/companies/${MALFORMED_COMPANY_ID}/tickets`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "'companyId' is not a well-formed UUID",
      code: 'BAD_REQUEST',
    });
    expect(findCompanyById).not.toHaveBeenCalled();
    expect(findTicketsByCompany).not.toHaveBeenCalled();
  });

  it('returns 404 when the company does not exist', async () => {
    findCompanyById.mockResolvedValue(null);

    const res = await request(app).get(`/companies/${UNKNOWN_COMPANY_ID}/tickets`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Company not found',
      code: 'NOT_FOUND',
    });
    expect(findTicketsByCompany).not.toHaveBeenCalled();
  });
});
