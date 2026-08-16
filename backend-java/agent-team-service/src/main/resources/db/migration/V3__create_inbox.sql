-- ============================================================
-- V3 : Inbox (messages unifiés tous canaux)
-- ============================================================

CREATE TABLE IF NOT EXISTS inbox_messages (
    id              VARCHAR(36)   PRIMARY KEY,
    user_id         VARCHAR(36)   NOT NULL,
    agent_id        VARCHAR(36),
    team_id         VARCHAR(36),
    channel         VARCHAR(20)   NOT NULL,
    direction       VARCHAR(10)   NOT NULL DEFAULT 'INBOUND',
    from_address    VARCHAR(500),
    to_address      VARCHAR(500),
    subject         VARCHAR(1000),
    body            TEXT,
    external_id     VARCHAR(500),
    conversation_id VARCHAR(200),
    status          VARCHAR(15)   NOT NULL DEFAULT 'UNREAD',
    attachments     JSONB,
    metadata        JSONB,
    received_at     TIMESTAMP     NOT NULL DEFAULT NOW(),
    deleted         BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inbox_user       ON inbox_messages(user_id);
CREATE INDEX idx_inbox_agent      ON inbox_messages(agent_id);
CREATE INDEX idx_inbox_team       ON inbox_messages(team_id);
CREATE INDEX idx_inbox_channel    ON inbox_messages(channel);
CREATE INDEX idx_inbox_status     ON inbox_messages(status);
CREATE INDEX idx_inbox_direction  ON inbox_messages(direction);
CREATE INDEX idx_inbox_conv       ON inbox_messages(conversation_id);
CREATE INDEX idx_inbox_ext        ON inbox_messages(external_id);
CREATE INDEX idx_inbox_received   ON inbox_messages(received_at DESC);
CREATE INDEX idx_inbox_user_ch_st ON inbox_messages(user_id, channel, status);
