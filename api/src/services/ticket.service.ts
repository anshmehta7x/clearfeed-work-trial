import CompanyRepository from '../repositories/company.repository.js';
import AgentRepository from '../repositories/agent.repository.js';
import TicketRepository from '../repositories/ticket.repository.js';
import {
  computeNextWindowStart,
  isCurrentlyAvailable,
} from '../lib/availability.js';
import { buildAgentWithWorkload } from '../lib/workload.js';
import type { AgentWithWorkload, Ticket } from '../types/domain.js';
import { ApiError } from '../types/errors.js';

export const MAX_DENSITY_THRESHOLD = 0.25;

export const ASSIGN_REASON_ELIGIBLE =
  'Assigned based on availability and lowest ticket density';
export const ASSIGN_REASON_FALLBACK =
  'Fallback: assigned outside eligibility (capacity and/or availability) to guarantee ownership';
export const ASSIGN_REASON_LAST_RESORT =
  'Last resort: no availability configured; assigned to guarantee ownership';

export interface AssignmentChoice {
  agent: AgentWithWorkload;
  reason: string;
}

type SortKey = number | string;

/** In-memory per-company FIFO queue. Single-process only. */
const companyQueueTails = new Map<string, Promise<void>>();

function enqueueCompanyWork<T>(companyId: string, work: () => Promise<T>): Promise<T> {
  const previous = companyQueueTails.get(companyId) ?? Promise.resolve();
  const result = previous.then(work, work);
  companyQueueTails.set(
    companyId,
    result.then(
      () => undefined,
      () => undefined
    )
  );
  return result;
}

function pickBy<T>(items: T[], keys: Array<(item: T) => SortKey>): T {
  if (items.length === 0) {
    throw new Error('pickBy requires at least one item');
  }

  return [...items].sort((a, b) => {
    for (const key of keys) {
      const av = key(a);
      const bv = key(b);
      if (av < bv) return -1;
      if (av > bv) return 1;
    }
    return 0;
  })[0]!;
}

function lastAssignedSortKey(agent: AgentWithWorkload): number {
  return agent.lastAssignedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
}

/**
 * Pure selection for an unassigned ticket.
 * Exported for unit tests; callers must pass a non-empty agent list.
 */
export function selectAgentForAssignment(
  agents: AgentWithWorkload[],
  now: Date
): AssignmentChoice {
  if (agents.length === 0) {
    throw new Error('selectAgentForAssignment requires at least one agent');
  }

  const eligibleAgents = agents.filter(
    (agent) =>
      agent.scheduledWeeklyHours > 0 &&
      agent.ticketDensity !== null &&
      agent.ticketDensity < MAX_DENSITY_THRESHOLD &&
      isCurrentlyAvailable(agent.availabilityWindows, now)
  );

  if (eligibleAgents.length > 0) {
    return {
      agent: pickBy(eligibleAgents, [
        (a) => a.ticketDensity as number,
        lastAssignedSortKey,
        (a) => a.id,
      ]),
      reason: ASSIGN_REASON_ELIGIBLE,
    };
  }

  const agentsWithAvailability = agents.filter((a) => a.scheduledWeeklyHours > 0);

  if (agentsWithAvailability.length > 0) {
    const withNextWindow = agentsWithAvailability.map((agent) => ({
      agent,
      nextWindowStart: computeNextWindowStart(agent.availabilityWindows, now),
    }));

    const selected = pickBy(withNextWindow, [
      (a) => a.nextWindowStart.getTime(),
      (a) => a.agent.ticketDensity ?? Number.POSITIVE_INFINITY,
      (a) => lastAssignedSortKey(a.agent),
      (a) => a.agent.id,
    ]);

    return {
      agent: selected.agent,
      reason: ASSIGN_REASON_FALLBACK,
    };
  }

  return {
    agent: pickBy(agents, [
      (a) => a.activeTicketCount,
      lastAssignedSortKey,
      (a) => a.id,
    ]),
    reason: ASSIGN_REASON_LAST_RESORT,
  };
}

export default class TicketService {
  static async listTickets(companyId: string): Promise<Ticket[]> {
    const company = await CompanyRepository.findById(companyId);
    if (!company) {
      throw new ApiError('NOT_FOUND', 'Company not found');
    }

    return TicketRepository.findByCompany(companyId);
  }

  static async assignTicket(companyId: string, ticketId: string): Promise<Ticket> {
    return enqueueCompanyWork(companyId, () => this.assignTicketQueued(companyId, ticketId));
  }

  static async closeTicket(companyId: string, ticketId: string): Promise<Ticket> {
    return enqueueCompanyWork(companyId, () => this.closeTicketQueued(companyId, ticketId));
  }

  private static async assignTicketQueued(
    companyId: string,
    ticketId: string
  ): Promise<Ticket> {
    const company = await CompanyRepository.findById(companyId);
    if (!company) {
      throw new ApiError('NOT_FOUND', 'Company not found');
    }

    const ticket = await TicketRepository.findById(companyId, ticketId);
    if (!ticket) {
      throw new ApiError('NOT_FOUND', 'Ticket not found');
    }

    if (ticket.status === 'assigned' || ticket.status === 'closed') {
      return ticket;
    }

    const { agents, windowsByAgent, activeCountByAgent } =
      await AgentRepository.loadCompanyAgentsData(companyId);

    if (agents.length === 0) {
      throw new ApiError('UNPROCESSABLE', 'Company has no agents configured');
    }

    const agentsWithWorkload = agents.map((agent) =>
      buildAgentWithWorkload(
        agent,
        windowsByAgent.get(agent.id) ?? [],
        activeCountByAgent.get(agent.id) ?? 0
      )
    );

    const now = new Date();
    const { agent, reason } = selectAgentForAssignment(agentsWithWorkload, now);

    const claimed = await TicketRepository.claimAssignment(
      companyId,
      ticketId,
      agent.id,
      now,
      reason
    );

    if (!claimed) {
      const winner = await TicketRepository.findById(companyId, ticketId);
      if (!winner) {
        throw new ApiError('NOT_FOUND', 'Ticket not found');
      }
      return winner;
    }

    return claimed;
  }

  private static async closeTicketQueued(
    companyId: string,
    ticketId: string
  ): Promise<Ticket> {
    const company = await CompanyRepository.findById(companyId);
    if (!company) {
      throw new ApiError('NOT_FOUND', 'Company not found');
    }

    const ticket = await TicketRepository.findById(companyId, ticketId);
    if (!ticket) {
      throw new ApiError('NOT_FOUND', 'Ticket not found');
    }

    if (ticket.status === 'closed') {
      return ticket;
    }

    if (ticket.status === 'unassigned') {
      throw new ApiError('CONFLICT', 'Ticket is unassigned and cannot be closed');
    }

    const closed = await TicketRepository.closeAssigned(companyId, ticketId, new Date());
    if (!closed) {
      // Status changed between read and write; re-fetch and resolve.
      const current = await TicketRepository.findById(companyId, ticketId);
      if (!current) {
        throw new ApiError('NOT_FOUND', 'Ticket not found');
      }
      if (current.status === 'closed') {
        return current;
      }
      if (current.status === 'unassigned') {
        throw new ApiError('CONFLICT', 'Ticket is unassigned and cannot be closed');
      }
      throw new Error('Failed to close assigned ticket');
    }

    return closed;
  }
}
