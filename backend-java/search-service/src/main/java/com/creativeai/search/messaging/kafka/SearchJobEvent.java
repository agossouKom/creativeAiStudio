package com.creativeai.search.messaging.kafka;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;

/** Message léger publié dans Kafka — contient l'URL MinIO, pas le fichier. */
@Data
@Builder
public class SearchJobEvent {
    private String   jobId;
    private String   userEmail;
    private String   searchType;     // AUDIO | VIDEO | FACE
    private String   fileUrl;        // URL MinIO — pattern Claim Check
    private String   fileName;
    private String   textQuery;      // Pour recherche personne par nom
    private String   phoneQuery;     // Pour recherche par téléphone
    @Builder.Default
    private Instant  createdAt = Instant.now();
}
