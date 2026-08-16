package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

/**
 * A functional feature / characteristic that can be assigned to a Produit.
 * e.g. "Livraison rapide", "Garantie 2 ans"
 */
@Entity
@Table(name = "fonctions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class Fonction extends BaseEntity {

    @Column(nullable = false, length = 200)
    private String libelle;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;
}
