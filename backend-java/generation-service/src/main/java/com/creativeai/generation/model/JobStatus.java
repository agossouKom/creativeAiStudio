package com.creativeai.generation.model;

public enum JobStatus {
    /** Commande publiée sur Kafka, en attente de prise en charge par un worker. */
    QUEUED,
    /** Un worker a démarré le traitement (progressions, stockage, finalisation). */
    PROCESSING,
    /** Sorties durablement stockées dans MinIO. */
    DONE,
    /** Échec définitif du worker, ou stockage impossible. */
    FAILED
}
