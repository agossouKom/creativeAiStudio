-- Propositions de création d'agent initiées par le SCRUM MANAGER, validées par le patron (utilisateur).
-- L'agent réel n'est créé qu'après approbation explicite (un clic) de l'utilisateur.
CREATE TABLE IF NOT EXISTS agent_proposals (
    id                  VARCHAR(36) PRIMARY KEY,
    agent_type          VARCHAR(30)  NOT NULL,
    name                VARCHAR(150),
    description         TEXT,
    team_id             VARCHAR(36),
    user_id             VARCHAR(36)  NOT NULL,
    requester_agent_id  VARCHAR(36),
    status              VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    agent_id            VARCHAR(36),
    decided_at          TIMESTAMP,
    created_at          TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT now(),
    deleted             BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_agent_prop_user_status ON agent_proposals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_prop_team      ON agent_proposals(team_id);