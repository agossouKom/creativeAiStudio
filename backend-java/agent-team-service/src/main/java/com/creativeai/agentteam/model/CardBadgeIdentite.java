package com.creativeai.agentteam.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "card_badge_identite")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CardBadgeIdentite {

    @Id
    @Column(name = "id", length = 36)
    private String id;

    @MapsId
    @OneToOne(cascade = {CascadeType.PERSIST, CascadeType.MERGE, CascadeType.REMOVE}, fetch = FetchType.EAGER)
    @JoinColumn(name = "id")
    private CardBase base;

    @Column(name = "nom",    length = 128) private String nom;
    @Column(name = "prenoms", length = 255) private String prenoms;
    @Column(name = "photo",   columnDefinition = "text") private String photo;
    @Column(name = "civilite", length = 16) private String civilite;
    @Column(name = "genre",   length = 8)  private String genre;
    @Column(name = "date_naissance",  length = 32)  private String dateNaissance;
    @Column(name = "lieu_naissance",  length = 255) private String lieuNaissance;
    @Column(name = "nationalite",     length = 64)  private String nationalite;
    @Column(name = "titre_poste",     length = 255) private String titrePoste;
    @Column(name = "departement",     length = 128) private String departement;
    @Column(name = "service",         length = 128) private String service;
    @Column(name = "matricule",       length = 128) private String matricule;
    @Column(name = "date_embauche",   length = 32)  private String dateEmbauche;
    @Column(name = "date_expiration", length = 32)  private String dateExpiration;
    @Column(name = "access_type",     length = 32)  private String accessType;
    @Column(name = "niveau_acces")                   private Short  niveauAcces;
    @Column(name = "zones_acces", columnDefinition = "text") private String zonesAcces;
    @Column(name = "email",    length = 255) private String email;
    @Column(name = "telephone",length = 64)  private String telephone;
    @Column(name = "adresse",  columnDefinition = "text") private String adresse;
    @Column(name = "site_web", length = 255) private String siteWeb;
    @Column(name = "entreprise",       length = 255) private String entreprise;
    @Column(name = "sigle_entreprise", length = 64)  private String sigleEntreprise;
    @Column(name = "logo",  columnDefinition = "text") private String logo;
    @Column(name = "armoirie",              columnDefinition = "text") private String armoirie;
    @Column(name = "cachet",                columnDefinition = "text") private String cachet;
    @Column(name = "signature_responsable", columnDefinition = "text") private String signatureResponsable;
    @Column(name = "photo_format", length = 8) private String photoFormat;
    @Column(name = "qr_code",     columnDefinition = "text") private String qrCode;
    @Column(name = "qr_data_url", columnDefinition = "text") private String qrDataUrl;
    @Column(name = "code_barre",  columnDefinition = "text") private String codeBarre;
}
