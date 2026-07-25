import type { Agent, Ticket } from '../types';
import { ThemeToggle } from './ThemeToggle';

interface StatsBarProps {
  agents: Agent[];
  tickets: Ticket[];
}

function countTickets(tickets: Ticket[], status: Ticket['status']): number {
  return tickets.filter((ticket) => ticket.status === status).length;
}

export function StatsBar({ agents, tickets }: StatsBarProps) {
  const activeCount = countTickets(tickets, 'assigned');
  const unassignedCount = countTickets(tickets, 'unassigned');
  const closedCount = countTickets(tickets, 'closed');

  const stats = [
    { label: 'Agents', value: agents.length },
    { label: 'Tickets', value: tickets.length },
    { label: 'Active', value: activeCount },
    { label: 'Unassigned', value: unassignedCount },
    { label: 'Closed', value: closedCount },
  ];

  return (
    <div className="bg-ink text-text border-b border-line">
      <div className="flex items-center justify-end gap-2 px-8 pt-4">
        <a
          href="#coverage"
          className="px-3 py-1.5 rounded-md border border-line text-xs font-semibold uppercase tracking-wider text-text-muted hover:border-amber hover:text-amber transition-colors"
        >
          Coverage
        </a>
        <a
          href="#agents"
          className="px-3 py-1.5 rounded-md border border-line text-xs font-semibold uppercase tracking-wider text-text-muted hover:border-amber hover:text-amber transition-colors"
        >
          Agents
        </a>
        <a
          href="#tickets"
          className="px-3 py-1.5 rounded-md border border-line text-xs font-semibold uppercase tracking-wider text-text-muted hover:border-amber hover:text-amber transition-colors"
        >
          Tickets
        </a>
        <ThemeToggle />
      </div>
      <div className="flex px-8 py-6">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`flex-1 px-6 ${index > 0 ? 'border-l border-line' : ''}`}
          >
            <span className="block font-mono font-semibold text-2xl">{stat.value}</span>
            <span className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
