import type { Agent, Ticket } from '../types';
import { formatOffset } from '../lib/coverage';
import {
  densityBarPercent,
  formatDensity,
  isExcessLoad,
  shortAgentId,
} from '../lib/workload';

interface AgentCardProps {
  agent: Agent;
  activeTickets: Ticket[];
  onEditAvailability: (agent: Agent) => void;
}

export function AgentCard({ agent, activeTickets, onEditAvailability }: AgentCardProps) {
  const excess = isExcessLoad(agent.ticketDensity);
  const barPercent = densityBarPercent(agent.ticketDensity);

  return (
    <article className="bg-panel border border-line rounded-[var(--radius-card)] p-[18px] flex flex-col">
      <div className="flex justify-between items-baseline mb-2.5">
        <span className="font-semibold text-base">{agent.name}</span>
        <span className="font-mono text-xs text-text-muted">{shortAgentId(agent.id)}</span>
      </div>

      <p className="font-mono text-xs text-text-muted mb-2">
        {formatOffset(agent.utcOffsetMinutes)}
      </p>

      <div className="h-1.5 rounded-pill bg-line overflow-hidden my-2">
        <span
          className={`block h-full ${excess ? 'bg-rust' : 'bg-sage'}`}
          style={{ width: `${barPercent}%` }}
        />
      </div>

      <div className="flex justify-between items-center font-mono text-xs text-text-muted">
        <span>{formatDensity(agent.ticketDensity)} density</span>
        <span>{agent.scheduledWeeklyHours}h/wk</span>
      </div>

      {excess && (
        <p className="text-rust font-semibold text-xs mt-1.5">Excess load</p>
      )}

      <div className="mt-3 flex-1 min-h-0">
        <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-1.5">
          Active tickets ({activeTickets.length})
        </p>
        {activeTickets.length === 0 ? (
          <p className="text-xs text-text-muted italic">None</p>
        ) : (
          <ul className="space-y-1 max-h-24 overflow-y-auto pr-1">
            {activeTickets.map((ticket) => (
              <li key={ticket.id} className="font-mono text-xs text-text-muted truncate">
                {shortAgentId(ticket.id).replace('#', '#T-')}
                {ticket.reason ? (
                  <span className="italic ml-1 opacity-80">· {ticket.reason}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => onEditAvailability(agent)}
        className="mt-3.5 w-full bg-transparent border border-amber text-amber py-2 rounded-md text-[13px] cursor-pointer hover:bg-amber-dim/40 transition-colors"
      >
        Edit availability
      </button>
    </article>
  );
}
