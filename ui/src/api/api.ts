import type { Agent, AssignTicketResponse, CloseTicketResponse, Ticket, UpdateAvailabilityRequest } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status}: ${body || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function getAgents(companyId: string): Promise<{ agents: Agent[] }> {
  return fetchJson<{ agents: Agent[] }>(`/companies/${companyId}/agents`);
}

export function getTickets(companyId: string): Promise<{ tickets: Ticket[] }> {
  return fetchJson<{ tickets: Ticket[] }>(`/companies/${companyId}/tickets`);
}

export function updateAvailability(
  companyId: string,
  agentId: string,
  request: UpdateAvailabilityRequest,
): Promise<Agent> {
  return fetchJson<Agent>(`/companies/${companyId}/agents/${agentId}/availability`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export function assignTicket(
  companyId: string,
  ticketId: string,
): Promise<AssignTicketResponse> {
  return fetchJson<AssignTicketResponse>(`/companies/${companyId}/tickets/${ticketId}/assign`, {
    method: 'POST',
  });
}

export function closeTicket(
  companyId: string,
  ticketId: string,
): Promise<CloseTicketResponse> {
  return fetchJson<CloseTicketResponse>(`/companies/${companyId}/tickets/${ticketId}/close`, {
    method: 'POST',
  });
}
