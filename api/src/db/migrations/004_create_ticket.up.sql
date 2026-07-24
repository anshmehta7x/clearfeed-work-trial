CREATE TABLE IF NOT EXISTS ticket (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES company(id),
    status              TEXT NOT NULL DEFAULT 'unassigned'
                            CHECK (status IN ('unassigned', 'assigned', 'closed')),
    assigned_agent_id   UUID,
    assigned_at         TIMESTAMPTZ,
    reason              TEXT,
    closed_at           TIMESTAMPTZ,
    FOREIGN KEY (company_id, assigned_agent_id) REFERENCES agent(company_id, id),
    CHECK (
        (
            status = 'unassigned'
            AND assigned_agent_id IS NULL
            AND assigned_at IS NULL
            AND reason IS NULL
            AND closed_at IS NULL
        )
        OR (
            status = 'assigned'
            AND assigned_agent_id IS NOT NULL
            AND assigned_at IS NOT NULL
            AND reason IS NOT NULL
            AND length(trim(reason)) > 0
            AND closed_at IS NULL
        )
        OR (
            status = 'closed'
            AND assigned_agent_id IS NOT NULL
            AND assigned_at IS NOT NULL
            AND reason IS NOT NULL
            AND length(trim(reason)) > 0
            AND closed_at IS NOT NULL
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_ticket_company_id ON ticket(company_id);
CREATE INDEX IF NOT EXISTS idx_ticket_agent_status ON ticket(assigned_agent_id, status);
