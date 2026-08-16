package com.creativeai.auth.dto.request;

import com.creativeai.auth.model.enums.PaymentMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record VenteRequest(
        @NotBlank String clientId,
        @NotEmpty List<LigneVenteRequest> lignes,
        PaymentMode paymentMode
) {}
