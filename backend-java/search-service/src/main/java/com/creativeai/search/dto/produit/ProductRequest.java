package com.creativeai.search.dto.produit;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * DTO for creating/updating products
 * DTO pour créer/modifier des produits
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductRequest {

    @NotBlank(message = "Product name is required / Le nom du produit est requis")
    @Size(min = 2, max = 200, message = "Name must be between 2 and 200 characters / Le nom doit contenir entre 2 et 200 caractères")
    private String name;

    private String description;

    @NotBlank(message = "SKU is required / Le SKU est requis")
    @Size(max = 50, message = "SKU must not exceed 50 characters / Le SKU ne doit pas dépasser 50 caractères")
    private String sku;

    private String barcode;

    @NotNull(message = "Category is required / La catégorie est requise")
    private String categoryId;

    @NotNull(message = "Price is required / Le prix est requis")
    @DecimalMin(value = "0.0", inclusive = false, message = "Price must be greater than 0 / Le prix doit être supérieur à 0")
    private BigDecimal price;

    @DecimalMin(value = "0.0", message = "Cost must be 0 or greater / Le coût doit être 0 ou plus")
    private BigDecimal cost;

    @NotNull(message = "Tax rate is required / Le taux de taxe est requis")
    @DecimalMin(value = "0.0", message = "Tax rate must be 0 or greater / Le taux de taxe doit être 0 ou plus")
    @DecimalMax(value = "100.0", message = "Tax rate must not exceed 100% / Le taux de taxe ne doit pas dépasser 100%")
    private BigDecimal taxRate;

    private String taxGroup;

    @NotBlank(message = "Unit is required / L'unité est requise")
    private String unit; // e.g., "piece", "kg", "liter"

    private Integer minStockLevel;

    private Integer maxStockLevel;

    private Boolean trackStock;

    private Boolean isActive;

    private String imageUrl;

    private List<String> tags;

    private String notes;
}
