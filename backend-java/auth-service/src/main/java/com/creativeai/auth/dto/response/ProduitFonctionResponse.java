package com.creativeai.auth.dto.response;

import java.time.LocalDateTime;

public record ProduitFonctionResponse(
        String id,
        String libelle,
        boolean active,
        boolean disponible,
        LocalDateTime createdAt
) {}
