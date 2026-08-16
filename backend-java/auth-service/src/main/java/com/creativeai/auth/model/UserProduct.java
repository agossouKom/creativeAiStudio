package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import java.math.BigDecimal;

@Entity
@Table(name = "user_products",
       indexes = @Index(name = "idx_up_user", columnList = "user_id"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class UserProduct extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(length = 50,  nullable = false) private String code;
    @Column(length = 200, nullable = false) private String nom;
    @Column(columnDefinition = "TEXT")      private String description;

    @Column(precision = 15, scale = 2)      private BigDecimal prix;
    @Column(name = "prix_promo", precision = 15, scale = 2) private BigDecimal prixPromo;

    // JSON arrays stored as TEXT (variantes, mentions, photos URLs, videos URLs)
    @Column(columnDefinition = "TEXT") private String variantes;
    @Column(columnDefinition = "TEXT") private String mentions;
    @Column(columnDefinition = "TEXT") private String photos;
    @Column(columnDefinition = "TEXT") private String videos;
}
