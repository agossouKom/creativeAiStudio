package com.creativeai.search.dto.produit;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for product category requests
 * DTO pour les requêtes de catégories de produits
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CategoryRequest {

    @NotBlank(message = "Category name is required / Le nom de la catégorie est requis")
    @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters / Le nom doit contenir entre 2 et 100 caractères")
    private String name;

    @NotBlank(message = "Category code is required / Le code de la catégorie est requis")
    @Size(min = 2, max = 20, message = "Code must be between 2 and 20 characters / Le code doit contenir entre 2 et 20 caractères")
    private String code;

    private String description;

    private String parentCategoryId;

    private String icon;

    private Integer displayOrder;

    private Boolean isActive;
}
