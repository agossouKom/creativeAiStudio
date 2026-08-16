CREATE TABLE IF NOT EXISTS card_designs (
    id            VARCHAR(36)   PRIMARY KEY,
    user_id       VARCHAR(128)  NOT NULL,
    name          VARCHAR(255)  NOT NULL,
    template_id   VARCHAR(32)   NOT NULL,
    category      VARCHAR(64)   NOT NULL,
    card_data     JSONB         NOT NULL DEFAULT '{}',
    persons       JSONB         NOT NULL DEFAULT '[]',
    editor_objects JSONB        NOT NULL DEFAULT '[]',
    edited_html   TEXT          NOT NULL DEFAULT '',
    copies        INT           NOT NULL DEFAULT 1,
    pdf_format    VARCHAR(32)   NOT NULL DEFAULT 'portrait',
    deleted       BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_designs_user ON card_designs(user_id) WHERE deleted = FALSE;
