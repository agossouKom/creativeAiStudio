package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;

/**
 * A single line item within a Vente (sales order).
 */
@Entity
@Table(name = "ligne_ventes", indexes = {
        @Index(name = "idx_ligne_vente", columnList = "vente_id"),
        @Index(name = "idx_ligne_produit", columnList = "produit_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class LigneVente extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vente_id", nullable = false)
    private Vente vente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "produit_id", nullable = false)
    private Produit produit;

    @Column(nullable = false)
    @Builder.Default
    private Integer quantite = 1;

    /** Unit price at time of purchase (snapshot, may differ from current price) */
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal prixUnitaire;

    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal sousTotal = BigDecimal.ZERO;
}
