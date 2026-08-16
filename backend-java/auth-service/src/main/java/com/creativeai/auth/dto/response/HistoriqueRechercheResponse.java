package com.creativeai.auth.dto.response;

import java.time.LocalDateTime;

public record HistoriqueRechercheResponse(
        String id,
        String clientId,
        String clientNom,
        String resultatId,
        String resultatTitre,    // null if not found
        String requete,
        boolean found,
        LocalDateTime createdAt
) {}
