package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Promotional campaign applied to a list of products.
 */
@Entity
@Table(name = "promotions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class Promotion extends BaseEntity {

    @Column(nullable = false, length = 200)
    private String libelle;

    @Column(nullable = false)
    private LocalDateTime dateDebut;

    @Column(nullable = false)
    private LocalDateTime dateFin;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "promotion_produits",
            joinColumns = @JoinColumn(name = "promotion_id"),
            inverseJoinColumns = @JoinColumn(name = "produit_id")
    )
    @Builder.Default
    private List<Produit> produits = new ArrayList<>();

    /** Promotional price applied to all linked products. */
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal prixPromo;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;
}
