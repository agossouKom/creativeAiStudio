package com.creativeai.search.dto.produit;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO for product responses
 * DTO pour les réponses de produits
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductResponse {

    private String id;
    private String name;
    private String description;
    private String sku;
    private String barcode;

    private CategoryInfo category;

    private BigDecimal price;
    private BigDecimal cost;
    private BigDecimal taxRate;
    private String taxGroup;
    private String unit;

    private Integer minStockLevel;
    private Integer maxStockLevel;
    private Boolean trackStock;

    private String status;
    private Boolean isActive;

    private String imageUrl;
    private List<String> tags;
    private String notes;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;
    private String updatedBy;

    // Stock information (if available)
    private Integer totalStock;
    private List<StockInfo> stockBySite;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CategoryInfo {
        private String id;
        private String name;
        private String code;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StockInfo {
        private String siteId;
        private String siteName;
        private Integer quantity;
        private Integer reserved;
        private Integer available;
    }
}
