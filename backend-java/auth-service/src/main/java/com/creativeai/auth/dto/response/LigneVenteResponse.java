package com.creativeai.auth.dto.response;

import java.math.BigDecimal;

public record LigneVenteResponse(
        String id,
        String produitId,
        String produitLibelle,
        Integer quantite,
        BigDecimal prixUnitaire,
        BigDecimal sousTotal
) {}
