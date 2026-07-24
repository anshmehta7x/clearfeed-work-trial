import { Request, Response, NextFunction } from 'express';
import { GetAgentsResponse, AgentDTO } from '../types/dto.js';
import { AgentWithWorkload } from '../types/domain.js';
import { CompanyParams } from '../types/dto.js';
import CompanyRepository from '../repositories/company.repository.js';
import AgentRepository from '../repositories/agent.repository.js';
import { ApiError } from '../types/errors.js';

function toAgentDTO(agent: AgentWithWorkload): AgentDTO {
  return {
    id: agent.id,
    name: agent.name,
    utcOffsetMinutes: agent.utcOffsetMinutes,
    scheduledWeeklyHours: agent.scheduledWeeklyHours,
    activeTicketCount: agent.activeTicketCount,
    ticketDensity: agent.ticketDensity,
    lastAssignedAt: agent.lastAssignedAt ? agent.lastAssignedAt.toISOString() : null,
    availabilityWindows: agent.availabilityWindows,
  };
}

export async function getAgents(
  req: Request<CompanyParams>,
  res: Response<GetAgentsResponse>,
  next: NextFunction
) {
  try {
    const { companyId } = req.params;

    const company = await CompanyRepository.findById(companyId);
    if (!company) {
      throw new ApiError('NOT_FOUND', 'Company not found');
    }

    const agents = await AgentRepository.findByCompanyWithWorkload(companyId);
    res.status(200).json({ agents: agents.map(toAgentDTO) });
  } catch (err) {
    next(err);
  }
}
