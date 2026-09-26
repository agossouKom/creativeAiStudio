-- Orchestrateur de génération média (vidéo / image) + demandes de publication sociale
CREATE TABLE generation_jobs (
    id                BIGSERIAL PRIMARY KEY,
    job_id            VARCHAR(64)   NOT NULL UNIQUE,
    user_email        VARCHAR(255)  NOT NULL,
    media_type        VARCHAR(20)   NOT NULL,
    status            VARCHAR(20)   NOT NULL DEFAULT 'QUEUED',
    stage             VARCHAR(40),
    progress          INTEGER       NOT NULL DEFAULT 0,
    prompt            TEXT          NOT NULL,
    negative_prompt   TEXT,
    options_json      TEXT,
    execution_version INTEGER       NOT NULL DEFAULT 1,
    provider          VARCHAR(60),
    provider_task_id  VARCHAR(128),
    error_code        VARCHAR(80),
    error_message     VARCHAR(1000),
    created_at        TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP     NOT NULL DEFAULT NOW(),
    completed_at      TIMESTAMP
);

CREATE INDEX idx_generation_jobs_user   ON generation_jobs(user_email);
CREATE INDEX idx_generation_jobs_status ON generation_jobs(status);
CREATE INDEX idx_generation_jobs_created ON generation_jobs(created_at DESC);

CREATE TABLE generation_outputs (
    id                BIGSERIAL PRIMARY KEY,
    job_id            VARCHAR(64)   NOT NULL,
    execution_version INTEGER       NOT NULL,
    output_index      INTEGER       NOT NULL,
    bucket            VARCHAR(80)   NOT NULL,
    object_key        VARCHAR(500)  NOT NULL,
    size_bytes        BIGINT        NOT NULL,
    sha256            VARCHAR(64),
    content_type      VARCHAR(80)   NOT NULL,
    created_at        TIMESTAMP     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_generation_output UNIQUE (job_id, execution_version, output_index)
);

CREATE INDEX idx_generation_outputs_job ON generation_outputs(job_id, execution_version);

-- Les credentials des plateformes restent dans agent-team-service (channels chiffrées) :
-- cette table ne stocke que la demande de publication et son résultat.
CREATE TABLE social_publish_requests (
    id                BIGSERIAL PRIMARY KEY,
    request_id        VARCHAR(36)   NOT NULL UNIQUE,
    job_id            VARCHAR(64)   NOT NULL,
    execution_version INTEGER       NOT NULL,
    output_index      INTEGER       NOT NULL,
    user_email        VARCHAR(255)  NOT NULL,
    platform          VARCHAR(30)   NOT NULL,
    agent_id          VARCHAR(64),
    status            VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    caption           VARCHAR(2200),
    remote_media_id   VARCHAR(255),
    remote_permalink  VARCHAR(1000),
    error_code        VARCHAR(80),
    error_message     VARCHAR(1000),
    attempts          INTEGER       NOT NULL DEFAULT 0,
    created_at        TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP     NOT NULL DEFAULT NOW(),
    submitted_at      TIMESTAMP,
    published_at      TIMESTAMP
);

CREATE INDEX idx_social_publish_user ON social_publish_requests(user_email);
CREATE INDEX idx_social_publish_job  ON social_publish_requests(job_id);
