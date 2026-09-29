-- ============================================================================
--  V26 — Réseaux sociaux : configuration plateforme + comptes utilisateurs
-- ============================================================================
--  Deux tables, jamais une par réseau : ajouter YouTube ou TikTok plus tard ne
--  doit pas demander de migration de structure.
--
--  Séparation volontaire (modèle Buffer/Metricool) :
--    social_platforms      → ce que la PLATEFORME possède (client_id/secret)
--    user_social_accounts  → ce que chaque UTILISATEUR a autorisé (ses jetons)
--
--  Les jetons sont stockés chiffrés (colonnes *_enc) : c'est le même
--  EncryptionService AES-GCM que celui des channels.
-- ============================================================================

CREATE TABLE IF NOT EXISTS social_platforms (
    id                  VARCHAR(40)  PRIMARY KEY,
    display_name        VARCHAR(120) NOT NULL,
    auth_type           VARCHAR(20)  NOT NULL DEFAULT 'oauth2',
    client_id           VARCHAR(255),
    client_secret_enc   TEXT,
    scopes              TEXT         NOT NULL DEFAULT '[]',
    token_endpoint      VARCHAR(500),
    refresh_endpoint    VARCHAR(500),
    access_token_ttl    BIGINT,
    refresh_token_ttl   BIGINT,
    extra_config        TEXT         NOT NULL DEFAULT '{}',
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order          INTEGER      NOT NULL DEFAULT 0,
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE social_platforms IS
    'Paramètres applicatifs par réseau, gérés par l''administrateur. Aucun secret en clair.';

-- ---------------------------------------------------------------------------
--  Comptes connectés : un compte social appartient à UN utilisateur.
--  La clé unique (user_id, platform_id, platform_account_id) empêche de
--  connecter deux fois le même compte. 'user_id' est l'email : c'est le
--  subject du JWT et la clé étrangère logique de agents.owner_id.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_social_accounts (
    id                     UUID         PRIMARY KEY,
    user_id                VARCHAR(320) NOT NULL,
    platform_id            VARCHAR(40)  NOT NULL REFERENCES social_platforms(id) ON DELETE RESTRICT,
    platform_account_id    VARCHAR(300) NOT NULL,
    platform_account_name  VARCHAR(300),
    access_token_enc       TEXT,
    refresh_token_enc      TEXT,
    token_expires_at       TIMESTAMP,
    scopes_granted         TEXT         NOT NULL DEFAULT '[]',
    extra_account_data     TEXT         NOT NULL DEFAULT '{}',
    -- TikTok : access token 24 h. Sans ce témoin, on ne sait pas qu'il faut
    -- rafraîchir avant qu'il n'expire.
    needs_refresh          BOOLEAN      NOT NULL DEFAULT FALSE,
    status                 VARCHAR(20)  NOT NULL DEFAULT 'CONNECTED',
    connected_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
    last_refreshed_at      TIMESTAMP,
    last_error             TEXT,
    deleted                BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at             TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Unicite partielle et non globale : un compte deconnecte est conserve (deleted)
-- pour l'historique, donc une contrainte globale empacherait l'utilisateur de
-- reconnecter la meme Page et echouerait sur une violation d'unicite.
CREATE UNIQUE INDEX IF NOT EXISTS uk_user_social_account_active
    ON user_social_accounts(user_id, platform_id, platform_account_id)
    WHERE deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_usa_user     ON user_social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_usa_platform ON user_social_accounts(platform_id);
-- Piège TikTok / YouTube : un access token court doit pouvoir être trouvé
-- vite quand une publication échoue sur expiration.
CREATE INDEX IF NOT EXISTS idx_usa_expiring ON user_social_accounts(token_expires_at)
    WHERE needs_refresh = TRUE;

COMMENT ON TABLE user_social_accounts IS
    'Comptes sociaux connectés par les utilisateurs. Jetons chiffrés, jamais exposés par l''API.';

-- ---------------------------------------------------------------------------
--  Lien additif vers la table channels existante.
--  NULLABLE et SANS contrainte : un canal créé avant cette migration (et donc
--  dépourvu de user_social_accounts) reste valide et continue de publier avec
--  ses propres credentials. C'est ce qui garantit qu'on ne casse rien.
-- ---------------------------------------------------------------------------
ALTER TABLE channels
    ADD COLUMN IF NOT EXISTS social_account_id UUID;

CREATE INDEX IF NOT EXISTS idx_channels_social_account
    ON channels(social_account_id);

COMMENT ON COLUMN channels.social_account_id IS
    'Compte utilisateur propriétaire, si le canal a été créé via le flux OAuth unifié.';

-- ---------------------------------------------------------------------------
--  Données initiales. Les scopes sont ceux réellement exigés par l'API de
--  chaque réseau — se tromper ici se paie au moment de la connexion.
--  Les valeurs secrètes restent NULL : l'administrateur les saisit dans le
--  dashboard, jamais dans une migration.
-- ---------------------------------------------------------------------------
INSERT INTO social_platforms
    (id, display_name, auth_type, scopes, token_endpoint, refresh_endpoint,
     access_token_ttl, refresh_token_ttl, extra_config, is_active, sort_order)
VALUES
    ('facebook', 'Facebook', 'oauth2',
     '["pages_show_list","pages_read_engagement","pages_manage_posts","pages_manage_video_posts"]',
     'https://graph.facebook.com/v19.0/oauth/access_token',
     NULL,
     5184000, 5184000,
     '{"graphVersion":"v19.0","requiresProfessionalAccount":true,"accountKey":"pageId","maxDurationSeconds":14400}',
     TRUE, 10),

    ('instagram', 'Instagram', 'oauth2',
     '["instagram_basic","instagram_content_publish","instagram_business_content_publish","pages_show_list","pages_read_engagement"]',
     'https://graph.facebook.com/v19.0/oauth/access_token',
     NULL,
     5184000, 5184000,
     '{"graphVersion":"v19.0","requiresBusinessAccount":true,"mustBeLinkedToFacebookPage":true,"accountKey":"igUserId","maxDurationSeconds":900}',
     TRUE, 20),

    ('youtube', 'YouTube', 'oauth2',
     '["https://www.googleapis.com/auth/youtube.upload"]',
     'https://oauth2.googleapis.com/token',
     'https://oauth2.googleapis.com/token',
     3600, 604800,
     '{"clientType":"web","accountKey":"channelId"}',
     TRUE, 30),

    ('linkedin', 'LinkedIn', 'oauth2',
     '["w_organization_social"]',
     'https://www.linkedin.com/oauth/v2/accessToken',
     NULL,
     5184000, 31536000,
     '{"requiresOrganizationAdmin":true,"paidApi":true,"accountKey":"organizationUrn"}',
     TRUE, 40),

    ('twitter_x', 'X (Twitter)', 'oauth2',
     '["tweet.read","tweet.write","users.read","offline.access"]',
     'https://api.twitter.com/2/oauth2/token',
     'https://api.twitter.com/2/oauth2/token',
     7200, 5184000,
     '{"pkce":"S256","billingByAppOwner":true,"allowPerUserAppCredentials":true,"accountKey":"userId"}',
     TRUE, 50),

    ('tiktok', 'TikTok', 'oauth2',
     '["video.publish","video.upload"]',
     'https://open.tiktokapis.com/v2/oauth/token/',
     'https://open.tiktokapis.com/v2/oauth/refresh_token/',
     86400, 31536000,
     '{"requiresAudit":true,"defaultChunkSize":10485760,"autoRefreshRequired":true,"accountKey":"openId"}',
     TRUE, 60)
ON CONFLICT (id) DO NOTHING;
