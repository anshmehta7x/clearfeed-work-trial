CREATE TABLE IF NOT EXISTS availability_window (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id            UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
    start_minute_utc    SMALLINT NOT NULL CHECK (start_minute_utc BETWEEN 0 AND 10079),
    duration_minutes    SMALLINT NOT NULL CHECK (duration_minutes BETWEEN 1 AND 1440)
);

CREATE INDEX IF NOT EXISTS idx_availability_agent_id ON availability_window(agent_id);
