CREATE TABLE IF NOT EXISTS agent (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES company(id),
    name                TEXT NOT NULL,
    utc_offset_minutes  INTEGER NOT NULL CHECK (utc_offset_minutes BETWEEN -720 AND 840),
    last_assigned_at    TIMESTAMPTZ,
    UNIQUE (company_id, id)
);

CREATE INDEX IF NOT EXISTS idx_agent_company_id ON agent(company_id);
