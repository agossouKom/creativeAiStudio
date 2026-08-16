package com.creativeai.auth.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ClientPubRequest(
        @Size(max = 100) String nom,
        @Size(max = 100) String prenom,
        @Size(max = 200) String raisonSociale,
        @Size(max = 30) String contact1,
        @Size(max = 30) String contact2,
        @Email @Size(max = 150) String email,
        @Size(max = 150) String responsable,
        @Size(max = 250) String siteWeb,
        Boolean active,
        List<SocialMediaClientRequest> reseauxSociaux
) {}
