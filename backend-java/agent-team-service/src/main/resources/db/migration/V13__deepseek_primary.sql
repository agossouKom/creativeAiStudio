-- V13: Rétablir DeepSeek comme provider principal
--
-- Contexte : la clé API Groq stockée en DB est invalide (401).
-- DeepSeek fonctionne correctement (abonnement actif).
-- Le fix TLS (ReactorClientHttpRequestFactory dans ChatModelFactory) permet désormais
-- à Spring AI d'utiliser DeepSeek via Netty au lieu du client HTTP Java natif.

-- 1. DeepSeek → primary pour tous les agents
UPDATE llm_providers
SET is_primary = true, updated_at = now()
WHERE type = 'OPENAI' AND base_url LIKE '%deepseek%' AND deleted = false;

-- 2. Groq → secondaire pour tous les agents
UPDATE llm_providers
SET is_primary = false, updated_at = now()
WHERE type = 'GROQ' AND deleted = false;
