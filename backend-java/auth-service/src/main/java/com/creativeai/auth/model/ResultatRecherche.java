package com.creativeai.auth.model;

import com.creativeai.auth.model.enums.MediaType;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.ArrayList;
import java.util.List;

/**
 * A media search result (song, video, image, artist profile…).
 * lienTelechargement is restricted to PREMIUM/PRO/BUSINESS subscribers.
 */
@Entity
@Table(name = "resultats_recherche")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class ResultatRecherche extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MediaType mediaType;

    // ─── Media / Work info ────────────────────────────────────────────────────

    @Column(length = 200)
    private String auteur;

    @Column(length = 200)
    private String titre;

    private Integer anneeSortie;

    @Column(length = 100)
    private String genre;

    @Column(name = "image_url", length = 1000)
    private String imageUrl;

    @Column(name = "texte_paroles", length = 5000)
    private String texteParoles;

    @ElementCollection
    @CollectionTable(name = "resultat_plateformes", joinColumns = @JoinColumn(name = "resultat_id"))
    @Column(name = "plateforme_url", length = 500)
    @Builder.Default
    private List<String> plateformesStreaming = new ArrayList<>();

    /** Download link – visible only to PREMIUM, PRO, BUSINESS subscribers */
    @Column(name = "lien_telechargement", length = 1000)
    private String lienTelechargement;

    @Column(length = 50)
    private String format; // e.g. "MP3", "MP4", "FLAC"

    // ─── Artist / Author profile ──────────────────────────────────────────────

    @Column(length = 100)
    private String nom;

    @Column(length = 100)
    private String prenom;

    @Column(length = 100)
    private String metier;

    @Column(length = 100)
    private String contact;

    @Column(length = 250)
    private String domicile;

    @Column(length = 500)
    private String reseauxSociaux;

    @Column(length = 100)
    private String pays;

    @Column(length = 100)
    private String ville;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;
}
