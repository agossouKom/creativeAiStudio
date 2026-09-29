-- ============================================================================
--  V3 — Programmation de publications
-- ============================================================================
--  Une publication planifiée est une demande de diffusion différée. Elle vit à
--  côté de social_publish_requests (V1), qui elle ne conserve que le résultat.
--
--  Choix structurants :
--
--  * `scheduled_at` / `end_at` en TIMESTAMP WITH TIME ZONE. Une publication
--    programmée à 10 h doit partir à 10 h chez l'utilisateur, quel que soit le
--    fuseau du conteneur. Stocker en TIMESTAMP sans zone reviendrait à
--    interpretter la même valeur differently selon DST et selon l'heure d'été :
--    c'est le bug classique de « publié à 2 h du matin au lieu de 10 h ».
--
--  * `end_at` est facultatif : il borne une campagne (publicité qui tourne
--    pendant une semaine) sans dupliquer sept lignes de programmation.
--
--  Pas de colonne « idempotency_key » : la double diffusion est évitée par la
--  réservation conditionnelle du déclencheur (UPDATE ... WHERE status =
--  'SCHEDULED'), dont l'affectation de ligne renvoie 0 si un tick concurrent a
--  déjà pris la demande. Le statut DISPATCHED sert ensuite de témoin : une ligne
--  restée DISPATCHED après redémarrage est reprise explicitement, jamais
--  rediffusée à l'aveugle.
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduled_publications (
    id                 BIGSERIAL PRIMARY KEY,
    user_email         VARCHAR(255) NOT NULL,
    job_id             VARCHAR(64)  NOT NULL,
    execution_version  INTEGER      NOT NULL,
    output_index       INTEGER      NOT NULL,

    agent_id           VARCHAR(64),
    platform           VARCHAR(30)  NOT NULL,
    caption            VARCHAR(2200),

    -- Instantané de la première publication, en UTC.
    scheduled_at       TIMESTAMPTZ  NOT NULL,
    -- Dernière publication autorisée (campagne). NULL = diffusion unique.
    end_at             TIMESTAMPTZ,

    status             VARCHAR(20)  NOT NULL DEFAULT 'SCHEDULED',
    attempts           INTEGER      NOT NULL DEFAULT 0,
    last_error_code    VARCHAR(80),
    last_error         VARCHAR(1000),

    -- Renseigné après la première diffusion : permet de retrouver la ligne
    -- d'historique correspondante sans rejouer la recherche.
    first_request_id   VARCHAR(36),
    published_count    INTEGER      NOT NULL DEFAULT 0,

    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_sched_status
        CHECK (status IN ('SCHEDULED', 'DISPATCHED', 'PUBLISHED', 'FAILED', 'CANCELLED', 'EXPIRED')),
    CONSTRAINT ck_sched_window
        CHECK (end_at IS NULL OR end_at >= scheduled_at)
);

COMMENT ON TABLE scheduled_publications IS
    'Publications différées. end_at NULL = diffusion unique. Timestamps en UTC.';

-- La requête du déclencheur filtre systématiquement sur le couple
-- (statut, échéance) trié : cet index évite un scan de la table à chaque tick.
CREATE INDEX IF NOT EXISTS idx_sched_due
    ON scheduled_publications(status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_sched_user
    ON scheduled_publications(user_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sched_job
    ON scheduled_publications(job_id);

--  Reprise après redémarrage : une ligne DISPATCHED dont la diffusion n'a jamais
--  été confirmée doit pouvoir être Found, pas être perdue ni rejouée à l'aveugle.
CREATE INDEX IF NOT EXISTS idx_sched_dispatched
    ON scheduled_publications(status, updated_at)
    WHERE status = 'DISPATCHED';

-- ---------------------------------------------------------------------------
-- Écart assumé avec le reste du schéma, à signaler :
-- social_publish_requests (V1) et generation_jobs (V1) sont en TIMESTAMP sans
-- zone, donc interprétés dans le fuseau du conteneur. Ici on est en TIMESTAMPTZ.
-- C'est volontaire : l'échéance d'une publication est une promesse d'heure
-- civile et l'heure d'été doit être gérée par PostgreSQL, pas par un décalage
-- calculé à la main. Conséquence à traiter plus tard dans une migration
-- dédiée (aligner l'historique et les jobs), et non ici : modifier V1 est
-- impossible, elle est déjà appliquée en production, et V3 doit rester
-- réversible.
-- ---------------------------------------------------------------------------
