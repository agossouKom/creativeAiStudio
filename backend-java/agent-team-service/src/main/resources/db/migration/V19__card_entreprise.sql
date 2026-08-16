-- V19: Table card_entreprise (données sociétés centralisées)
CREATE TABLE IF NOT EXISTS card_entreprise (
    id                    VARCHAR(36)  NOT NULL PRIMARY KEY,
    user_id               VARCHAR(128) NOT NULL,
    code                  VARCHAR(32),

    -- Identité légale
    raison_social         VARCHAR(255) NOT NULL,
    sigle_entreprise      VARCHAR(64),
    forme_juridique       VARCHAR(64),
    ifu                   VARCHAR(64),
    rccm                  VARCHAR(128),
    capital_social        VARCHAR(128),

    -- Contact
    email                 VARCHAR(255),
    contact               VARCHAR(64),
    telephone             VARCHAR(64),
    fax                   VARCHAR(64),
    site_web              VARCHAR(255),

    -- Localisation
    adresse               TEXT,
    boite_postale         VARCHAR(64),
    ville                 VARCHAR(128),
    pays                  VARCHAR(128),

    -- Activité
    secteur_activite      VARCHAR(255),
    niche                 VARCHAR(255),
    description           TEXT,

    -- Responsable
    responsable           VARCHAR(255),
    titre_responsable     VARCHAR(128),

    -- Visuels & documents
    logo                  TEXT,
    armoirie              TEXT,
    cachet                TEXT,
    signature_responsable TEXT,
    couleur1              VARCHAR(16),
    couleur2              VARCHAR(16),

    -- Audit
    created_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted               BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_card_entreprise_user   ON card_entreprise(user_id);
CREATE INDEX IF NOT EXISTS idx_card_entreprise_raison ON card_entreprise(raison_social, user_id);

-- Lier card_builder à card_entreprise (nullable)
ALTER TABLE card_builder ADD COLUMN IF NOT EXISTS entreprise_id VARCHAR(36);
CREATE INDEX IF NOT EXISTS idx_cb_entreprise_id ON card_builder(entreprise_id);
