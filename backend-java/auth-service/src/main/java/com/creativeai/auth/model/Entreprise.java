package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.ArrayList;
import java.util.List;

/**
 * Represents the company that owns the Creative AI Studio platform.
 * Singleton in practice – one Entreprise record.
 */
@Entity
@Table(name = "entreprises")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class Entreprise extends BaseEntity {

    @Column(nullable = false, length = 150)
    private String nom;

    @Column(length = 150)
    private String raisonSociale;

    @Column(unique = true, length = 150)
    private String email;

    @Column(length = 30)
    private String telephone;

    @Column(length = 250)
    private String adresse;

    @Column(length = 100)
    private String ville;

    @Column(length = 100)
    private String pays;

    @Column(length = 250)
    private String siteWeb;

    @Column(length = 1000)
    private String logoUrl;

    @Column(length = 1000)
    private String description;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

    @OneToMany(mappedBy = "entreprise", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<SocialMediaEntreprise> reseauxSociaux = new ArrayList<>();
}
