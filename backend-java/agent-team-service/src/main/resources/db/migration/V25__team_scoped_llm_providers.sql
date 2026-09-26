-- LLM providers can also be shared by all agents belonging to an owned team.
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS team_id VARCHAR(36);

CREATE INDEX IF NOT EXISTS idx_llm_team ON llm_providers(team_id);
CREATE INDEX IF NOT EXISTS idx_llm_team_primary ON llm_providers(team_id, is_primary);
