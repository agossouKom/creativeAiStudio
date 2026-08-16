package com.creativeai.auth.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record PromotionResponse(
        String id,
        String libelle,
        LocalDateTime dateDebut,
        LocalDateTime dateFin,
        List<ProduitResponse> produits,
        BigDecimal prixPromo,
        boolean active,
        boolean deleted,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
