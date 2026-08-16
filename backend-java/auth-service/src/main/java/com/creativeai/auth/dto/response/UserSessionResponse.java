package com.creativeai.auth.dto.response;

import java.time.LocalDateTime;

public record UserSessionResponse(
    String id,
    String userId,
    String userEmail,
    String ipAddress,
    String userAgent,
    String deviceType,
    LocalDateTime accessTokenExpiresAt,
    boolean revoked,
    LocalDateTime lastAccessedAt,
    LocalDateTime createdAt
) {}
