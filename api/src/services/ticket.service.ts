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

export const ASSIGN_REASON_ELIGIBLE = 'Available';
export const ASSIGN_REASON_FALLBACK = 'Fallback:';
export const ASSIGN_REASON_LAST_RESORT = 'Last resort:';

export interface AssignmentChoice {
  agent: AgentWithWorkload;
  reason: string;
}

type SortKey = number | string;

/** In-memory per-company FIFO queue. Single-process only. */
const companyQueueTails = new Map<string, Promise<void>>();

function enqueueCompanyWork<T>(companyId: string, work: () => Promise<T>): Promise<T> {
  // Lowercase so mixed-case UUID strings share one queue (Postgres treats them as equal).
  const queueKey = companyId.toLowerCase();
  const previous = companyQueueTails.get(queueKey) ?? Promise.resolve();
  const result = previous.then(work, work);
  const tail = result.then(
    () => undefined,
    () => undefined
  );
  companyQueueTails.set(queueKey, tail);
  void tail.then(() => {
    // A newer operation may have replaced this tail while work was running.
    if (companyQueueTails.get(queueKey) === tail) {
      companyQueueTails.delete(queueKey);
    }
  });
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

function formatDensity(density: number | null): string {
  if (density === null) return 'n/a';
  return density.toFixed(3);
}

function eligibleReason(selected: AgentWithWorkload, eligible: AgentWithWorkload[]): string {
  const density = selected.ticketDensity as number;
  const densityTies = eligible.filter((a) => a.ticketDensity === density);
  if (densityTies.length === 1) {
    return `Available; lowest ticket density (${formatDensity(density)})`;
  }

  const lastKey = lastAssignedSortKey(selected);
  const lastTies = densityTies.filter((a) => lastAssignedSortKey(a) === lastKey);
  if (lastTies.length === 1) {
    return `Available; tied on density (${formatDensity(density)}), least recently assigned`;
  }

  return `Available; tied on density (${formatDensity(density)}) and last assignment, lowest agent ID`;
}

function fallbackReason(
  selected: AgentWithWorkload,
  nextWindowStart: Date,
  candidates: Array<{ agent: AgentWithWorkload; nextWindowStart: Date }>,
  now: Date
): string {
  const availableNow = isCurrentlyAvailable(selected.availabilityWindows, now);
  const overThreshold =
    selected.ticketDensity !== null && selected.ticketDensity >= MAX_DENSITY_THRESHOLD;

  let situation: string;
  if (availableNow && overThreshold) {
    situation = `available but at/above density threshold (${formatDensity(selected.ticketDensity)})`;
  } else if (availableNow) {
    situation = 'outside eligibility';
  } else {
    situation = 'not currently available; next window soonest';
  }

  const soonest = nextWindowStart.getTime();
  const soonestTies = candidates.filter((c) => c.nextWindowStart.getTime() === soonest);
  if (soonestTies.length === 1) {
    return `Fallback: ${situation}; assigned to guarantee ownership`;
  }

  const density = selected.ticketDensity ?? Number.POSITIVE_INFINITY;
  const densityTies = soonestTies.filter(
    (c) => (c.agent.ticketDensity ?? Number.POSITIVE_INFINITY) === density
  );
  if (densityTies.length === 1) {
    return `Fallback: ${situation}; tied on next window, lowest density (${formatDensity(selected.ticketDensity)}); assigned to guarantee ownership`;
  }

  const lastKey = lastAssignedSortKey(selected);
  const lastTies = densityTies.filter((c) => lastAssignedSortKey(c.agent) === lastKey);
  if (lastTies.length === 1) {
    return `Fallback: ${situation}; tied on next window and density, least recently assigned; assigned to guarantee ownership`;
  }

  return `Fallback: ${situation}; tied on next window, density, and last assignment, lowest agent ID; assigned to guarantee ownership`;
}

function lastResortReason(selected: AgentWithWorkload, agents: AgentWithWorkload[]): string {
  const count = selected.activeTicketCount;
  const countTies = agents.filter((a) => a.activeTicketCount === count);
  if (countTies.length === 1) {
    return `Last resort: no availability configured, so availability and capacity could not be respected; fewest active tickets (${count}); assigned to guarantee ownership`;
  }

  const lastKey = lastAssignedSortKey(selected);
  const lastTies = countTies.filter((a) => lastAssignedSortKey(a) === lastKey);
  if (lastTies.length === 1) {
    return `Last resort: no availability configured, so availability and capacity could not be respected; tied on active tickets (${count}), least recently assigned; assigned to guarantee ownership`;
  }

  return `Last resort: no availability configured, so availability and capacity could not be respected; tied on active tickets and last assignment, lowest agent ID; assigned to guarantee ownership`;
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
    const selected = pickBy(eligibleAgents, [
      (a) => a.ticketDensity as number,
      lastAssignedSortKey,
      (a) => a.id,
    ]);
    return {
      agent: selected,
      reason: eligibleReason(selected, eligibleAgents),
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
      reason: fallbackReason(selected.agent, selected.nextWindowStart, withNextWindow, now),
    };
  }

  const selected = pickBy(agents, [
    (a) => a.activeTicketCount,
    lastAssignedSortKey,
    (a) => a.id,
  ]);
  return {
    agent: selected,
    reason: lastResortReason(selected, agents),
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
