package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "produit_fonctions_mapping")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProduitFonction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "produit_id", nullable = false)
    private Produit produit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fonction_id", nullable = false)
    private Fonction fonction;

    @Column(nullable = false)
    @Builder.Default
    private boolean disponible = true;
}
