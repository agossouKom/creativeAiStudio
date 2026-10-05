-- Provider LLM « par défaut pour tous les comptes ».
--
-- Contexte : les providers sont aujourd'hui scopés à un agent, une équipe ou un
-- compte. Rien ne permet à un administrateur de définir un modèle de repli
-- Platesforme, si bien que la hiérarchie de résolution (agent > équipe >
-- compte > admin) ne peut s'appuyer que sur les providers du compte admin.
--
-- Cette colonne marque UN provider comme modèle par défaut de la plateforme.
-- Contrainte : au plus un provider actif peut porter le drapeau, ce qui évite
-- l'ambiguïté quand plusieurs administrateurs en créent un.
ALTER TABLE llm_providers
    ADD COLUMN IF NOT EXISTS is_platform_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS ux_llm_platform_default
    ON llm_providers (is_platform_default)
    WHERE is_platform_default = true AND deleted = false;

COMMENT ON COLUMN llm_providers.is_platform_default IS
    'Provider par défaut de la plateforme, hérité par tout compte sans provider propre.';