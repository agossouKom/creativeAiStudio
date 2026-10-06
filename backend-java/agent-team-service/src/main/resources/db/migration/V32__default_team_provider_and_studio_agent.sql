-- Un agent appartient obligatoirement à une équipe, et chaque équipe reçoit le
-- provider par défaut de la plateforme. Deux marqueurs sont nécessaires pour
-- que cette attribution automatique ne confisque pas les choix des
-- utilisateurs.
--
-- llm_providers.auto_assigned : provider copié automatiquement sur l'équipe
--   lorsqu'elle n'en a pas encore. Il est proposé APRÈS les providers de
--   compte : si l'utilisateur choisit son propre modèle dans son espace de
--   travail, ce choix reste prioritaire. Sans ce marqueur, le provider
--   automatique de l'équipe écraserait le choix personnel, puisque l'ordre de
--   résolution est agent > équipe > compte.
--
-- agents.is_default_system : agent « Studio », créé automatiquement dans
--   chaque compte. Il n'appartient à aucune équipe en particulier (team_id
--   reste nul) et l'interface l'affiche dans chaque filtre d'équipe du
--   compte. Il suit la chaîne de résolution normale : un choix personnel
--   s'y applique comme pour n'importe quel agent.
ALTER TABLE llm_providers
    ADD COLUMN IF NOT EXISTS auto_assigned boolean NOT NULL DEFAULT false;

ALTER TABLE agents
    ADD COLUMN IF NOT EXISTS is_default_system boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_llm_providers_team_auto_assigned
    ON llm_providers (team_id, auto_assigned)
    WHERE deleted = false AND active = true;

-- Un seul agent système par compte. La contrainte n'est pas décorative : deux
-- chargements simultanés du tableau de bord (deux onglets ouverts) lisent tous
-- deux « aucun Studio » et créent tous deux une ligne. Sans l'unicité,
-- l'utilisateur se retrouve avec deux agents système, dont il ignorerait
-- lequel est le bon. La course est arbitrée par la base : une des deux requêtes
-- échoue, l'autre gagne, et le service relit le compte.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_default_system_unique
    ON agents (owner_id)
    WHERE is_default_system = true AND deleted = false;

-- Reprise des agents « Studio » déjà en base. team_id était facultatif avant
-- cette migration : un compte pouvait donc déjà avoir un Studio sans équipe,
-- créé à la main. Le marquer évite que le provisionnement en crée un second
-- au prochain chargement du tableau de bord.
--
-- Le nom exact « Studio » et l'absence d'équipe sont les deux conditions. Un
-- agent nommé Studio mais rattaché à une équipe n'est pas concerné : c'est un
-- agent normal, l'utilisateur l'a voulu ainsi. Cas limite assumé : un « Studio »
-- manuel et sans équipe devient l'agent système du compte. Le résultat visible
-- reste une seule ligne du bon nom, ce qui est préférable à un doublon.
UPDATE agents
   SET is_default_system = true
 WHERE is_default_system = false
   AND team_id IS NULL
   AND owner_id IS NOT NULL
   AND name = 'Studio';