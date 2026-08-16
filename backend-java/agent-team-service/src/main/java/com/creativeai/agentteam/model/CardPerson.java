package com.creativeai.agentteam.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "card_builder", indexes = {
    @Index(name = "idx_cb_user",       columnList = "user_id"),
    @Index(name = "idx_cb_category",   columnList = "category, user_id"),
    @Index(name = "idx_cb_entreprise", columnList = "entreprise, user_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CardPerson extends BaseEntity {

    /* ── Identifiants ── */
    @Column(name = "user_id",       nullable = false, length = 128)
    private String userId;

    @Column(name = "card_design_id", length = 36)
    private String cardDesignId;

    @Column(name = "entreprise_id", length = 36)
    private String entrepriseId;

    @Column(name = "category", nullable = false, length = 32)
    private String category;

    @Column(name = "code", length = 32)
    private String code;

    /* ── Identité commune ── */
    @Column(name = "nom",    length = 128)
    private String nom;

    @Column(name = "prenoms", length = 255)
    private String prenoms;

    @Column(name = "photo", columnDefinition = "text")
    private String photo;

    @Column(name = "titre", length = 255)
    private String titre;

    @Column(name = "profession", length = 255)
    private String profession;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "contact", length = 64)
    private String contact;

    @Column(name = "adresse", columnDefinition = "text")
    private String adresse;

    @Column(name = "site_web", length = 255)
    private String siteWeb;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Column(name = "matricule", length = 128)
    private String matricule;

    @Column(name = "signature", columnDefinition = "text")
    private String signature;

    @Column(name = "qr_code", columnDefinition = "text")
    private String qrCode;

    @Column(name = "couleur1", length = 16)
    @Builder.Default
    private String couleur1 = "#1565c0";

    @Column(name = "couleur2", length = 16)
    @Builder.Default
    private String couleur2 = "#ffd600";

    /* ── Entreprise / Organisation ── */
    @Column(name = "entreprise",       length = 255)
    private String entreprise;

    @Column(name = "sigle_entreprise", length = 64)
    private String sigleEntreprise;

    @Column(name = "logo", columnDefinition = "text")
    private String logo;

    @Column(name = "access_type", length = 32)
    private String accessType;

    /* ── Scolaire ── */
    @Column(name = "date_naissance", length = 32)
    private String dateNaissance;

    @Column(name = "lieu_naissance", length = 255)
    private String lieuNaissance;

    @Column(name = "etablissement_scolaire", length = 255)
    private String etablissementScolaire;

    @Column(name = "sigle_ets", length = 64)
    private String sigleEts;

    @Column(name = "armoirie", columnDefinition = "text")
    private String armoirie;

    @Column(name = "classe", length = 128)
    private String classe;

    @Column(name = "annee_scolaire", length = 32)
    private String anneeScolaire;

    @Column(name = "cachet", columnDefinition = "text")
    private String cachet;

    @Column(name = "signature_responsable", columnDefinition = "text")
    private String signatureResponsable;

    /* ── Événement ── */
    @Column(name = "titre_evenement", length = 255)
    private String titreEvenement;

    @Column(name = "owner_evenement", length = 255)
    private String ownerEvenement;

    @Column(name = "sous_titre_evenement", length = 255)
    private String sousTitreEvenement;

    @Column(name = "date_evenement", length = 64)
    private String dateEvenement;

    @Column(name = "salle_evenement", length = 255)
    private String salleEvenement;

    @Column(name = "stand_evenement", length = 128)
    private String standEvenement;
}
