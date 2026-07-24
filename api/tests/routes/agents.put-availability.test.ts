import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  AGENT_ID,
  COMPANY_ID,
  MALFORMED_AGENT_ID,
  MALFORMED_COMPANY_ID,
  UNKNOWN_AGENT_ID,
  UNKNOWN_COMPANY_ID,
  agentA,
  company,
} from '../helpers/fixtures.js';

vi.mock('../../src/repositories/company.repository.js', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('../../src/repositories/agent.repository.js', () => ({
  default: {
    findById: vi.fn(),
    loadAgentData: vi.fn(),
    replaceAvailability: vi.fn(),
  },
}));

import app from '../../src/app.js';
import CompanyRepository from '../../src/repositories/company.repository.js';
import AgentRepository from '../../src/repositories/agent.repository.js';

const findCompanyById = vi.mocked(CompanyRepository.findById);
const findAgentById = vi.mocked(AgentRepository.findById);
const loadAgentData = vi.mocked(AgentRepository.loadAgentData);
const replaceAvailability = vi.mocked(AgentRepository.replaceAvailability);

const availabilityUrl = (companyId: string, agentId: string) =>
  `/companies/${companyId}/agents/${agentId}/availability`;

describe('PUT /companies/:companyId/agents/:agentId/availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with the updated agent object', async () => {
    findCompanyById.mockResolvedValue(company);
    findAgentById.mockResolvedValue(agentA);
    replaceAvailability.mockResolvedValue(true);
    loadAgentData.mockResolvedValue({
      agent: { ...agentA, utcOffsetMinutes: 330 },
      windows: [{ startMinuteUtc: 1650, durationMinutes: 480 }],
      activeTicketCount: 1,
    });

    const res = await request(app)
      .put(availabilityUrl(COMPANY_ID, AGENT_ID))
      .send({
        utcOffsetMinutes: 330,
        windows: [{ dayOfWeek: 1, startMinute: 540, endMinute: 1020 }],
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: AGENT_ID,
      name: 'AgentA',
      utcOffsetMinutes: 330,
      scheduledWeeklyHours: 8,
      activeTicketCount: 1,
      ticketDensity: 1 / 8,
      lastAssignedAt: '2026-07-20T10:00:00.000Z',
      availabilityWindows: [{ startMinuteUtc: 1650, durationMinutes: 480 }],
    });
    expect(replaceAvailability).toHaveBeenCalledWith(COMPANY_ID, AGENT_ID, 330, [
      { startMinuteUtc: 1650, durationMinutes: 480 },
    ]);
  });

  it('returns 200 and clears windows when windows is empty', async () => {
    findCompanyById.mockResolvedValue(company);
    findAgentById.mockResolvedValue(agentA);
    replaceAvailability.mockResolvedValue(true);
    loadAgentData.mockResolvedValue({
      agent: agentA,
      windows: [],
      activeTicketCount: 0,
    });

    const res = await request(app)
      .put(availabilityUrl(COMPANY_ID, AGENT_ID))
      .send({ utcOffsetMinutes: 330, windows: [] });

    expect(res.status).toBe(200);
    expect(res.body.scheduledWeeklyHours).toBe(0);
    expect(res.body.availabilityWindows).toEqual([]);
    expect(res.body.ticketDensity).toBeNull();
    expect(replaceAvailability).toHaveBeenCalledWith(COMPANY_ID, AGENT_ID, 330, []);
  });

  it('returns 400 when companyId is not a well-formed UUID', async () => {
    const res = await request(app)
      .put(availabilityUrl(MALFORMED_COMPANY_ID, AGENT_ID))
      .send({ utcOffsetMinutes: 330, windows: [] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "'companyId' is not a well-formed UUID",
      code: 'BAD_REQUEST',
    });
    expect(findCompanyById).not.toHaveBeenCalled();
  });

  it('returns 400 when agentId is not a well-formed UUID', async () => {
    const res = await request(app)
      .put(availabilityUrl(COMPANY_ID, MALFORMED_AGENT_ID))
      .send({ utcOffsetMinutes: 330, windows: [] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "'agentId' is not a well-formed UUID",
      code: 'BAD_REQUEST',
    });
    expect(findCompanyById).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid utcOffsetMinutes', async () => {
    findCompanyById.mockResolvedValue(company);
    findAgentById.mockResolvedValue(agentA);

    const res = await request(app)
      .put(availabilityUrl(COMPANY_ID, AGENT_ID))
      .send({ utcOffsetMinutes: 9999, windows: [] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(replaceAvailability).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid window', async () => {
    findCompanyById.mockResolvedValue(company);
    findAgentById.mockResolvedValue(agentA);

    const res = await request(app)
      .put(availabilityUrl(COMPANY_ID, AGENT_ID))
      .send({
        utcOffsetMinutes: 330,
        windows: [{ dayOfWeek: 1, startMinute: 1020, endMinute: 540 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(replaceAvailability).not.toHaveBeenCalled();
  });

  it('returns 404 when the company does not exist', async () => {
    findCompanyById.mockResolvedValue(null);

    const res = await request(app)
      .put(availabilityUrl(UNKNOWN_COMPANY_ID, AGENT_ID))
      .send({ utcOffsetMinutes: 330, windows: [] });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Company not found',
      code: 'NOT_FOUND',
    });
    expect(findAgentById).not.toHaveBeenCalled();
  });

  it('returns 404 when the agent does not exist', async () => {
    findCompanyById.mockResolvedValue(company);
    findAgentById.mockResolvedValue(null);

    const res = await request(app)
      .put(availabilityUrl(COMPANY_ID, UNKNOWN_AGENT_ID))
      .send({ utcOffsetMinutes: 330, windows: [] });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Agent not found',
      code: 'NOT_FOUND',
    });
    expect(replaceAvailability).not.toHaveBeenCalled();
  });
});
