import { useRef, useState } from 'react';
import type { Agent, Ticket } from '../types';
import { shortAgentId } from '../lib/workload';
import { StatusPill } from './StatusPill';

interface TicketsTableProps {
  tickets: Ticket[];
  agents: Agent[];
  onAssign: (ticketId: string) => Promise<void>;
  onClose: (ticketId: string) => Promise<void>;
}

function agentLabel(agents: Agent[], agentId: string | null): string {
  if (!agentId) return '—';
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return shortAgentId(agentId);
  return `${shortAgentId(agent.id)} ${agent.name}`;
}

function formatAssignedAt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TicketsTable({ tickets, agents, onAssign, onClose }: TicketsTableProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const actionLocked = useRef(false);

  async function runAction(ticketId: string, action: () => Promise<void>) {
    if (actionLocked.current) return;
    actionLocked.current = true;
    setBusyId(ticketId);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      actionLocked.current = false;
      setBusyId(null);
    }
  }

  return (
    <section id="tickets" className="py-10 pb-16 scroll-mt-4">
      <div className="max-w-[1100px] mx-auto px-8">
        <h2 className="text-2xl">Tickets</h2>
        <p className="text-xs text-text-muted font-mono mt-1 mb-5">
          Assign invokes the assignment API · Close removes from active workload
        </p>

        {actionError && (
          <p className="mb-4 text-sm text-rust" role="alert">
            {actionError}
          </p>
        )}

        <div className="overflow-x-auto border border-line rounded-[var(--radius-card)] bg-panel">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {['Ticket', 'Status', 'Agent', 'Assigned', 'Reason', ''].map((header) => (
                  <th
                    key={header || 'action'}
                    className="text-left font-mono font-medium text-text-muted uppercase text-[11px] tracking-wider border-b border-line px-3 py-2.5"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-text-muted italic">
                    No tickets
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => {
                  const busy = busyId === ticket.id;
                  const actionsDisabled = busyId !== null;
                  return (
                    <tr key={ticket.id}>
                      <td className="font-mono px-3 py-3 border-b border-line align-middle">
                        {shortAgentId(ticket.id).replace('#', '#T-')}
                      </td>
                      <td className="px-3 py-3 border-b border-line align-middle">
                        <StatusPill status={ticket.status} />
                      </td>
                      <td className="font-mono px-3 py-3 border-b border-line align-middle whitespace-nowrap">
                        {agentLabel(agents, ticket.assignedAgentId)}
                      </td>
                      <td className="font-mono px-3 py-3 border-b border-line align-middle whitespace-nowrap text-text-muted">
                        {formatAssignedAt(ticket.assignedAt)}
                      </td>
                      <td className="px-3 py-3 border-b border-line align-middle italic text-text-muted max-w-xs">
                        {ticket.reason ?? '—'}
                      </td>
                      <td className="px-3 py-3 border-b border-line align-middle text-right whitespace-nowrap">
                        {ticket.status === 'unassigned' && (
                          <button
                            type="button"
                            disabled={actionsDisabled}
                            onClick={() => runAction(ticket.id, () => onAssign(ticket.id))}
                            className="bg-amber text-ink border-none px-3.5 py-1.5 rounded-md font-semibold cursor-pointer disabled:opacity-50"
                          >
                            {busy ? '…' : 'Assign'}
                          </button>
                        )}
                        {ticket.status === 'assigned' && (
                          <button
                            type="button"
                            disabled={actionsDisabled}
                            onClick={() => runAction(ticket.id, () => onClose(ticket.id))}
                            className="bg-transparent border border-line text-text-muted px-3.5 py-1.5 rounded-md cursor-pointer disabled:opacity-50"
                          >
                            {busy ? '…' : 'Close'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
