package com.creativeai.auth.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Supports QUICK ADD: if clientPubId is null and clientPub is provided,
 * a new ClientPub is created inline.
 */
public record PubRequest(
        @NotNull LocalDateTime debut,
        @NotNull LocalDateTime fin,
        List<String> imageUrls,

        // QUICK ADD: provide either id (existing) or full object (new)
        String clientPubId,
        ClientPubRequest clientPub,    // quick-add

        Boolean active,
        Integer duree,
        @NotNull @Positive BigDecimal prix
) {}
