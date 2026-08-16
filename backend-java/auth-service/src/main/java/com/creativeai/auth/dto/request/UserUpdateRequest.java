package com.creativeai.auth.dto.request;

import com.creativeai.auth.model.enums.Abonnement;
import com.creativeai.auth.model.enums.Role;

public record UserUpdateRequest(
    String fullName,
    Role role,
    Abonnement abonnement,
    Integer credits,
    Boolean enabled
) {}
