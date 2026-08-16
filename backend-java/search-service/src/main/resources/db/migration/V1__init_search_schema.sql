-- V1__init_search_schema.sql
CREATE TABLE search_history (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    file_name VARCHAR(255),
    query TEXT,
    result_json TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_search_user_email ON search_history(user_email);
CREATE INDEX idx_search_status ON search_history(status);
