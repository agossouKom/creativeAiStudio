package com.creativeai.auth.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record ProduitResponse(
        String id,
        String categorieId,
        String categorieLibelle,
        String libelle,
        BigDecimal prix,
        List<ProduitFonctionResponse> fonctions,
        String urlImage,
        boolean active,
        boolean deleted,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
