package com.creativeai.agentteam.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "card_carte_visite")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CardCarteVisite {

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
    @Column(name = "titre_poste",   length = 255) private String titrePoste;
    @Column(name = "specialite",    length = 255) private String specialite;
    @Column(name = "certifications",columnDefinition = "text") private String certifications;
    @Column(name = "slogan",        length = 255) private String slogan;
    @Column(name = "email",           length = 255) private String email;
    @Column(name = "email_secondaire",length = 255) private String emailSecondaire;
    @Column(name = "telephone",length = 64) private String telephone;
    @Column(name = "mobile",   length = 64) private String mobile;
    @Column(name = "fax",      length = 64) private String fax;
    @Column(name = "whatsapp", length = 64) private String whatsapp;
    @Column(name = "skype",    length = 64) private String skype;
    @Column(name = "site_web", length = 255) private String siteWeb;
    @Column(name = "linkedin", length = 255) private String linkedin;
    @Column(name = "twitter",  length = 128) private String twitter;
    @Column(name = "instagram",length = 128) private String instagram;
    @Column(name = "facebook", length = 128) private String facebook;
    @Column(name = "adresse_ligne1",length = 255) private String adresseLigne1;
    @Column(name = "adresse_ligne2",length = 255) private String adresseLigne2;
    @Column(name = "ville",      length = 128) private String ville;
    @Column(name = "code_postal",length = 16)  private String codePostal;
    @Column(name = "pays",       length = 64)  private String pays;
    @Column(name = "entreprise",       length = 255) private String entreprise;
    @Column(name = "sigle_entreprise", length = 64)  private String sigleEntreprise;
    @Column(name = "logo", columnDefinition = "text") private String logo;
    @Column(name = "matricule",  length = 128) private String matricule;
    @Column(name = "qr_code",     columnDefinition = "text") private String qrCode;
    @Column(name = "qr_data_url", columnDefinition = "text") private String qrDataUrl;
    @Column(name = "qr_type",    length = 16) private String qrType;
}
