package com.creativeai.auth.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record PubResponse(
        String id,
        LocalDateTime debut,
        LocalDateTime fin,
        List<String> imageUrls,
        ClientPubResponse clientPub,
        boolean active,
        boolean deleted,
        Integer duree,
        BigDecimal prix,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
