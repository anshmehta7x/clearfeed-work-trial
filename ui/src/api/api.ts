import type { Agent, AssignTicketResponse, CloseTicketResponse, Ticket, UpdateAvailabilityRequest } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function readErrorMessage(response: Response): Promise<string> {
  const body = await response.text();
  if (!body) return response.statusText || `HTTP ${response.status}`;

  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.length > 0) {
      return parsed.error;
    }
  } catch {
    // Non-JSON errors fall back to their raw response body.
  }

  return body;
}

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options?.headers);
  if (options?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
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
