package com.creativeai.auth.dto.response;

import java.time.LocalDateTime;

public record SocialMediaClientResponse(
        String id,
        String plateforme,
        String url,
        String iconClass,
        boolean active,
        LocalDateTime createdAt
) {}
