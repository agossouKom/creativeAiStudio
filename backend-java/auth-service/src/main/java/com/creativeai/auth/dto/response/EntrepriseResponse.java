package com.creativeai.auth.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record EntrepriseResponse(
        String id,
        String nom,
        String raisonSociale,
        String email,
        String telephone,
        String adresse,
        String ville,
        String pays,
        String siteWeb,
        String logoUrl,
        String description,
        boolean active,
        List<SocialMediaEntrepriseResponse> reseauxSociaux,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
