-- ─────────────────────────────────────────────────────────────────────────────
-- V20 : Tables spécialisées par catégorie de carte
--       card_base (table mère) + 4 tables filles
--       Migration des données existantes depuis card_builder
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Table mère commune ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS card_base (
    id                VARCHAR(36)   PRIMARY KEY,
    user_id           VARCHAR(128)  NOT NULL,
    code              VARCHAR(32),
    category          VARCHAR(32)   NOT NULL,
    card_design_id    VARCHAR(36),
    entreprise_id     VARCHAR(36),
    couleur1          VARCHAR(16)   DEFAULT '#1565c0',
    couleur2          VARCHAR(16)   DEFAULT '#ffd600',
    deleted           BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cb2_user     ON card_base(user_id)           WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_cb2_category ON card_base(category, user_id) WHERE deleted = FALSE;

-- ── Badge Identité ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS card_badge_identite (
    id                      VARCHAR(36) PRIMARY KEY REFERENCES card_base(id) ON DELETE CASCADE,
    nom                     VARCHAR(128),
    prenoms                 VARCHAR(255),
    photo                   TEXT,
    civilite                VARCHAR(16),
    genre                   VARCHAR(8),
    date_naissance          VARCHAR(32),
    lieu_naissance          VARCHAR(255),
    nationalite             VARCHAR(64),
    titre_poste             VARCHAR(255),
    departement             VARCHAR(128),
    service                 VARCHAR(128),
    matricule               VARCHAR(128),
    date_embauche           VARCHAR(32),
    date_expiration         VARCHAR(32),
    access_type             VARCHAR(32),
    niveau_acces            SMALLINT,
    zones_acces             TEXT,
    email                   VARCHAR(255),
    telephone               VARCHAR(64),
    adresse                 TEXT,
    site_web                VARCHAR(255),
    entreprise              VARCHAR(255),
    sigle_entreprise        VARCHAR(64),
    logo                    TEXT,
    armoirie                TEXT,
    cachet                  TEXT,
    signature_responsable   TEXT,
    photo_format            VARCHAR(8)  DEFAULT 'ROND',
    qr_code                 TEXT,
    qr_data_url             TEXT,
    code_barre              TEXT
);

-- ── Carte de Visite ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS card_carte_visite (
    id                  VARCHAR(36) PRIMARY KEY REFERENCES card_base(id) ON DELETE CASCADE,
    nom                 VARCHAR(128),
    prenoms             VARCHAR(255),
    photo               TEXT,
    civilite            VARCHAR(16),
    titre_poste         VARCHAR(255),
    specialite          VARCHAR(255),
    certifications      TEXT,
    slogan              VARCHAR(255),
    email               VARCHAR(255),
    email_secondaire    VARCHAR(255),
    telephone           VARCHAR(64),
    mobile              VARCHAR(64),
    fax                 VARCHAR(64),
    whatsapp            VARCHAR(64),
    skype               VARCHAR(64),
    site_web            VARCHAR(255),
    linkedin            VARCHAR(255),
    twitter             VARCHAR(128),
    instagram           VARCHAR(128),
    facebook            VARCHAR(128),
    adresse_ligne1      VARCHAR(255),
    adresse_ligne2      VARCHAR(255),
    ville               VARCHAR(128),
    code_postal         VARCHAR(16),
    pays                VARCHAR(64),
    entreprise          VARCHAR(255),
    sigle_entreprise    VARCHAR(64),
    logo                TEXT,
    matricule           VARCHAR(128),
    qr_code             TEXT,
    qr_data_url         TEXT,
    qr_type             VARCHAR(16)  DEFAULT 'VCARD'
);

-- ── Badge Événement ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS card_badge_evenement (
    id                          VARCHAR(36) PRIMARY KEY REFERENCES card_base(id) ON DELETE CASCADE,
    nom                         VARCHAR(128),
    prenoms                     VARCHAR(255),
    photo                       TEXT,
    titre_participant            VARCHAR(255),
    organisation_participant     VARCHAR(255),
    pays_origine                VARCHAR(64),
    titre_evenement             VARCHAR(255),
    sous_titre_evenement        VARCHAR(255),
    owner_evenement             VARCHAR(255),
    contact_organisateur        VARCHAR(128),
    date_debut                  VARCHAR(32),
    date_fin                    VARCHAR(32),
    heure_debut                 VARCHAR(16),
    heure_fin                   VARCHAR(16),
    lieu_evenement              VARCHAR(255),
    salle                       VARCHAR(128),
    stand                       VARCHAR(64),
    table_numero                VARCHAR(32),
    ville_evenement             VARCHAR(128),
    pays_evenement              VARCHAR(64),
    type_acces                  VARCHAR(32),
    numero_badge                VARCHAR(64),
    sessions_autorisees         TEXT,
    validite_journee            BOOLEAN     DEFAULT FALSE,
    logo_evenement              TEXT,
    image_fond                  TEXT,
    couleur_theme               VARCHAR(16),
    qr_code                     TEXT,
    qr_data_url                 TEXT,
    code_barre                  TEXT
);

-- ── Carte Scolaire ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS card_carte_scolaire (
    id                    VARCHAR(36) PRIMARY KEY REFERENCES card_base(id) ON DELETE CASCADE,
    nom                   VARCHAR(128),
    prenoms               VARCHAR(255),
    photo                 TEXT,
    genre                 VARCHAR(8),
    date_naissance        VARCHAR(32),
    lieu_naissance        VARCHAR(255),
    nationalite           VARCHAR(64),
    numero_matricule      VARCHAR(128),
    numero_inscription    VARCHAR(128),
    classe                VARCHAR(128),
    niveau                VARCHAR(32),
    filiere               VARCHAR(128),
    serie                 VARCHAR(32),
    annee_scolaire        VARCHAR(32),
    date_inscription      VARCHAR(32),
    date_expiration       VARCHAR(32),
    type_apprenant        VARCHAR(32),
    boursier              BOOLEAN     DEFAULT FALSE,
    type_bourse           VARCHAR(128),
    contact               VARCHAR(64),
    email                 VARCHAR(255),
    adresse               TEXT,
    nom_tuteur            VARCHAR(255),
    contact_tuteur        VARCHAR(64),
    relation_tuteur       VARCHAR(32),
    etablissement         VARCHAR(255),
    sigle_ets             VARCHAR(64),
    type_etablissement    VARCHAR(32),
    adresse_ets           TEXT,
    ville_ets             VARCHAR(128),
    pays_ets              VARCHAR(64),
    logo_ets              TEXT,
    armoirie              TEXT,
    cachet                TEXT,
    signature_directeur   TEXT,
    nom_directeur         VARCHAR(255),
    couleur_bandeau1      VARCHAR(16),
    couleur_bandeau2      VARCHAR(16),
    titre_carte           VARCHAR(64)  DEFAULT 'IDENTITY CARD',
    groupe_sanguin        VARCHAR(8),
    allergies             TEXT,
    qr_code               TEXT,
    qr_data_url           TEXT,
    code_barre            TEXT
);

-- ── Migration données card_builder → nouvelles tables ─────────────────────────

-- 1. card_base (table mère commune)
INSERT INTO card_base (id, user_id, code, category, card_design_id, entreprise_id,
    couleur1, couleur2, deleted, created_at, updated_at)
SELECT id, user_id, code, category, card_design_id, entreprise_id,
    COALESCE(couleur1, '#1565c0'), COALESCE(couleur2, '#ffd600'),
    deleted, created_at, updated_at
FROM card_builder
ON CONFLICT (id) DO NOTHING;

-- 2. BADGE_IDENTITE
INSERT INTO card_badge_identite (id, nom, prenoms, photo, titre_poste, matricule,
    email, telephone, adresse, site_web, entreprise, sigle_entreprise, logo,
    access_type, date_naissance, lieu_naissance, armoirie, cachet,
    signature_responsable, qr_code)
SELECT id, nom, prenoms, photo, titre, matricule,
    email, contact, adresse, site_web, entreprise, sigle_entreprise, logo,
    access_type, date_naissance, lieu_naissance, armoirie, cachet,
    signature_responsable, qr_code
FROM card_builder
WHERE category = 'BADGE_IDENTITE'
ON CONFLICT (id) DO NOTHING;

-- 3. CARTE_VISITE
INSERT INTO card_carte_visite (id, nom, prenoms, photo, titre_poste,
    email, telephone, site_web, adresse_ligne1, entreprise, sigle_entreprise,
    logo, matricule, qr_code)
SELECT id, nom, prenoms, photo, titre,
    email, contact, site_web, adresse, entreprise, sigle_entreprise,
    logo, matricule, qr_code
FROM card_builder
WHERE category = 'CARTE_VISITE'
ON CONFLICT (id) DO NOTHING;

-- 4. BADGE_EVENEMENT
INSERT INTO card_badge_evenement (id, nom, prenoms, photo, titre_participant,
    organisation_participant, titre_evenement, sous_titre_evenement, owner_evenement,
    date_debut, lieu_evenement, salle, stand, type_acces, qr_code)
SELECT id, nom, prenoms, photo, titre,
    entreprise, titre_evenement, sous_titre_evenement, owner_evenement,
    date_evenement, adresse, salle_evenement, stand_evenement, access_type, qr_code
FROM card_builder
WHERE category = 'BADGE_EVENEMENT'
ON CONFLICT (id) DO NOTHING;

-- 5. CARTE_SCOLAIRE
INSERT INTO card_carte_scolaire (id, nom, prenoms, photo, date_naissance,
    lieu_naissance, numero_matricule, classe, annee_scolaire, contact, email,
    etablissement, sigle_ets, armoirie, cachet, signature_directeur, qr_code)
SELECT id, nom, prenoms, photo, date_naissance,
    lieu_naissance, matricule, classe, annee_scolaire, contact, email,
    etablissement_scolaire, sigle_ets, armoirie, cachet, signature_responsable, qr_code
FROM card_builder
WHERE category = 'CARTE_SCOLAIRE'
ON CONFLICT (id) DO NOTHING;
