package com.creativeai.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record LigneVenteRequest(
        @NotBlank String produitId,
        @Positive int quantite
) {}
