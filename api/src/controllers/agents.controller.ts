import { Request, Response, NextFunction } from 'express';
import {
  GetAgentsResponse,
  AgentDTO,
  CompanyParams,
  AgentParams,
  UpdateAvailabilityRequest,
} from '../types/dto.js';
import { AgentWithWorkload } from '../types/domain.js';
import AgentService from '../services/agent.service.js';

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
    const agents = await AgentService.listAgents(companyId);
    res.status(200).json({ agents: agents.map(toAgentDTO) });
  } catch (err) {
    next(err);
  }
}

export async function updateAvailability(
  req: Request<AgentParams, AgentDTO, UpdateAvailabilityRequest>,
  res: Response<AgentDTO>,
  next: NextFunction
) {
  try {
    const { companyId, agentId } = req.params;
    const agent = await AgentService.updateAvailability(companyId, agentId, req.body);
    res.status(200).json(toAgentDTO(agent));
  } catch (err) {
    next(err);
  }
}
