package com.creativeai.auth.dto.response;

import com.creativeai.auth.model.enums.PaymentMode;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record VenteResponse(
        String id,
        String clientId,
        String clientNom,
        List<LigneVenteResponse> lignes,
        BigDecimal total,
        BigDecimal montant,
        Integer quantite,
        PaymentMode paymentMode,
        LocalDateTime createdAt
) {}
