package com.creativeai.auth.dto.response;

import com.creativeai.auth.model.enums.MediaType;

import java.time.LocalDateTime;
import java.util.List;

public record ResultatRechercheResponse(
        String id,
        MediaType mediaType,
        String auteur,
        String titre,
        Integer anneeSortie,
        String genre,
        String imageUrl,
        String texteParoles,
        List<String> plateformesStreaming,
        String lienTelechargement,   // null for FREE subscribers
        String format,
        String nom,
        String prenom,
        String metier,
        String contact,
        String domicile,
        String reseauxSociaux,
        String pays,
        String ville,
        boolean active,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
