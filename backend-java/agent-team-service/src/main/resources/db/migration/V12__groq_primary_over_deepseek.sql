-- V12: Rétablir Groq comme provider principal lorsque DeepSeek est primary
--
-- Contexte : DeepSeek est incompatible avec Spring AI DefaultRestClient (TLS/HTTP issue).
-- Il fonctionne via LlmGateway (WebClient) mais pas via ChatModelFactory (OpenAiChatModel).
-- Lorsqu'un utilisateur ajoute un provider DeepSeek comme "principal" via l'UI,
-- cela écrase le provider Groq en secondaire et casse le function calling.
--
-- Fix : pour tout agent ayant à la fois un provider Groq et un provider DeepSeek primary,
-- remettre Groq en primary et DeepSeek en secondaire.

-- 1. Groq → primary pour les agents qui ont aussi DeepSeek comme primary
UPDATE llm_providers
SET is_primary = true, updated_at = now()
WHERE type = 'GROQ'
  AND deleted = false
  AND agent_id IN (
      SELECT agent_id FROM llm_providers
      WHERE type = 'OPENAI' AND base_url LIKE '%deepseek%'
        AND is_primary = true AND deleted = false
  );

-- 2. DeepSeek → secondaire pour les agents qui ont aussi un provider Groq
UPDATE llm_providers
SET is_primary = false, updated_at = now()
WHERE type = 'OPENAI'
  AND base_url LIKE '%deepseek%'
  AND is_primary = true
  AND deleted = false
  AND agent_id IN (
      SELECT agent_id FROM llm_providers
      WHERE type = 'GROQ' AND deleted = false
  );
