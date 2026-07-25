import pool from '../db/pool.js';
import { Ticket, TicketStatus } from '../types/domain.js';

interface TicketRow {
  id: string;
  company_id: string;
  status: TicketStatus;
  assigned_agent_id: string | null;
  assigned_at: Date | null;
  reason: string | null;
  closed_at: Date | null;
}

function toTicket(row: TicketRow): Ticket {
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
    const { rows } = await pool.query<TicketRow>(
      `SELECT id, company_id, status, assigned_agent_id, assigned_at, reason, closed_at
       FROM ticket
       WHERE company_id = $1
       ORDER BY assigned_at NULLS FIRST, id`,
      [companyId]
    );
    return rows.map(toTicket);
  }

  static async findById(companyId: string, ticketId: string): Promise<Ticket | null> {
    const { rows } = await pool.query<TicketRow>(
      `SELECT id, company_id, status, assigned_agent_id, assigned_at, reason, closed_at
       FROM ticket
       WHERE id = $1 AND company_id = $2`,
      [ticketId, companyId]
    );
    return rows[0] ? toTicket(rows[0]) : null;
  }

  /**
   * Atomically claim an unassigned ticket and bump the agent's last_assigned_at.
   * Returns the updated ticket, or null if the ticket was no longer unassigned (race).
   */
  static async claimAssignment(
    companyId: string,
    ticketId: string,
    agentId: string,
    assignedAt: Date,
    reason: string
  ): Promise<Ticket | null> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { rows } = await client.query<TicketRow>(
        `UPDATE ticket
         SET status = 'assigned',
             assigned_agent_id = $1,
             assigned_at = $2,
             reason = $3
         WHERE id = $4 AND company_id = $5 AND status = 'unassigned'
         RETURNING id, company_id, status, assigned_agent_id, assigned_at, reason, closed_at`,
        [agentId, assignedAt, reason, ticketId, companyId]
      );

      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query(
        `UPDATE agent
         SET last_assigned_at = $1
         WHERE id = $2 AND company_id = $3`,
        [assignedAt, agentId, companyId]
      );

      await client.query('COMMIT');
      return toTicket(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Close an assigned ticket. Returns the updated ticket, or null if it was not assigned.
   */
  static async closeAssigned(
    companyId: string,
    ticketId: string,
    closedAt: Date
  ): Promise<Ticket | null> {
    const { rows } = await pool.query<TicketRow>(
      `UPDATE ticket
       SET status = 'closed', closed_at = $1
       WHERE id = $2 AND company_id = $3 AND status = 'assigned'
       RETURNING id, company_id, status, assigned_agent_id, assigned_at, reason, closed_at`,
      [closedAt, ticketId, companyId]
    );
    return rows[0] ? toTicket(rows[0]) : null;
  }
}
