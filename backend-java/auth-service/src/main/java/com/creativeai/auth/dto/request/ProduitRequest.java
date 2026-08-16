package com.creativeai.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

/**
 * Supports QUICK ADD: if categorieId is null and categorieLibelle is provided,
 * a new Categorie is created on the fly.
 * Same for fonctionIds / fonctionLibelles.
 */
public record ProduitRequest(
        // QUICK ADD: provide either id (existing) or libelle (new)
        String categorieId,
        String categorieLibelle,          // quick-add new categorie

        @NotBlank @Size(max = 200) String libelle,

        @NotNull @Positive BigDecimal prix,

        List<String> fonctionIds,         // existing fonctions (included)
        List<String> disponibleFonctionIds, // fonctions that are actually available/active
        List<String> fonctionLibelles,    // quick-add new fonctions

        String urlImage,
        Boolean active
) {}
