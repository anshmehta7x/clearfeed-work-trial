import pool from '../db/pool.js';
import { Company } from '../types/domain.js';

interface CompanyRow {
  id: string;
  name: string;
}

function toCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
  };
}

export default class CompanyRepository {
  static async findById(companyId: string): Promise<Company | null> {
    const { rows } = await pool.query<CompanyRow>(
      'SELECT id, name FROM company WHERE id = $1',
      [companyId]
    );
    return rows[0] ? toCompany(rows[0]) : null;
  }
}
