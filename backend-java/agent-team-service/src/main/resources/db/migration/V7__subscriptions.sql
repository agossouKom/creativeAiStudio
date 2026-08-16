-- ──────────────────────────────────────────────────────────────────────────────
-- V7: Système d'abonnement et quotas
--
-- user_subscriptions : plan courant + limites par utilisateur
-- subscription_usage : consommation mensuelle (tasks, agents…)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             VARCHAR(36) NOT NULL UNIQUE,
    plan                VARCHAR(20) NOT NULL DEFAULT 'FREE',

    -- Limites configurables (peuvent être surchargées par l'admin)
    tasks_per_month     INTEGER     NOT NULL DEFAULT 50,
    max_agents          INTEGER     NOT NULL DEFAULT 3,
    max_teams           INTEGER     NOT NULL DEFAULT 1,
    premium_llm_enabled BOOLEAN     NOT NULL DEFAULT false,

    valid_from          TIMESTAMP   NOT NULL DEFAULT NOW(),
    valid_until         TIMESTAMP,              -- NULL = sans expiration

    created_at          TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_user ON user_subscriptions (user_id);

-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscription_usage (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     VARCHAR(36) NOT NULL,
    -- Période mensuelle au format YYYY-MM
    period      VARCHAR(7)  NOT NULL,
    tasks_used  INTEGER     NOT NULL DEFAULT 0,
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_usage_user_period UNIQUE (user_id, period)
);

CREATE INDEX IF NOT EXISTS idx_usage_user_period ON subscription_usage (user_id, period);
