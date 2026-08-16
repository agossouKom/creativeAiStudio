-- V10: Tâches de promotion produit
-- Stocke les codes produits référencés + snapshot JSON au moment de la création
ALTER TABLE agent_tasks
    ADD COLUMN IF NOT EXISTS product_codes    TEXT,
    ADD COLUMN IF NOT EXISTS product_snapshot TEXT,
    ADD COLUMN IF NOT EXISTS platforms        TEXT,
    ADD COLUMN IF NOT EXISTS hashtags         VARCHAR(500),
    ADD COLUMN IF NOT EXISTS tone             VARCHAR(50),
    ADD COLUMN IF NOT EXISTS campaign_objective VARCHAR(50);
