import { Request, Response, NextFunction } from 'express';
import TicketService from '../services/ticket.service.js';
import { Ticket } from '../types/domain.js';
import {
  AssignTicketResponse,
  CloseTicketResponse,
  CompanyParams,
  GetTicketsResponse,
  TicketDTO,
  TicketParams,
} from '../types/dto.js';

function toTicketDTO(ticket: Ticket): TicketDTO {
  return {
    id: ticket.id,
    status: ticket.status,
    assignedAgentId: ticket.assignedAgentId,
    assignedAt: ticket.assignedAt ? ticket.assignedAt.toISOString() : null,
    reason: ticket.reason,
    closedAt: ticket.closedAt ? ticket.closedAt.toISOString() : null,
  };
}

function toAssignResponse(ticket: Ticket): AssignTicketResponse {
  if (
    (ticket.status !== 'assigned' && ticket.status !== 'closed') ||
    !ticket.assignedAgentId ||
    !ticket.assignedAt ||
    !ticket.reason
  ) {
    throw new Error('Assigned ticket is missing required assignment fields');
  }

  return {
    ticketId: ticket.id,
    assignedAgentId: ticket.assignedAgentId,
    assignedAt: ticket.assignedAt.toISOString(),
    status: ticket.status,
    reason: ticket.reason,
  };
}

function toCloseResponse(ticket: Ticket): CloseTicketResponse {
  if (ticket.status !== 'closed' || !ticket.closedAt) {
    throw new Error('Closed ticket is missing closedAt');
  }

  return {
    ticketId: ticket.id,
    status: 'closed',
    closedAt: ticket.closedAt.toISOString(),
  };
}

export async function getTickets(
  req: Request<CompanyParams>,
  res: Response<GetTicketsResponse>,
  next: NextFunction
) {
  try {
    const { companyId } = req.params;
    const tickets = await TicketService.listTickets(companyId);
    res.status(200).json({ tickets: tickets.map(toTicketDTO) });
  } catch (err) {
    next(err);
  }
}

export async function assignTicket(
  req: Request<TicketParams>,
  res: Response<AssignTicketResponse>,
  next: NextFunction
) {
  try {
    const { companyId, ticketId } = req.params;
    const ticket = await TicketService.assignTicket(companyId, ticketId);
    res.status(200).json(toAssignResponse(ticket));
  } catch (err) {
    next(err);
  }
}

export async function closeTicket(
  req: Request<TicketParams>,
  res: Response<CloseTicketResponse>,
  next: NextFunction
) {
  try {
    const { companyId, ticketId } = req.params;
    const ticket = await TicketService.closeTicket(companyId, ticketId);
    res.status(200).json(toCloseResponse(ticket));
  } catch (err) {
    next(err);
  }
}
