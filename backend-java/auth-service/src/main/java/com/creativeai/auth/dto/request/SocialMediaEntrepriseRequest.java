package com.creativeai.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SocialMediaEntrepriseRequest(
        @NotBlank @Size(max = 100) String plateforme,
        @NotBlank @Size(max = 500) String url,
        @Size(max = 100) String iconClass
) {}
