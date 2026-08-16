package com.creativeai.auth.dto.response;

import java.time.LocalDateTime;

public record CategorieResponse(
        String id,
        String libelle,
        boolean active,
        boolean deleted,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
