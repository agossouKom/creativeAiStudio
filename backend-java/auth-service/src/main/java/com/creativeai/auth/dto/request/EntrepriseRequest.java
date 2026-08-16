package com.creativeai.auth.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record EntrepriseRequest(
        @NotBlank @Size(max = 150) String nom,
        @Size(max = 150) String raisonSociale,
        @Email @Size(max = 150) String email,
        @Size(max = 30) String telephone,
        @Size(max = 250) String adresse,
        @Size(max = 100) String ville,
        @Size(max = 100) String pays,
        @Size(max = 250) String siteWeb,
        @Size(max = 1000) String logoUrl,
        @Size(max = 1000) String description,
        Boolean active,
        List<SocialMediaEntrepriseRequest> reseauxSociaux
) {}
