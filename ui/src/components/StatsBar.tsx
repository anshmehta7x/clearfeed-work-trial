import type { Agent, Ticket } from '../types';

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
    <div className="flex bg-paper text-ink-on-paper border-b-2 border-dashed border-line-on-paper px-8 py-6">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={`flex-1 px-6 ${index > 0 ? 'border-l border-line-on-paper' : ''}`}
        >
          <span className="block font-mono font-semibold text-2xl">{stat.value}</span>
          <span className="block text-xs font-semibold uppercase tracking-wider text-ink-on-paper-muted">
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
}
