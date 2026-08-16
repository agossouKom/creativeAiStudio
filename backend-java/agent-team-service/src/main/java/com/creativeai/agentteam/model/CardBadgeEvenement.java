package com.creativeai.agentteam.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "card_badge_evenement")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CardBadgeEvenement {

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
    @Column(name = "titre_participant",         length = 255) private String titreParticipant;
    @Column(name = "organisation_participant",  length = 255) private String organisationParticipant;
    @Column(name = "pays_origine",              length = 64)  private String paysOrigine;
    @Column(name = "titre_evenement",           length = 255) private String titreEvenement;
    @Column(name = "sous_titre_evenement",      length = 255) private String sousTitreEvenement;
    @Column(name = "owner_evenement",           length = 255) private String ownerEvenement;
    @Column(name = "contact_organisateur",      length = 128) private String contactOrganisateur;
    @Column(name = "date_debut",   length = 32) private String dateDebut;
    @Column(name = "date_fin",     length = 32) private String dateFin;
    @Column(name = "heure_debut",  length = 16) private String heureDebut;
    @Column(name = "heure_fin",    length = 16) private String heureFin;
    @Column(name = "lieu_evenement", length = 255) private String lieuEvenement;
    @Column(name = "salle",          length = 128) private String salle;
    @Column(name = "stand",          length = 64)  private String stand;
    @Column(name = "table_numero",   length = 32)  private String tableNumero;
    @Column(name = "ville_evenement",length = 128)  private String villeEvenement;
    @Column(name = "pays_evenement", length = 64)   private String paysEvenement;
    @Column(name = "type_acces",     length = 32)   private String typeAcces;
    @Column(name = "numero_badge",   length = 64)   private String numeroBadge;
    @Column(name = "sessions_autorisees", columnDefinition = "text") private String sessionsAutorisees;
    @Column(name = "validite_journee")               private Boolean validiteJournee;
    @Column(name = "logo_evenement", columnDefinition = "text") private String logoEvenement;
    @Column(name = "image_fond",     columnDefinition = "text") private String imageFond;
    @Column(name = "couleur_theme",  length = 16)   private String couleurTheme;
    @Column(name = "qr_code",     columnDefinition = "text") private String qrCode;
    @Column(name = "qr_data_url", columnDefinition = "text") private String qrDataUrl;
    @Column(name = "code_barre",  columnDefinition = "text") private String codeBarre;
}
