package com.creativeai.agentteam.model;

import lombok.*;

import java.time.LocalDateTime;

/**
 * DTO plat retourné par /api/card-data — union de tous les champs par catégorie.
 * Les champs non applicables à la catégorie sont null.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CardDto {

    /* ── Commun (CardBase) ──────────────────────────────────────────── */
    private String id;
    private String userId;
    private String code;
    private String category;
    private String cardDesignId;
    private String entrepriseId;
    private String couleur1;
    private String couleur2;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /* ── Identité personne (toutes catégories) ──────────────────────── */
    private String nom;
    private String prenoms;
    private String photo;
    private String civilite;       // M. Mme. Dr. Prof.
    private String genre;          // M F Autre
    private String dateNaissance;
    private String lieuNaissance;
    private String nationalite;

    /* ── Contact commun ─────────────────────────────────────────────── */
    private String email;
    private String contact;        // téléphone principal (compat frontend)
    private String mobile;
    private String fax;
    private String siteWeb;
    private String adresse;
    private String qrCode;
    private String qrDataUrl;
    private String codeBarre;

    /* ── Organisation ────────────────────────────────────────────────── */
    private String entreprise;
    private String sigleEntreprise;
    private String logo;

    /* ─────────────────────────────────────────────────────────────────
       BADGE IDENTITÉ
    ───────────────────────────────────────────────────────────────── */
    private String titre;          // titre du poste (compat frontend)
    private String profession;
    private String departement;
    private String service;
    private String matricule;
    private String dateEmbauche;
    private String dateExpiration;
    private String accessType;     // EMPLOYE DIRECTEUR VIP VISITEUR SECURITE…
    private Short  niveauAcces;    // 1-5
    private String zonesAcces;     // JSON list de zones
    private String armoirie;
    private String cachet;
    private String signatureResponsable;
    private String photoFormat;    // ROND CARRE

    /* ─────────────────────────────────────────────────────────────────
       CARTE DE VISITE
    ───────────────────────────────────────────────────────────────── */
    private String specialite;
    private String certifications;
    private String slogan;
    private String emailSecondaire;
    private String whatsapp;
    private String skype;
    private String linkedin;
    private String twitter;
    private String instagram;
    private String facebook;
    private String adresseLigne1;
    private String adresseLigne2;
    private String ville;
    private String codePostal;
    private String pays;
    private String qrType;         // VCARD URL TEXTE

    /* ─────────────────────────────────────────────────────────────────
       BADGE ÉVÉNEMENT
    ───────────────────────────────────────────────────────────────── */
    private String titreParticipant;
    private String organisationParticipant;
    private String paysOrigine;
    private String titreEvenement;
    private String sousTitreEvenement;
    private String ownerEvenement;
    private String contactOrganisateur;
    private String dateDebut;
    private String dateFin;
    private String heureDebut;
    private String heureFin;
    private String lieuEvenement;
    private String salleEvenement;   // compat frontend
    private String standEvenement;   // compat frontend
    private String tableNumero;
    private String villeEvenement;
    private String paysEvenement;
    private String typeAcces;        // VIP INVITE VISITEUR SPEAKER STAFF EXPOSANT PRESSE
    private String numeroBadge;
    private String sessionsAutorisees;
    private Boolean validiteJournee;
    private String logoEvenement;
    private String imageFond;
    private String couleurTheme;

    /* ─────────────────────────────────────────────────────────────────
       CARTE SCOLAIRE
    ───────────────────────────────────────────────────────────────── */
    private String numeroMatricule;
    private String numeroInscription;
    private String classe;
    private String niveau;           // CP CE1 6e 3e Terminale L1 M2…
    private String filiere;
    private String serie;            // A C D ABT STMG…
    private String anneeScolaire;
    private String dateInscription;
    private String typeApprenant;    // ELEVE ETUDIANT APPRENANT APPRENTI STAGIAIRE
    private Boolean boursier;
    private String typeBourse;
    private String nomTuteur;
    private String contactTuteur;
    private String relationTuteur;   // PERE MERE TUTEUR
    private String etablissementScolaire;  // compat frontend
    private String sigleEts;
    private String typeEtablissement;      // PRIMAIRE SECONDAIRE LYCEE UNIVERSITE FORMATION_PRO
    private String adresseEts;
    private String villeEts;
    private String paysEts;
    private String logoEts;
    private String couleurBandeau1;
    private String couleurBandeau2;
    private String titreCarte;       // "IDENTITY CARD" "CARTE D'IDENTITÉ SCOLAIRE"
    private String groupeSanguin;
    private String allergies;
    private String nomDirecteur;
    private String signatureDirecteur;
    private String description;
}
