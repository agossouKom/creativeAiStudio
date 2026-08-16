package com.creativeai.auth.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UserCreateRequest(
    @NotBlank(message = "L'email est obligatoire")
    @Email(message = "L'email doit être valide")
    String email,

    @NotBlank(message = "Le nom complet est obligatoire")
    String fullName,

    @NotBlank(message = "Le rôle est obligatoire")
    String role,

    String abonnement,

    @NotNull(message = "Les crédits sont obligatoires")
    Integer credits,

    Boolean enabled,

    String password,
    
    String confirmPassword
) {}
