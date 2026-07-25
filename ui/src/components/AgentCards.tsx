import { useMemo } from 'react';
import type { Agent, Ticket } from '../types';
import { AgentCard } from './AgentCard';

interface AgentCardsProps {
  agents: Agent[];
  tickets: Ticket[];
  onEditAvailability: (agent: Agent) => void;
}

export function AgentCards({ agents, tickets, onEditAvailability }: AgentCardsProps) {
  const activeByAgent = useMemo(() => {
    const map = new Map<string, Ticket[]>();
    for (const ticket of tickets) {
      if (ticket.status !== 'assigned' || !ticket.assignedAgentId) continue;
      const list = map.get(ticket.assignedAgentId) ?? [];
      list.push(ticket);
      map.set(ticket.assignedAgentId, list);
    }
    return map;
  }, [tickets]);

  return (
    <section id="agents" className="py-10 scroll-mt-4">
      <div className="max-w-[1100px] mx-auto px-8">
        <h2 className="text-2xl">Agents</h2>
        <p className="text-xs text-text-muted font-mono mt-1 mb-5">
          Density threshold 0.25 · excess load when at or above
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              activeTickets={activeByAgent.get(agent.id) ?? []}
              onEditAvailability={onEditAvailability}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
