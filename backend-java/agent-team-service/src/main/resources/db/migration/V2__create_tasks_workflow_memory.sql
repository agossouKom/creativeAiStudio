-- ============================================================
-- V2 : Tâches, Workflows, Mémoire, Knowledge Base, Métriques
-- ============================================================

-- Tâches agents
CREATE TABLE IF NOT EXISTS agent_tasks (
    id                  VARCHAR(36)  PRIMARY KEY,
    title               VARCHAR(500) NOT NULL,
    description         TEXT,
    type                VARCHAR(30)  NOT NULL DEFAULT 'GENERAL',
    status              VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    priority            VARCHAR(15)  NOT NULL DEFAULT 'MEDIUM',
    source              VARCHAR(20)  NOT NULL DEFAULT 'MANUAL',
    user_id             VARCHAR(36)  NOT NULL,
    team_id             VARCHAR(36),
    assigned_agent_id   VARCHAR(36),
    requester_agent_id  VARCHAR(36),
    payload             JSONB,
    result              JSONB,
    due_date            TIMESTAMP,
    started_at          TIMESTAMP,
    completed_at        TIMESTAMP,
    parent_task_id      VARCHAR(36),
    child_task_ids      JSONB        NOT NULL DEFAULT '[]',
    agent_generated     BOOLEAN      NOT NULL DEFAULT FALSE,
    retry_count         INT          NOT NULL DEFAULT 0,
    error_message       TEXT,
    workflow_id         VARCHAR(36),
    workflow_step_id    VARCHAR(36),
    deleted             BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_task_user        ON agent_tasks(user_id);
CREATE INDEX idx_task_agent       ON agent_tasks(assigned_agent_id);
CREATE INDEX idx_task_team        ON agent_tasks(team_id);
CREATE INDEX idx_task_status      ON agent_tasks(status);
CREATE INDEX idx_task_priority    ON agent_tasks(priority);
CREATE INDEX idx_task_user_status ON agent_tasks(user_id, status);
CREATE INDEX idx_task_due         ON agent_tasks(due_date);

-- Workflows
CREATE TABLE IF NOT EXISTS workflows (
    id                  VARCHAR(36)   PRIMARY KEY,
    name                VARCHAR(200)  NOT NULL,
    description         VARCHAR(1000),
    team_id             VARCHAR(36),
    owner_id            VARCHAR(36)   NOT NULL,
    trigger_agent_id    VARCHAR(36),
    status              VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    trigger_type        VARCHAR(20)   NOT NULL DEFAULT 'MANUAL',
    cron_expression     VARCHAR(100),
    current_step_index  INT           NOT NULL DEFAULT 0,
    context             JSONB,
    next_run_at         TIMESTAMP,
    last_run_at         TIMESTAMP,
    run_count           INT           NOT NULL DEFAULT 0,
    last_error          TEXT,
    deleted             BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wf_team      ON workflows(team_id);
CREATE INDEX idx_wf_status    ON workflows(status);
CREATE INDEX idx_wf_next_run  ON workflows(next_run_at);

-- Étapes de workflow
CREATE TABLE IF NOT EXISTS workflow_steps (
    id                  VARCHAR(36)  PRIMARY KEY,
    workflow_id         VARCHAR(36)  NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    step_order          INT          NOT NULL,
    name                VARCHAR(200) NOT NULL,
    agent_id            VARCHAR(36)  NOT NULL,
    action_type         VARCHAR(30)  NOT NULL,
    config              JSONB,
    conditions          JSONB,
    on_success_step_id  VARCHAR(36),
    on_failure_step_id  VARCHAR(36),
    on_timeout_step_id  VARCHAR(36),
    timeout_seconds     INT          NOT NULL DEFAULT 120,
    parallel            BOOLEAN      NOT NULL DEFAULT FALSE,
    retry_count         INT          NOT NULL DEFAULT 0,
    deleted             BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wf_step_wf ON workflow_steps(workflow_id);

-- Mémoire des agents
CREATE TABLE IF NOT EXISTS agent_memories (
    id              VARCHAR(36)  PRIMARY KEY,
    user_id         VARCHAR(36)  NOT NULL,
    agent_id        VARCHAR(36)  NOT NULL,
    session_id      VARCHAR(100),
    team_id         VARCHAR(36),
    role            VARCHAR(15)  NOT NULL,
    content         TEXT         NOT NULL,
    tool_name       VARCHAR(100),
    sequence_number BIGINT       NOT NULL DEFAULT 0,
    memory_type     VARCHAR(15)  NOT NULL DEFAULT 'SHORT_TERM',
    expires_at      TIMESTAMP,
    metadata        JSONB,
    deleted         BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_mem_user_agent ON agent_memories(user_id, agent_id);
CREATE INDEX idx_mem_session    ON agent_memories(session_id);
CREATE INDEX idx_mem_team       ON agent_memories(team_id);
CREATE INDEX idx_mem_seq        ON agent_memories(user_id, agent_id, sequence_number);

-- Knowledge bases
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id                    VARCHAR(36)  PRIMARY KEY,
    agent_id              VARCHAR(36)  NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
    name                  VARCHAR(200) NOT NULL,
    embedding_model       VARCHAR(100) NOT NULL DEFAULT 'nomic-embed-text',
    chunk_size            INT          NOT NULL DEFAULT 512,
    chunk_overlap         INT          NOT NULL DEFAULT 50,
    top_k                 INT          NOT NULL DEFAULT 5,
    similarity_threshold  FLOAT        NOT NULL DEFAULT 0.7,
    document_count        INT          NOT NULL DEFAULT 0,
    deleted               BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_kb_agent ON knowledge_bases(agent_id);

-- Documents KB
CREATE TABLE IF NOT EXISTS kb_documents (
    id                  VARCHAR(36)   PRIMARY KEY,
    knowledge_base_id   VARCHAR(36)   NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    title               VARCHAR(300)  NOT NULL,
    file_url            VARCHAR(1000),
    mime_type           VARCHAR(100),
    file_size_bytes     BIGINT,
    vector_ids          JSONB,
    indexed_at          TIMESTAMP,
    active              BOOLEAN       NOT NULL DEFAULT TRUE,
    metadata            JSONB,
    deleted             BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_kb_doc_kb ON kb_documents(knowledge_base_id);

-- Métriques par agent par jour
CREATE TABLE IF NOT EXISTS agent_metrics (
    id                      VARCHAR(36)   PRIMARY KEY,
    agent_id                VARCHAR(36)   NOT NULL,
    metric_date             DATE          NOT NULL,
    total_requests          BIGINT        NOT NULL DEFAULT 0,
    successful_requests     BIGINT        NOT NULL DEFAULT 0,
    failed_requests         BIGINT        NOT NULL DEFAULT 0,
    total_tokens_used       BIGINT        NOT NULL DEFAULT 0,
    avg_response_time_ms    FLOAT         NOT NULL DEFAULT 0,
    estimated_cost_eur      FLOAT         NOT NULL DEFAULT 0,
    tasks_completed         BIGINT        NOT NULL DEFAULT 0,
    tasks_escalated         BIGINT        NOT NULL DEFAULT 0,
    tasks_failed            BIGINT        NOT NULL DEFAULT 0,
    media_assets_generated  BIGINT        NOT NULL DEFAULT 0,
    documents_indexed       BIGINT        NOT NULL DEFAULT 0,
    tool_usage_count        JSONB,
    deleted                 BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP     NOT NULL DEFAULT NOW(),
    UNIQUE (agent_id, metric_date)
);
CREATE INDEX idx_metrics_agent_date ON agent_metrics(agent_id, metric_date);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id           VARCHAR(36)  PRIMARY KEY,
    agent_id     VARCHAR(36),
    user_id      VARCHAR(36),
    team_id      VARCHAR(36),
    action       VARCHAR(100) NOT NULL,
    resource     VARCHAR(100),
    resource_id  VARCHAR(36),
    details      JSONB,
    ip_address   VARCHAR(50),
    trace_id     VARCHAR(100),
    success      BOOLEAN      NOT NULL DEFAULT TRUE,
    error_message TEXT,
    timestamp    TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_agent     ON audit_logs(agent_id);
CREATE INDEX idx_audit_user      ON audit_logs(user_id);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_resource  ON audit_logs(resource, resource_id);
