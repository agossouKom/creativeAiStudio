-- Remonte la version de l'API Graph Meta.
--
-- V26 a semé "graphVersion":"v19.0" dans extra_config, et aucune migration
-- ultérieure n'y a touché (V27 ne renseigne que les colonnes d'URL, V28 ne
-- corrige que les scopes). Or SocialPlatformConfigService.isUsableGraphVersion
-- valide la forme vNN.N : v19.0 passait le contrôle, donc le repli
-- DEFAULT_GRAPH_VERSION (v24.0) du code restait inatteignable. Meta ne garde
-- chaque version que deux ans — v19.0 est expirée depuis mai 2026, et une
-- version expirée ne lève aucune erreur : les appels sont simplement re-routés
-- vers la plus ancienne version encore vivante, sans le moindre signal.
--
-- La réécriture passe par une expression régulière plutôt que par un cast
-- jsonb : extra_config est un TEXT libre que l'administrateur saisit dans une
-- textarea, et un cast échouerait sur une saisie malformée en bloquant tout le
-- démarrage du service. Seules les lignes encore figées sur v19.0 sont
-- réécrites : une version saisie à la main est préservée telle quelle.
UPDATE social_platforms
   SET extra_config = regexp_replace(
         extra_config, '("graphVersion"\s*:\s*)"v19\.0"', '\1"v24.0"')
 WHERE extra_config ~ '"graphVersion"\s*:\s*"v19\.0"';