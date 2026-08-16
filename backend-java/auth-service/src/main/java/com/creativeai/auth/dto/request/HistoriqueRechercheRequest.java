package com.creativeai.auth.dto.request;

import jakarta.validation.constraints.NotBlank;

public record HistoriqueRechercheRequest(
        @NotBlank String clientId,
        String resultatId,       // null if not found
        @NotBlank String requete,
        boolean found
) {}
