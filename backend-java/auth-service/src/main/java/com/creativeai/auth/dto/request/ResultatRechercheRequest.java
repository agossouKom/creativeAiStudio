package com.creativeai.auth.dto.request;

import com.creativeai.auth.model.enums.MediaType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ResultatRechercheRequest(
        @NotNull MediaType mediaType,
        String auteur,
        @NotBlank String titre,
        Integer anneeSortie,
        String genre,
        String imageUrl,
        String texteParoles,
        List<String> plateformesStreaming,
        String lienTelechargement,
        String format,
        String nom,
        String prenom,
        String metier,
        String contact,
        String domicile,
        String reseauxSociaux,
        String pays,
        String ville,
        Boolean active
) {}
