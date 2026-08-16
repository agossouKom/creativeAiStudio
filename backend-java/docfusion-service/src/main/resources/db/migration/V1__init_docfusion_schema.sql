CREATE TABLE doc_jobs (
    id           BIGSERIAL PRIMARY KEY,
    job_id       VARCHAR(36)  NOT NULL UNIQUE,
    user_email   VARCHAR(255) NOT NULL,
    operation    VARCHAR(50)  NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'PROCESSING',
    file_name    VARCHAR(500),
    result_url   VARCHAR(2000),
    result_text  TEXT,
    error_msg    VARCHAR(1000),
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX idx_doc_jobs_user  ON doc_jobs(user_email);
CREATE INDEX idx_doc_jobs_jobid ON doc_jobs(job_id);
