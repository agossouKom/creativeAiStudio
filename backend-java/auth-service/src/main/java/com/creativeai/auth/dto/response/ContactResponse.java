package com.creativeai.auth.dto.response;

import java.time.LocalDateTime;

public record ContactResponse(
        String id,
        String nomComplet,
        String email,
        String sujet,
        String message,
        boolean traite,
        LocalDateTime createdAt
) {}
