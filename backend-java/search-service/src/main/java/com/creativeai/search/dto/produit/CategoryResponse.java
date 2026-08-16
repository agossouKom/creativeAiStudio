package com.creativeai.search.dto.produit;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO for category responses
 * DTO pour les réponses de catégories
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CategoryResponse {

    private String id;
    private String name;
    private String code;
    private String description;
    private String icon;
    private Integer displayOrder;
    private Boolean isActive;

    private ParentCategoryInfo parentCategory;
    private List<CategoryResponse> subCategories;

    private Integer productCount;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ParentCategoryInfo {
        private String id;
        private String name;
        private String code;
    }
}
