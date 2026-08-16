package com.creativeai.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record PromotionRequest(
        @NotBlank String libelle,
        @NotNull LocalDateTime dateDebut,
        @NotNull LocalDateTime dateFin,
        List<String> produitIds,
        @NotNull @Positive BigDecimal prixPromo,
        Boolean active
) {}
