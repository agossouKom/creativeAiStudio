package com.creativeai.auth.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ContactRequest(
        @NotBlank @Size(max = 200) String nomComplet,
        @NotBlank @Email @Size(max = 150) String email,
        @NotBlank @Size(max = 250) String sujet,
        @NotBlank @Size(max = 3000) String message
) {}
