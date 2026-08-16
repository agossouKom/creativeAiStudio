package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Product – supports QUICK ADD (can be created inline with a new Categorie/Fonction).
 */
@Entity
@Table(name = "produits", indexes = {
        @Index(name = "idx_produit_categorie", columnList = "categorie_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class Produit extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "categorie_id")
    private Categorie categorie;

    @Column(nullable = false, length = 200)
    private String libelle;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal prix;

    /**
     * Relationship with functions via a join entity to include the 'disponible' attribute.
     */
    @OneToMany(mappedBy = "produit", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ProduitFonction> produitFonctions = new ArrayList<>();

    @Column(name = "url_image", length = 1000)
    private String urlImage;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;
}
