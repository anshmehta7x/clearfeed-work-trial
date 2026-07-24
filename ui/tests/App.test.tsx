import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assignTicket,
  closeTicket,
  getAgents,
  getTickets,
  updateAvailability,
} from '../src/api/api';
import App from '../src/App';
import type { Agent, Ticket } from '../src/types';

vi.mock('../src/api/api', () => ({
  assignTicket: vi.fn(),
  closeTicket: vi.fn(),
  getAgents: vi.fn(),
  getTickets: vi.fn(),
  updateAvailability: vi.fn(),
}));

const COMPANY_ID = '11111111-1111-1111-1111-111111111111';
const AGENT_ID = '22222222-2222-2222-2222-222222222221';
const TICKET_ID = '33333333-3333-3333-3333-333333333331';

const agent: Agent = {
  id: AGENT_ID,
  name: 'Agent A',
  utcOffsetMinutes: 0,
  scheduledWeeklyHours: 8,
  activeTicketCount: 0,
  ticketDensity: 0,
  lastAssignedAt: null,
  availabilityWindows: [{ startMinuteUtc: 540, durationMinutes: 480 }],
};

const unassignedTicket: Ticket = {
  id: TICKET_ID,
  status: 'unassigned',
  assignedAgentId: null,
  assignedAt: null,
  reason: null,
  closedAt: null,
};

const assignedTicket: Ticket = {
  ...unassignedTicket,
  status: 'assigned',
  assignedAgentId: AGENT_ID,
  assignedAt: '2026-07-24T12:00:00.000Z',
  reason: 'Assigned based on availability and lowest ticket density',
};

const closedTicket: Ticket = {
  ...assignedTicket,
  status: 'closed',
  closedAt: '2026-07-24T13:00:00.000Z',
};

const mockGetAgents = vi.mocked(getAgents);
const mockGetTickets = vi.mocked(getTickets);
const mockAssignTicket = vi.mocked(assignTicket);
const mockCloseTicket = vi.mocked(closeTicket);
const mockUpdateAvailability = vi.mocked(updateAvailability);

describe('dashboard flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgents.mockResolvedValue({ agents: [agent] });
    mockGetTickets.mockResolvedValue({ tickets: [unassignedTicket] });
    mockAssignTicket.mockResolvedValue({
      ticketId: TICKET_ID,
      assignedAgentId: AGENT_ID,
      assignedAt: assignedTicket.assignedAt!,
      status: 'assigned',
      reason: assignedTicket.reason!,
    });
    mockCloseTicket.mockResolvedValue({
      ticketId: TICKET_ID,
      status: 'closed',
      closedAt: closedTicket.closedAt!,
    });
    mockUpdateAvailability.mockResolvedValue(agent);
  });

  it('loads the dashboard sections and API data', async () => {
    render(<App />);

    expect((await screen.findAllByText('Agent A')).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Coverage' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Agents' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tickets' })).toBeInTheDocument();
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0);
    expect(mockGetAgents).toHaveBeenCalledWith(COMPANY_ID);
    expect(mockGetTickets).toHaveBeenCalledWith(COMPANY_ID);
  });

  it('assigns a ticket and refreshes the dashboard', async () => {
    mockGetTickets
      .mockResolvedValueOnce({ tickets: [unassignedTicket] })
      .mockResolvedValue({ tickets: [assignedTicket] });

    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Assign' }));

    await waitFor(() => {
      expect(mockAssignTicket).toHaveBeenCalledWith(COMPANY_ID, TICKET_ID);
      expect(mockGetTickets).toHaveBeenCalledTimes(2);
    });
    expect((await screen.findAllByText('Assigned')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(assignedTicket.reason!).length).toBeGreaterThan(0);

    const ticketIdCell = screen
      .getAllByText('#T-3331')
      .find((element) => element.getAttribute('title') === `Ticket ID: ${TICKET_ID}`);
    expect(ticketIdCell).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByText(TICKET_ID)).toBeInTheDocument();
    expect(screen.getByText(AGENT_ID)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide details' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('closes an assigned ticket and refreshes active workload', async () => {
    mockGetTickets
      .mockResolvedValueOnce({ tickets: [assignedTicket] })
      .mockResolvedValue({ tickets: [closedTicket] });

    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(mockCloseTicket).toHaveBeenCalledWith(COMPANY_ID, TICKET_ID);
      expect(mockGetTickets).toHaveBeenCalledTimes(2);
    });
    expect((await screen.findAllByText('Closed')).length).toBeGreaterThan(0);
  });

  it('saves edited availability and refreshes the agent', async () => {
    const updatedAgent: Agent = {
      ...agent,
      utcOffsetMinutes: 60,
      availabilityWindows: [{ startMinuteUtc: 540, durationMinutes: 480 }],
    };
    mockGetAgents
      .mockResolvedValueOnce({ agents: [agent] })
      .mockResolvedValue({ agents: [updatedAgent] });
    mockUpdateAvailability.mockResolvedValue(updatedAgent);

    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Edit availability' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit availability' });
    const timezone = within(dialog).getByRole('combobox', { name: /Timezone/ });
    const startTime = within(dialog).getByRole('textbox', { name: 'Sunday window 1 start time' });
    const endTime = within(dialog).getByRole('textbox', { name: 'Sunday window 1 end time' });

    await user.selectOptions(timezone, '60');
    await user.clear(startTime);
    await user.type(startTime, '10:07');
    await user.clear(endTime);
    await user.type(endTime, '18:13');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockUpdateAvailability).toHaveBeenCalledWith(
        COMPANY_ID,
        AGENT_ID,
        {
          utcOffsetMinutes: 60,
          windows: [{ dayOfWeek: 0, startMinute: 607, endMinute: 1093 }],
        },
      );
      expect(mockGetAgents).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('UTC+1').length).toBeGreaterThan(0);
  });
});
