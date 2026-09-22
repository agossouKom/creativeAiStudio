-- Active create_agent sur les SCRUM_MASTER existants et ajoute l'instruction
-- de proposition de création quand une compétence manque dans l'équipe.

-- 1) Ajouter "create_agent" à enabledTools des configs des SCRUM_MASTER existants
UPDATE agent_configs ac
SET custom_params = jsonb_set(
        COALESCE(ac.custom_params, '{}'::jsonb),
        '{enabledTools}',
        (
            SELECT COALESCE(jsonb_agg(v ORDER BY v), '[]'::jsonb)
            FROM (
                SELECT v
                FROM jsonb_array_elements_text(COALESCE(ac.custom_params->'enabledTools', '[]'::jsonb)) AS t(v)
                UNION
                SELECT 'create_agent'
            ) s
        )
    )
WHERE ac.agent_id IN (
    SELECT id FROM agents WHERE type = 'SCRUM_MASTER' AND deleted = false
);

-- 2) Ajouter l'instruction de proposition aux prompts SYSTÈME actifs des SCRUM_MASTER existants
UPDATE prompt_templates pt
SET content = pt.content || E'\n\n⟶ COMPÉTENCE MANQUANTE — PROPOSITION DE CRÉATION :\nSi la demande exige une compétence qu''aucun agent de l''équipe ne couvre, appelle create_agent (agentType, name, description, teamId) pour PROPOSER au patron la création de l''agent manquant — tu ne crées JAMAIS directement sans son approbation. Signale dans ta réponse : « Il faudrait un agent de type X — proposition de création envoyée, validez-la dans l''interface. » L''agent sera créé tout configuré (outils, modèle IA, prompt) dès l''approbation, puis apparaîtra dans la liste des agents existants.\n'
WHERE pt.type = 'SYSTEM'
  AND pt.active = true
  AND pt.agent_id IN (
      SELECT id FROM agents WHERE type = 'SCRUM_MASTER' AND deleted = false
  );