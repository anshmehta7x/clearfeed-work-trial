import { Request, Response, NextFunction } from 'express';
import CompanyRepository from '../repositories/company.repository.js';
import TicketRepository from '../repositories/ticket.repository.js';
import { Company, Ticket} from '../types/domain.js';
import {
  GetTicketsResponse,
  TicketDTO,
  TicketParams,
} from '../types/dto.js';
import { ApiError } from '../types/errors.js';


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

export async function getTickets(
  req: Request<TicketParams>,
  res: Response<GetTicketsResponse>,
  next: NextFunction) {
  try {
    const { companyId } = req.params;
    if(typeof companyId !== 'string') {
      throw new ApiError('BAD_REQUEST', 'companyId must be a string');
    }

    const company: Company | null = await CompanyRepository.findById(companyId);
    if (!company) {
      throw new ApiError('NOT_FOUND', 'Company not found');
    }
    const tickets = await TicketRepository.findByCompany(companyId);
    res.status(200).json({ tickets: tickets.map(toTicketDTO) });

  } catch (error) {
    next(error);
  }
}
