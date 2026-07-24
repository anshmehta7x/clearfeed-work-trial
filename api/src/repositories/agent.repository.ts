import pool from '../db/pool.js';
import {
  Agent,
  AgentData,
  CompanyAgentsData,
  UtcAvailabilityWindow,
} from '../types/domain.js';

interface AgentRow {
  id: string;
  company_id: string;
  name: string;
  utc_offset_minutes: number;
  last_assigned_at: Date | null;
}

interface AvailabilityWindowRow {
  start_minute_utc: number;
  duration_minutes: number;
}

interface CompanyAvailabilityWindowRow extends AvailabilityWindowRow {
  agent_id: string;
}

interface ActiveCountRow {
  count: number;
}

interface AgentActiveCountRow extends ActiveCountRow {
  agent_id: string;
}

function toAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    utcOffsetMinutes: row.utc_offset_minutes,
    lastAssignedAt: row.last_assigned_at,
  };
}

function toWindow(row: AvailabilityWindowRow): UtcAvailabilityWindow {
  return {
    startMinuteUtc: row.start_minute_utc,
    durationMinutes: row.duration_minutes,
  };
}

export default class AgentRepository {
  static async findById(companyId: string, agentId: string): Promise<Agent | null> {
    const { rows } = await pool.query<AgentRow>(
      `SELECT id, company_id, name, utc_offset_minutes, last_assigned_at
       FROM agent
       WHERE id = $1 AND company_id = $2`,
      [agentId, companyId]
    );
    return rows[0] ? toAgent(rows[0]) : null;
  }

  /** Raw agent + windows + active count for one agent (no derived workload fields). */
  static async loadAgentData(
    companyId: string,
    agentId: string
  ): Promise<AgentData | null> {
    const agent = await this.findById(companyId, agentId);
    if (!agent) {
      return null;
    }

    const [windowsResult, activeCountResult] = await Promise.all([
      pool.query<AvailabilityWindowRow>(
        `SELECT start_minute_utc, duration_minutes
         FROM availability_window
         WHERE agent_id = $1
         ORDER BY start_minute_utc`,
        [agentId]
      ),
      pool.query<ActiveCountRow>(
        `SELECT COUNT(*)::int AS count
         FROM ticket
         WHERE assigned_agent_id = $1 AND status = 'assigned'`,
        [agentId]
      ),
    ]);

    return {
      agent,
      windows: windowsResult.rows.map(toWindow),
      activeTicketCount: activeCountResult.rows[0]?.count ?? 0,
    };
  }

  /** Raw agents + windows + active counts for a company (no derived workload fields). */
  static async loadCompanyAgentsData(companyId: string): Promise<CompanyAgentsData> {
    const [agentsResult, windowsResult, activeCountsResult] = await Promise.all([
      pool.query<AgentRow>(
        `SELECT id, company_id, name, utc_offset_minutes, last_assigned_at
         FROM agent
         WHERE company_id = $1
         ORDER BY name`,
        [companyId]
      ),
      pool.query<CompanyAvailabilityWindowRow>(
        `SELECT aw.agent_id, aw.start_minute_utc, aw.duration_minutes
         FROM availability_window aw
         JOIN agent a ON a.id = aw.agent_id
         WHERE a.company_id = $1`,
        [companyId]
      ),
      pool.query<AgentActiveCountRow>(
        `SELECT t.assigned_agent_id AS agent_id, COUNT(*)::int AS count
         FROM ticket t
         JOIN agent a ON a.id = t.assigned_agent_id
         WHERE a.company_id = $1 AND t.status = 'assigned'
         GROUP BY t.assigned_agent_id`,
        [companyId]
      ),
    ]);

    const windowsByAgent = new Map<string, UtcAvailabilityWindow[]>();
    for (const row of windowsResult.rows) {
      const list = windowsByAgent.get(row.agent_id) ?? [];
      list.push(toWindow(row));
      windowsByAgent.set(row.agent_id, list);
    }

    const activeCountByAgent = new Map<string, number>();
    for (const row of activeCountsResult.rows) {
      activeCountByAgent.set(row.agent_id, row.count);
    }

    return {
      agents: agentsResult.rows.map(toAgent),
      windowsByAgent,
      activeCountByAgent,
    };
  }

  /**
   * Updates agent offset and replaces all availability windows in one transaction.
   * Returns false if the agent is missing or does not belong to the company.
   */
  static async replaceAvailability(
    companyId: string,
    agentId: string,
    utcOffsetMinutes: number,
    windows: UtcAvailabilityWindow[]
  ): Promise<boolean> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const updateResult = await client.query(
        `UPDATE agent
         SET utc_offset_minutes = $1
         WHERE id = $2 AND company_id = $3`,
        [utcOffsetMinutes, agentId, companyId]
      );

      if (updateResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query(`DELETE FROM availability_window WHERE agent_id = $1`, [agentId]);

      if (windows.length > 0) {
        const values: unknown[] = [];
        const placeholders: string[] = [];

        windows.forEach((window, index) => {
          const base = index * 3;
          placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
          values.push(agentId, window.startMinuteUtc, window.durationMinutes);
        });

        await client.query(
          `INSERT INTO availability_window (agent_id, start_minute_utc, duration_minutes)
           VALUES ${placeholders.join(', ')}`,
          values
        );
      }

      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
