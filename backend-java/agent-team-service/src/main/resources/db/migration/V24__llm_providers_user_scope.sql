-- ============================================================
-- V24 : LLM providers au niveau compte utilisateur
-- Chaque utilisateur peut configurer ses providers (compte)
-- et rattacher des providers à ses agents (comportement existant).
-- le provider "compte" de l'admin sert de provider par défaut (fallback global).
-- ============================================================

-- Colonne "compte utilisateur" (nullable) : provider rattaché au user_id (email JWT).
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);

-- agent_id devient optionnel pour autoriser les providers sans agent.
ALTER TABLE llm_providers ALTER COLUMN agent_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_llm_user         ON llm_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_user_primary ON llm_providers(user_id, is_primary);