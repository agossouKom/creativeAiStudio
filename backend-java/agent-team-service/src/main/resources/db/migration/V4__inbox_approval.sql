-- ============================================================
-- V4 : Support approbation inbox (étape 8 du workflow agent)
-- ============================================================

-- Agrandir la colonne status pour accueillir PENDING_APPROVAL (16 chars) et APPROVED/REJECTED
ALTER TABLE inbox_messages ALTER COLUMN status TYPE VARCHAR(20);

-- Colonne pour stocker la raison d'un rejet
ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Colonne pour lier le message au scrum_agent qui l'a livré
ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS scrum_agent_id VARCHAR(36);

-- Colonne pour stocker la date d'approbation/rejet
ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- Index sur les messages en attente d'approbation (dashboard patron)
CREATE INDEX IF NOT EXISTS idx_inbox_pending ON inbox_messages(user_id, status)
    WHERE status = 'PENDING_APPROVAL' AND deleted = false;
