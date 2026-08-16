package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Entity tracking history of promotion applications to specific products.
 */
@Entity
@Table(name = "promotion_history", indexes = {
        @Index(name = "idx_promo_hist_promo", columnList = "promotion_id"),
        @Index(name = "idx_promo_hist_product", columnList = "product_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PromotionHistory extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "promotion_id", nullable = false)
    private Promotion promotion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Produit product;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal priceBefore;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal priceAfter;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal savings;

    @Column(nullable = false)
    private LocalDateTime appliedAt;

    @Override
    @PrePersist
    protected void onCreate() {
        super.onCreate();
        if (appliedAt == null) {
            appliedAt = LocalDateTime.now();
        }
    }
}
