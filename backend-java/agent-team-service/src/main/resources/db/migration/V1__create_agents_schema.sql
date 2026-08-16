-- ============================================================
-- V1 : Schéma principal des agents IA
-- ============================================================

-- Agents (table principale)
CREATE TABLE IF NOT EXISTS agents (
    id               VARCHAR(36)  PRIMARY KEY,
    name             VARCHAR(150) NOT NULL,
    slug             VARCHAR(100) NOT NULL UNIQUE,
    description      VARCHAR(500),
    type             VARCHAR(30)  NOT NULL,
    status           VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    owner_id         VARCHAR(36)  NOT NULL,
    team_id          VARCHAR(36),
    last_active_at   TIMESTAMP,
    extra_config     JSONB,
    deleted          BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_agent_owner  ON agents(owner_id);
CREATE INDEX idx_agent_team   ON agents(team_id);
CREATE INDEX idx_agent_type   ON agents(type);
CREATE INDEX idx_agent_status ON agents(status);

-- Configuration des agents
CREATE TABLE IF NOT EXISTS agent_configs (
    id                      VARCHAR(36) PRIMARY KEY,
    agent_id                VARCHAR(36) NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
    temperature             FLOAT       NOT NULL DEFAULT 0.7,
    max_tokens              INT         NOT NULL DEFAULT 2048,
    context_window_size     INT         NOT NULL DEFAULT 8192,
    max_memory_messages     INT         NOT NULL DEFAULT 30,
    max_iterations          INT         NOT NULL DEFAULT 10,
    response_language       VARCHAR(10) NOT NULL DEFAULT 'fr',
    timezone                VARCHAR(50) NOT NULL DEFAULT 'Europe/Paris',
    streaming_enabled       BOOLEAN     NOT NULL DEFAULT TRUE,
    auto_escalate_enabled   BOOLEAN     NOT NULL DEFAULT TRUE,
    auto_reply_enabled      BOOLEAN     NOT NULL DEFAULT FALSE,
    task_timeout_seconds    INT         NOT NULL DEFAULT 120,
    rate_limit_rpm          INT         NOT NULL DEFAULT 60,
    retry_max_attempts      INT         NOT NULL DEFAULT 3,
    retry_delay_seconds     INT         NOT NULL DEFAULT 5,
    working_hours_json      TEXT,
    custom_params           JSONB,
    deleted                 BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Profils des agents
CREATE TABLE IF NOT EXISTS agent_profiles (
    id                  VARCHAR(36)  PRIMARY KEY,
    agent_id            VARCHAR(36)  NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
    display_name        VARCHAR(100) NOT NULL,
    avatar_url          VARCHAR(500),
    bio                 VARCHAR(500),
    persona             TEXT,
    tone                VARCHAR(20)  NOT NULL DEFAULT 'PROFESSIONAL',
    welcome_message     TEXT,
    capabilities_json   JSONB,
    restrictions_json   JSONB,
    brand_voice_json    JSONB,
    deleted             BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Providers LLM par agent
CREATE TABLE IF NOT EXISTS llm_providers (
    id                       VARCHAR(36)  PRIMARY KEY,
    agent_id                 VARCHAR(36)  NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    type                     VARCHAR(20)  NOT NULL,
    model_id                 VARCHAR(100) NOT NULL,
    base_url                 VARCHAR(300),
    encrypted_api_key        TEXT,
    display_name             VARCHAR(100),
    temperature              FLOAT        NOT NULL DEFAULT 0.7,
    max_tokens               INT          NOT NULL DEFAULT 2048,
    top_p                    FLOAT        NOT NULL DEFAULT 1.0,
    streaming_enabled        BOOLEAN      NOT NULL DEFAULT TRUE,
    request_timeout_seconds  INT          NOT NULL DEFAULT 60,
    rate_limit_rpm           INT          NOT NULL DEFAULT 30,
    is_primary               BOOLEAN      NOT NULL DEFAULT FALSE,
    active                   BOOLEAN      NOT NULL DEFAULT TRUE,
    extra_params             JSONB,
    deleted                  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at               TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_llm_agent   ON llm_providers(agent_id);
CREATE INDEX idx_llm_primary ON llm_providers(agent_id, is_primary);

-- Équipes d'agents
CREATE TABLE IF NOT EXISTS agent_teams (
    id                       VARCHAR(36)  PRIMARY KEY,
    name                     VARCHAR(150) NOT NULL,
    description              VARCHAR(500),
    type                     VARCHAR(20)  NOT NULL DEFAULT 'BUSINESS',
    organization_id          VARCHAR(36),
    owner_id                 VARCHAR(36)  NOT NULL,
    lead_agent_id            VARCHAR(36),
    creative_lead_agent_id   VARCHAR(36),
    status                   VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    collaboration_mode       VARCHAR(20)  NOT NULL DEFAULT 'HYBRID',
    shared_memory_enabled    BOOLEAN      NOT NULL DEFAULT TRUE,
    shared_knowledge_enabled BOOLEAN      NOT NULL DEFAULT FALSE,
    max_concurrent_tasks     INT          NOT NULL DEFAULT 10,
    member_agent_ids         JSONB        NOT NULL DEFAULT '[]',
    escalation_rules         JSONB,
    notification_config      JSONB,
    deleted                  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at               TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_team_org    ON agent_teams(organization_id);
CREATE INDEX idx_team_status ON agent_teams(status);

-- Templates de prompts
CREATE TABLE IF NOT EXISTS prompt_templates (
    id              VARCHAR(36)  PRIMARY KEY,
    agent_id        VARCHAR(36)  NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name            VARCHAR(150) NOT NULL,
    type            VARCHAR(20)  NOT NULL,
    content         TEXT         NOT NULL,
    description     VARCHAR(500),
    variables_json  JSONB,
    version         INT          NOT NULL DEFAULT 1,
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    deleted         BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_prompt_agent  ON prompt_templates(agent_id);
CREATE INDEX idx_prompt_active ON prompt_templates(agent_id, type, active);

-- Canaux d'intégration
CREATE TABLE IF NOT EXISTS channels (
    id                    VARCHAR(36)  PRIMARY KEY,
    agent_id              VARCHAR(36)  NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    type                  VARCHAR(20)  NOT NULL,
    platform_type         VARCHAR(20),
    display_name          VARCHAR(150) NOT NULL,
    status                VARCHAR(15)  NOT NULL DEFAULT 'DISCONNECTED',
    encrypted_credentials TEXT,
    config                JSONB,
    account_id            VARCHAR(200),
    account_name          VARCHAR(200),
    metrics               JSONB,
    last_sync_at          TIMESTAMP,
    token_expires_at      TIMESTAMP,
    deleted               BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_channel_agent  ON channels(agent_id);
CREATE INDEX idx_channel_type   ON channels(type);
CREATE INDEX idx_channel_status ON channels(status);
