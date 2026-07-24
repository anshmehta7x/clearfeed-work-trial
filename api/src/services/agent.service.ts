import CompanyRepository from '../repositories/company.repository.js';
import AgentRepository from '../repositories/agent.repository.js';
import {
  assertValidLocalWindows,
  assertValidUtcOffset,
  localWindowsToUtc,
} from '../lib/availability.js';
import { buildAgentWithWorkload } from '../lib/workload.js';
import type { AgentWithWorkload } from '../types/domain.js';
import { ApiError } from '../types/errors.js';

export default class AgentService {
  static async listAgents(companyId: string): Promise<AgentWithWorkload[]> {
    const company = await CompanyRepository.findById(companyId);
    if (!company) {
      throw new ApiError('NOT_FOUND', 'Company not found');
    }

    const { agents, windowsByAgent, activeCountByAgent } =
      await AgentRepository.loadCompanyAgentsData(companyId);

    return agents.map((agent) =>
      buildAgentWithWorkload(
        agent,
        windowsByAgent.get(agent.id) ?? [],
        activeCountByAgent.get(agent.id) ?? 0
      )
    );
  }

  static async updateAvailability(
    companyId: string,
    agentId: string,
    input: { utcOffsetMinutes: unknown; windows: unknown }
  ): Promise<AgentWithWorkload> {
    const company = await CompanyRepository.findById(companyId);
    if (!company) {
      throw new ApiError('NOT_FOUND', 'Company not found');
    }

    const agent = await AgentRepository.findById(companyId, agentId);
    if (!agent) {
      throw new ApiError('NOT_FOUND', 'Agent not found');
    }

    assertValidUtcOffset(input.utcOffsetMinutes);
    assertValidLocalWindows(input.windows);

    const utcWindows = localWindowsToUtc(input.windows, input.utcOffsetMinutes);

    const replaced = await AgentRepository.replaceAvailability(
      companyId,
      agentId,
      input.utcOffsetMinutes,
      utcWindows
    );
    if (!replaced) {
      // Agent was present moments earlier; treat as an unexpected race, not a client 404.
      throw new Error('Failed to replace agent availability');
    }

    const data = await AgentRepository.loadAgentData(companyId, agentId);
    if (!data) {
      throw new Error('Failed to load agent after replacing availability');
    }

    return buildAgentWithWorkload(data.agent, data.windows, data.activeTicketCount);
  }
}
