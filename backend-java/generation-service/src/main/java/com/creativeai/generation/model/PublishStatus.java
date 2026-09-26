package com.creativeai.generation.model;

public enum PublishStatus {
    PENDING,
    /** Envoyé à agent-team-service / API de la plateforme. */
    DISPATCHED,
    PUBLISHED,
    FAILED,
    /** Plateforme non couverte (adaptateur absent, review d'app non faite, etc.). */
    REJECTED
}
