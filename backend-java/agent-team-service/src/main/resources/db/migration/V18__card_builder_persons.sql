-- ─────────────────────────────────────────────────────────────────
-- V18 : table card_builder (personnes par catégorie de carte)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS card_builder (
    id                       VARCHAR(36)   PRIMARY KEY,

    -- Référence utilisateur et design
    user_id                  VARCHAR(128)  NOT NULL,
    card_design_id           VARCHAR(36),
    category                 VARCHAR(32)   NOT NULL,
    code                     VARCHAR(32),

    -- Identité commune
    nom                      VARCHAR(128),
    prenoms                  VARCHAR(255),
    photo                    TEXT,
    titre                    VARCHAR(255),
    profession               VARCHAR(255),
    email                    VARCHAR(255),
    contact                  VARCHAR(64),
    adresse                  TEXT,
    site_web                 VARCHAR(255),
    description              TEXT,
    matricule                VARCHAR(128),
    signature                TEXT,
    qr_code                  TEXT,
    couleur1                 VARCHAR(16)   NOT NULL DEFAULT '#1565c0',
    couleur2                 VARCHAR(16)   NOT NULL DEFAULT '#ffd600',

    -- Entreprise / organisation
    entreprise               VARCHAR(255),
    sigle_entreprise         VARCHAR(64),
    logo                     TEXT,
    access_type              VARCHAR(32),

    -- Scolaire
    date_naissance           VARCHAR(32),
    lieu_naissance           VARCHAR(255),
    etablissement_scolaire   VARCHAR(255),
    sigle_ets                VARCHAR(64),
    armoirie                 TEXT,
    classe                   VARCHAR(128),
    annee_scolaire           VARCHAR(32),
    cachet                   TEXT,
    signature_responsable    TEXT,

    -- Événement
    titre_evenement          VARCHAR(255),
    owner_evenement          VARCHAR(255),
    sous_titre_evenement     VARCHAR(255),
    date_evenement           VARCHAR(64),
    salle_evenement          VARCHAR(255),
    stand_evenement          VARCHAR(128),

    -- Audit
    deleted                  BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cb_user
    ON card_builder(user_id) WHERE deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_cb_category
    ON card_builder(category, user_id) WHERE deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_cb_entreprise
    ON card_builder(entreprise, user_id) WHERE deleted = FALSE;

-- Ajouter company sur card_designs pour filtrage production
ALTER TABLE card_designs
    ADD COLUMN IF NOT EXISTS company VARCHAR(255);
