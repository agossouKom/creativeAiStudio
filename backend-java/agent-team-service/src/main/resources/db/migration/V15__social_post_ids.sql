-- Stocke les IDs de publications sociales générées par l'agent (ex: {"FACEBOOK":"pageId_postId"})
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS social_post_ids TEXT;
