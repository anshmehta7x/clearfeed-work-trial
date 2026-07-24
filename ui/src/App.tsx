import { useCallback, useEffect, useState } from 'react';
import { assignTicket, closeTicket, getAgents, getTickets, updateAvailability } from './api/api';
import { AgentCards } from './components/AgentCards';
import { CoverageChart } from './components/CoverageChart';
import { EditAvailabilityModal } from './components/EditAvailabilityModal';
import { StatsBar } from './components/StatsBar';
import { TicketsTable } from './components/TicketsTable';
import type { Agent, LocalAvailabilityWindow, Ticket } from './types';

const COMPANY_ID = '11111111-1111-1111-1111-111111111111';

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const refresh = useCallback(async () => {
    const [agentsResult, ticketsResult] = await Promise.all([
      getAgents(COMPANY_ID),
      getTickets(COMPANY_ID),
    ]);
    setAgents(agentsResult.agents);
    setTickets(ticketsResult.tickets);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [refresh]);

  async function handleAssign(ticketId: string) {
    await assignTicket(COMPANY_ID, ticketId);
    await refresh();
  }

  async function handleClose(ticketId: string) {
    await closeTicket(COMPANY_ID, ticketId);
    await refresh();
  }

  async function handleSaveAvailability(
    agentId: string,
    utcOffsetMinutes: number,
    windows: LocalAvailabilityWindow[],
  ) {
    await updateAvailability(COMPANY_ID, agentId, { utcOffsetMinutes, windows });
    await refresh();
  }

  if (loading) {
    return <div className="p-8 text-text-muted">Loading...</div>;
  }

  if (error) {
    return <div className="p-8 text-rust">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-ink">
      <StatsBar agents={agents} tickets={tickets} />
      <CoverageChart agents={agents} />
      <AgentCards
        agents={agents}
        tickets={tickets}
        onEditAvailability={setEditingAgent}
      />
      <TicketsTable
        tickets={tickets}
        agents={agents}
        onAssign={handleAssign}
        onClose={handleClose}
      />
      {editingAgent && (
        <EditAvailabilityModal
          agent={editingAgent}
          onClose={() => setEditingAgent(null)}
          onSave={handleSaveAvailability}
        />
      )}
    </div>
  );
}
