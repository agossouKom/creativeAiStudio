CREATE TABLE IF NOT EXISTS card_productions (
    id          VARCHAR(36)  NOT NULL PRIMARY KEY,
    user_id     VARCHAR(128) NOT NULL,
    design_id   VARCHAR(36),
    design_name VARCHAR(255) NOT NULL,
    template_id VARCHAR(32),
    category    VARCHAR(64),
    entreprise  VARCHAR(255),
    person_count INT          NOT NULL DEFAULT 0,
    copies      INT          NOT NULL DEFAULT 1,
    person_ids  JSONB        NOT NULL DEFAULT '[]',
    person_names JSONB       NOT NULL DEFAULT '[]',
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted     BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_card_prod_user      ON card_productions (user_id);
CREATE INDEX IF NOT EXISTS idx_card_prod_design     ON card_productions (design_id);
CREATE INDEX IF NOT EXISTS idx_card_prod_entreprise ON card_productions (entreprise, user_id);
