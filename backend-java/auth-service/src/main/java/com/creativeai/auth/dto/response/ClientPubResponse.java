package com.creativeai.auth.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record ClientPubResponse(
        String id,
        String nom,
        String prenom,
        String raisonSociale,
        String contact1,
        String contact2,
        String email,
        String responsable,
        String siteWeb,
        boolean active,
        boolean deleted,
        List<SocialMediaClientResponse> reseauxSociaux,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
