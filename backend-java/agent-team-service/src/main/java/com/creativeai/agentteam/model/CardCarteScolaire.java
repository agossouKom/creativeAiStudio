package com.creativeai.agentteam.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "card_carte_scolaire")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CardCarteScolaire {

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
    @Column(name = "genre",   length = 8)  private String genre;
    @Column(name = "date_naissance",  length = 32)  private String dateNaissance;
    @Column(name = "lieu_naissance",  length = 255) private String lieuNaissance;
    @Column(name = "nationalite",     length = 64)  private String nationalite;
    @Column(name = "numero_matricule",  length = 128) private String numeroMatricule;
    @Column(name = "numero_inscription",length = 128) private String numeroInscription;
    @Column(name = "classe",     length = 128) private String classe;
    @Column(name = "niveau",     length = 32)  private String niveau;
    @Column(name = "filiere",    length = 128) private String filiere;
    @Column(name = "serie",      length = 32)  private String serie;
    @Column(name = "annee_scolaire",  length = 32) private String anneeScolaire;
    @Column(name = "date_inscription",length = 32) private String dateInscription;
    @Column(name = "date_expiration", length = 32) private String dateExpiration;
    @Column(name = "type_apprenant",  length = 32) private String typeApprenant;
    @Column(name = "boursier")                      private Boolean boursier;
    @Column(name = "type_bourse",     length = 128) private String typeBourse;
    @Column(name = "contact",         length = 64)  private String contact;
    @Column(name = "email",           length = 255) private String email;
    @Column(name = "adresse",         columnDefinition = "text") private String adresse;
    @Column(name = "nom_tuteur",      length = 255) private String nomTuteur;
    @Column(name = "contact_tuteur",  length = 64)  private String contactTuteur;
    @Column(name = "relation_tuteur", length = 32)  private String relationTuteur;
    @Column(name = "etablissement",   length = 255) private String etablissement;
    @Column(name = "sigle_ets",       length = 64)  private String sigleEts;
    @Column(name = "type_etablissement", length = 32) private String typeEtablissement;
    @Column(name = "adresse_ets",     columnDefinition = "text") private String adresseEts;
    @Column(name = "ville_ets",       length = 128) private String villeEts;
    @Column(name = "pays_ets",        length = 64)  private String paysEts;
    @Column(name = "logo_ets",        columnDefinition = "text") private String logoEts;
    @Column(name = "armoirie",        columnDefinition = "text") private String armoirie;
    @Column(name = "cachet",          columnDefinition = "text") private String cachet;
    @Column(name = "signature_directeur", columnDefinition = "text") private String signatureDirecteur;
    @Column(name = "nom_directeur",   length = 255) private String nomDirecteur;
    @Column(name = "couleur_bandeau1",length = 16)  private String couleurBandeau1;
    @Column(name = "couleur_bandeau2",length = 16)  private String couleurBandeau2;
    @Column(name = "titre_carte",     length = 64)  private String titreCarte;
    @Column(name = "groupe_sanguin",  length = 8)   private String groupeSanguin;
    @Column(name = "allergies",       columnDefinition = "text") private String allergies;
    @Column(name = "qr_code",     columnDefinition = "text") private String qrCode;
    @Column(name = "qr_data_url", columnDefinition = "text") private String qrDataUrl;
    @Column(name = "code_barre",  columnDefinition = "text") private String codeBarre;
}
