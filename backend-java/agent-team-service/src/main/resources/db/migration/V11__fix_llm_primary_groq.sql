-- V11: Passer Groq en provider primaire (DeepSeek est inaccessible depuis le serveur)
--
-- Contexte : tous les agents ont DeepSeek (OPENAI/deepseek-chat) comme provider primaire
-- et Groq comme secondaire. DeepSeek est actuellement inaccessible (timeout HTTP 000).
-- On inverse les priorités pour que Groq devienne le provider actif.

-- 1. Groq → is_primary = true pour tous les agents qui en ont un
UPDATE llm_providers
SET is_primary = true,
    updated_at = now()
WHERE type = 'GROQ'
  AND deleted = false;

-- 2. DeepSeek → is_primary = false pour les agents qui ont AUSSI un provider Groq
UPDATE llm_providers
SET is_primary = false,
    updated_at = now()
WHERE type = 'OPENAI'
  AND base_url LIKE '%deepseek%'
  AND deleted = false
  AND agent_id IN (
      SELECT DISTINCT agent_id
      FROM llm_providers
      WHERE type = 'GROQ' AND deleted = false
  );

-- 3. Pour les agents sans provider Groq (ex. BABA le Scrum Master) :
--    convertir leur provider DeepSeek existant en Groq (copie de clé interne à la DB)
UPDATE llm_providers AS lp
SET type           = 'GROQ',
    model_id       = 'llama-3.3-70b-versatile',
    base_url       = 'https://api.groq.com/openai/v1',
    display_name   = 'Groq Llama 3.3 70B',
    encrypted_api_key = (
        SELECT encrypted_api_key
        FROM llm_providers
        WHERE type = 'GROQ' AND deleted = false
        ORDER BY created_at
        LIMIT 1
    ),
    is_primary     = true,
    updated_at     = now()
WHERE lp.type = 'OPENAI'
  AND lp.base_url LIKE '%deepseek%'
  AND lp.deleted = false
  AND NOT EXISTS (
      SELECT 1 FROM llm_providers
      WHERE agent_id = lp.agent_id AND type = 'GROQ' AND deleted = false
  );
