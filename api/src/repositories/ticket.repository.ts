import pool from '../db/pool.js';
import { Company, Ticket } from '../types/domain.js';

function toTicket(row: any): Ticket {
  return {
    id: row.id,
    companyId: row.company_id,
    status: row.status,
    assignedAgentId: row.assigned_agent_id,
    assignedAt: row.assigned_at,
    reason: row.reason,
    closedAt: row.closed_at,
  };
}

export default class TicketRepository {
  static async findByCompany(companyId: string): Promise<Ticket[]> {
    const { rows } = await pool.query(
      `SELECT id, company_id, status, assigned_agent_id, assigned_at, reason, closed_at
       FROM ticket
       WHERE company_id = $1
       ORDER BY assigned_at NULLS FIRST, id`,
      [companyId]
    );
    return rows.map(toTicket);
  }
}
