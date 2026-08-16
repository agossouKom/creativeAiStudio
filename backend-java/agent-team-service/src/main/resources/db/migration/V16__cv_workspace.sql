-- ── Workspace CV Analyser ──────────────────────────────────────────────────
-- Stocke les analyses CV par utilisateur avec contexte métier (recruteur / candidat / RH)

CREATE TABLE cv_analyses (
    id              VARCHAR(36)   PRIMARY KEY,
    user_id         VARCHAR(36)   NOT NULL,
    file_name       VARCHAR(500)  NOT NULL,
    file_size       BIGINT        NOT NULL DEFAULT 0,
    analyzed_at     TIMESTAMP     NOT NULL DEFAULT NOW(),
    target_job      VARCHAR(200),
    status          VARCHAR(30)   NOT NULL DEFAULT 'pending',
    notes           TEXT,
    workspace_mode  VARCHAR(20)   NOT NULL DEFAULT 'recruiter',
    global_score    INTEGER       NOT NULL DEFAULT 0,
    global_label    VARCHAR(100),
    ats_pct         INTEGER       NOT NULL DEFAULT 0,
    sections        JSONB         NOT NULL DEFAULT '[]',
    keywords        JSONB         NOT NULL DEFAULT '[]',
    strengths       JSONB         NOT NULL DEFAULT '[]',
    improvements    JSONB         NOT NULL DEFAULT '[]',
    suggested_jobs  JSONB         NOT NULL DEFAULT '[]',
    created_at      TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP     NOT NULL DEFAULT NOW(),
    deleted         BOOLEAN       NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_cv_analysis_user    ON cv_analyses(user_id)                    WHERE deleted = FALSE;
CREATE INDEX idx_cv_analysis_user_ws ON cv_analyses(user_id, workspace_mode)   WHERE deleted = FALSE;
CREATE INDEX idx_cv_analysis_status  ON cv_analyses(user_id, status)            WHERE deleted = FALSE;
CREATE INDEX idx_cv_analysis_date    ON cv_analyses(user_id, analyzed_at DESC) WHERE deleted = FALSE;

-- Préférence de mode workspace par utilisateur (recruteur / candidat / rh)
CREATE TABLE cv_workspace_settings (
    id          VARCHAR(36)  PRIMARY KEY,
    user_id     VARCHAR(36)  NOT NULL UNIQUE,
    mode        VARCHAR(20)  NOT NULL DEFAULT 'recruiter',
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted     BOOLEAN      NOT NULL DEFAULT FALSE
);
