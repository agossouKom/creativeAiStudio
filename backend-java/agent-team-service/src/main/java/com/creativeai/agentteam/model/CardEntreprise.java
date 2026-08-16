package com.creativeai.agentteam.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "card_entreprise", indexes = {
    @Index(name = "idx_card_entreprise_user",   columnList = "user_id"),
    @Index(name = "idx_card_entreprise_raison", columnList = "raison_social, user_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CardEntreprise extends BaseEntity {

    @Column(name = "user_id", nullable = false, length = 128)
    private String userId;

    @Column(name = "code", length = 32)
    private String code;

    /* ── Identité légale ── */
    @Column(name = "raison_social", nullable = false, length = 255)
    private String raisonSocial;

    @Column(name = "sigle_entreprise", length = 64)
    private String sigleEntreprise;

    @Column(name = "forme_juridique", length = 64)
    private String formeJuridique;

    @Column(name = "ifu", length = 64)
    private String ifu;

    @Column(name = "rccm", length = 128)
    private String rccm;

    @Column(name = "capital_social", length = 128)
    private String capitalSocial;

    /* ── Contact ── */
    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "contact", length = 64)
    private String contact;

    @Column(name = "telephone", length = 64)
    private String telephone;

    @Column(name = "fax", length = 64)
    private String fax;

    @Column(name = "site_web", length = 255)
    private String siteWeb;

    /* ── Localisation ── */
    @Column(name = "adresse", columnDefinition = "text")
    private String adresse;

    @Column(name = "boite_postale", length = 64)
    private String boitePostale;

    @Column(name = "ville", length = 128)
    private String ville;

    @Column(name = "pays", length = 128)
    private String pays;

    /* ── Activité ── */
    @Column(name = "secteur_activite", length = 255)
    private String secteurActivite;

    @Column(name = "niche", length = 255)
    private String niche;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    /* ── Responsable ── */
    @Column(name = "responsable", length = 255)
    private String responsable;

    @Column(name = "titre_responsable", length = 128)
    private String titreResponsable;

    /* ── Visuels & documents ── */
    @Column(name = "logo", columnDefinition = "text")
    private String logo;

    @Column(name = "armoirie", columnDefinition = "text")
    private String armoirie;

    @Column(name = "cachet", columnDefinition = "text")
    private String cachet;

    @Column(name = "signature_responsable", columnDefinition = "text")
    private String signatureResponsable;

    @Column(name = "couleur1", length = 16)
    private String couleur1;

    @Column(name = "couleur2", length = 16)
    private String couleur2;
}
