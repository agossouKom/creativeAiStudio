package com.creativeai.auth.dto.response;

import com.creativeai.auth.model.enums.Abonnement;
import com.creativeai.auth.model.enums.Role;
import java.time.LocalDateTime;

public record UserResponse(
    String id,
    String email,
    String fullName,
    Role role,
    Abonnement abonnement,
    Integer credits,
    boolean enabled,
    boolean deleted,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {}
