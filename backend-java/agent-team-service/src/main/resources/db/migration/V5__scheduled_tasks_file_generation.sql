-- V5 : Tâches planifiées, contacts, résultat attendu + génération de fichiers inbox

-- ── agent_tasks ──────────────────────────────────────────────────────────────
ALTER TABLE agent_tasks
    ADD COLUMN IF NOT EXISTS scheduled_at    TIMESTAMP,
    ADD COLUMN IF NOT EXISTS contacts        JSONB,
    ADD COLUMN IF NOT EXISTS expected_result TEXT,
    ADD COLUMN IF NOT EXISTS confidential    BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_task_scheduled
    ON agent_tasks (scheduled_at)
    WHERE scheduled_at IS NOT NULL AND deleted = false;

-- ── inbox_messages ────────────────────────────────────────────────────────────
ALTER TABLE inbox_messages
    ADD COLUMN IF NOT EXISTS file_url  VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS file_name VARCHAR(500);
