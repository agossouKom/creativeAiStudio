-- V6 : Historique d'exécution des tâches
-- Trace chaque action effectuée par un agent : outil appelé, email envoyé, LLM appelé…
-- Une tâche DONE conserve ainsi la trace complète de ce qui s'est passé.

CREATE TABLE task_execution_events (
    id           UUID         NOT NULL DEFAULT gen_random_uuid(),
    task_id      VARCHAR(36)  NOT NULL,
    agent_id     VARCHAR(36),
    user_id      VARCHAR(36)  NOT NULL,
    -- Types : TASK_STARTED | TOOL_CALLED | TOOL_RESULT | LLM_CALL | EMAIL_SENT
    --         TASK_COMPLETED | TASK_FAILED | DELEGATION | WHATSAPP_SENT | SOCIAL_POSTED
    event_type   VARCHAR(50)  NOT NULL,
    tool_name    VARCHAR(100),
    -- Données contextuelles (paramètres outil, résultat, erreur…)
    event_data   JSONB,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_task_execution_events PRIMARY KEY (id)
);

CREATE INDEX idx_exec_task_id   ON task_execution_events (task_id);
CREATE INDEX idx_exec_user_id   ON task_execution_events (user_id);
CREATE INDEX idx_exec_agent_id  ON task_execution_events (agent_id);
CREATE INDEX idx_exec_type      ON task_execution_events (event_type);
CREATE INDEX idx_exec_created   ON task_execution_events (created_at DESC);

COMMENT ON TABLE  task_execution_events IS 'Trace horodatée de toutes les actions agent par tâche';
COMMENT ON COLUMN task_execution_events.event_data IS 'Payload JSON : params outil, résultat, email to/subject, durée LLM…';
