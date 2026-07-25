import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  COMPANY_ID,
  MALFORMED_COMPANY_ID,
  UNKNOWN_COMPANY_ID,
  agentsWithWorkload,
  company,
} from '../helpers/fixtures.js';

vi.mock('../../src/repositories/company.repository.js', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('../../src/repositories/agent.repository.js', () => ({
  default: {
    loadCompanyAgentsData: vi.fn(),
  },
}));

import app from '../../src/app.js';
import CompanyRepository from '../../src/repositories/company.repository.js';
import AgentRepository from '../../src/repositories/agent.repository.js';

const findCompanyById = vi.mocked(CompanyRepository.findById);
const loadCompanyAgentsData = vi.mocked(AgentRepository.loadCompanyAgentsData);

describe('GET /companies/:companyId/agents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with agents and computed workload fields', async () => {
    findCompanyById.mockResolvedValue(company);
    loadCompanyAgentsData.mockResolvedValue({
      agents: agentsWithWorkload.map(
        ({ scheduledWeeklyHours, activeTicketCount, ticketDensity, availabilityWindows, ...agent }) =>
          agent
      ),
      windowsByAgent: new Map([
        [agentsWithWorkload[0]!.id, agentsWithWorkload[0]!.availabilityWindows],
        [agentsWithWorkload[1]!.id, agentsWithWorkload[1]!.availabilityWindows],
      ]),
      activeCountByAgent: new Map([
        [agentsWithWorkload[0]!.id, agentsWithWorkload[0]!.activeTicketCount],
        [agentsWithWorkload[1]!.id, agentsWithWorkload[1]!.activeTicketCount],
      ]),
    });

    const res = await request(app).get(`/companies/${COMPANY_ID}/agents`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      agents: [
        {
          id: '22222222-2222-2222-2222-222222222221',
          name: 'AgentA',
          utcOffsetMinutes: 330,
          scheduledWeeklyHours: 8.5,
          activeTicketCount: 1,
          ticketDensity: 1 / 8.5,
          lastAssignedAt: '2026-07-20T10:00:00.000Z',
          availabilityWindows: [{ startMinuteUtc: 210, durationMinutes: 510 }],
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'AgentB',
          utcOffsetMinutes: -300,
          scheduledWeeklyHours: 8,
          activeTicketCount: 0,
          ticketDensity: 0,
          lastAssignedAt: null,
          availabilityWindows: [{ startMinuteUtc: 780, durationMinutes: 480 }],
        },
      ],
    });
    expect(findCompanyById).toHaveBeenCalledWith(COMPANY_ID);
    expect(loadCompanyAgentsData).toHaveBeenCalledWith(COMPANY_ID);
  });

  it('returns 200 with an empty agents list when the company has none', async () => {
    findCompanyById.mockResolvedValue(company);
    loadCompanyAgentsData.mockResolvedValue({
      agents: [],
      windowsByAgent: new Map(),
      activeCountByAgent: new Map(),
    });

    const res = await request(app).get(`/companies/${COMPANY_ID}/agents`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ agents: [] });
  });

  it('returns 400 when companyId is not a well-formed UUID', async () => {
    const res = await request(app).get(`/companies/${MALFORMED_COMPANY_ID}/agents`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "'companyId' is not a well-formed UUID",
      code: 'BAD_REQUEST',
    });
    expect(findCompanyById).not.toHaveBeenCalled();
    expect(loadCompanyAgentsData).not.toHaveBeenCalled();
  });

  it('returns 404 when the company does not exist', async () => {
    findCompanyById.mockResolvedValue(null);

    const res = await request(app).get(`/companies/${UNKNOWN_COMPANY_ID}/agents`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Company not found',
      code: 'NOT_FOUND',
    });
    expect(loadCompanyAgentsData).not.toHaveBeenCalled();
  });
});
