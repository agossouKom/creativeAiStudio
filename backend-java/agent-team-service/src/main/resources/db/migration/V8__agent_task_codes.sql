-- Code court lisible (6 chiffres) pour agents et tâches
-- Remplace l'UUID dans les commandes Telegram (/agent 123456, /task 789012)

ALTER TABLE agents
    ADD COLUMN IF NOT EXISTS code VARCHAR(6) UNIQUE;

ALTER TABLE agent_tasks
    ADD COLUMN IF NOT EXISTS code VARCHAR(6) UNIQUE;

-- Remplissage des agents existants
UPDATE agents
SET code = LPAD((FLOOR(RANDOM() * 900000) + 100000)::TEXT, 6, '0')
WHERE code IS NULL;

-- Remplissage des tâches existantes
UPDATE agent_tasks
SET code = LPAD((FLOOR(RANDOM() * 900000) + 100000)::TEXT, 6, '0')
WHERE code IS NULL;

-- Rendre la colonne NOT NULL après remplissage
ALTER TABLE agents    ALTER COLUMN code SET NOT NULL;
ALTER TABLE agent_tasks ALTER COLUMN code SET NOT NULL;

-- Index pour la recherche rapide par code
CREATE INDEX IF NOT EXISTS idx_agent_code ON agents(code);
CREATE INDEX IF NOT EXISTS idx_task_code  ON agent_tasks(code);
