package com.creativeai.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FonctionRequest(
        @NotBlank @Size(max = 200) String libelle,
        Boolean active
) {}
