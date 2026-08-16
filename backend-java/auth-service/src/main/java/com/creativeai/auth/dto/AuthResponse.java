package com.creativeai.auth.dto;

public record AuthResponse(
        String accessToken,
        String tokenType,
        String userId,
        String email,
        String fullName,
        String role,
        String abonnement,
        int credits
) {}

