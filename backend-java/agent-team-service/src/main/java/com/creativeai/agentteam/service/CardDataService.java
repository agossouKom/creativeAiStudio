package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.*;
import com.creativeai.agentteam.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CardDataService {

    private final CardBaseRepository          baseRepo;
    private final CardBadgeIdentiteRepository  biRepo;
    private final CardCarteVisiteRepository    cvRepo;
    private final CardBadgeEvenementRepository beRepo;
    private final CardCarteScolaireRepository  csRepo;

    /* ── LIST ────────────────────────────────────────────────────────── */

    public List<CardDto> list(String userId, String category) {
        if (category == null || category.isBlank()) {
            return baseRepo.findByUserIdAndDeletedFalseOrderByCreatedAtDesc(userId)
                    .stream().map(base -> loadDto(base.getId(), userId)).toList();
        }
        return switch (category.toUpperCase()) {
            case "BADGE_IDENTITE"  -> biRepo.findByBaseUserIdAndBaseDeletedFalseOrderByBaseCreatedAtDesc(userId).stream().map(e -> toDto(e.getBase(), e)).toList();
            case "CARTE_VISITE"    -> cvRepo.findByBaseUserIdAndBaseDeletedFalseOrderByBaseCreatedAtDesc(userId).stream().map(e -> toDto(e.getBase(), e)).toList();
            case "BADGE_EVENEMENT" -> beRepo.findByBaseUserIdAndBaseDeletedFalseOrderByBaseCreatedAtDesc(userId).stream().map(e -> toDto(e.getBase(), e)).toList();
            case "CARTE_SCOLAIRE"  -> csRepo.findByBaseUserIdAndBaseDeletedFalseOrderByBaseCreatedAtDesc(userId).stream().map(e -> toDto(e.getBase(), e)).toList();
            default                -> List.of();
        };
    }

    /* ── SAVE (create) ───────────────────────────────────────────────── */

    @Transactional
    public CardDto save(String userId, CardDto dto) {
        CardBase base = buildBase(userId, dto);
        return switch (base.getCategory()) {
            case "BADGE_IDENTITE"  -> { CardBadgeIdentite  e = biRepo.save(buildBi(dto, base));  yield toDto(e.getBase(), e); }
            case "CARTE_VISITE"    -> { CardCarteVisite    e = cvRepo.save(buildCv(dto, base));  yield toDto(e.getBase(), e); }
            case "BADGE_EVENEMENT" -> { CardBadgeEvenement e = beRepo.save(buildBe(dto, base));  yield toDto(e.getBase(), e); }
            case "CARTE_SCOLAIRE"  -> { CardCarteScolaire  e = csRepo.save(buildCs(dto, base));  yield toDto(e.getBase(), e); }
            default -> throw new IllegalArgumentException("Catégorie inconnue: " + base.getCategory());
        };
    }

    /* ── BULK SAVE ───────────────────────────────────────────────────── */

    @Transactional
    public List<CardDto> saveBulk(String userId, List<CardDto> dtos) {
        return dtos.stream().map(dto -> save(userId, dto)).toList();
    }

    /* ── UPDATE ──────────────────────────────────────────────────────── */

    @Transactional
    public CardDto update(String id, String userId, CardDto dto) {
        CardBase base = baseRepo.findByIdAndUserIdAndDeletedFalse(id, userId)
                .orElseThrow(() -> new RuntimeException("Card not found: " + id));
        base.setCouleur1(dto.getCouleur1() != null ? dto.getCouleur1() : base.getCouleur1());
        base.setCouleur2(dto.getCouleur2() != null ? dto.getCouleur2() : base.getCouleur2());
        base.setCardDesignId(dto.getCardDesignId());
        base.setEntrepriseId(dto.getEntrepriseId());

        return switch (base.getCategory()) {
            case "BADGE_IDENTITE" -> {
                CardBadgeIdentite e = biRepo.findByIdAndBaseUserIdAndBaseDeletedFalse(id, userId)
                        .orElseThrow();
                applyBi(dto, e);
                e.setBase(base);
                yield toDto(biRepo.save(e).getBase(), biRepo.save(e));
            }
            case "CARTE_VISITE" -> {
                CardCarteVisite e = cvRepo.findByIdAndBaseUserIdAndBaseDeletedFalse(id, userId)
                        .orElseThrow();
                applyCv(dto, e);
                e.setBase(base);
                yield toDto(cvRepo.save(e).getBase(), cvRepo.save(e));
            }
            case "BADGE_EVENEMENT" -> {
                CardBadgeEvenement e = beRepo.findByIdAndBaseUserIdAndBaseDeletedFalse(id, userId)
                        .orElseThrow();
                applyBe(dto, e);
                e.setBase(base);
                yield toDto(beRepo.save(e).getBase(), beRepo.save(e));
            }
            case "CARTE_SCOLAIRE" -> {
                CardCarteScolaire e = csRepo.findByIdAndBaseUserIdAndBaseDeletedFalse(id, userId)
                        .orElseThrow();
                applyCs(dto, e);
                e.setBase(base);
                yield toDto(csRepo.save(e).getBase(), csRepo.save(e));
            }
            default -> throw new IllegalArgumentException("Catégorie inconnue: " + base.getCategory());
        };
    }

    /* ── DELETE (soft) ───────────────────────────────────────────────── */

    @Transactional
    public void delete(String id, String userId) {
        baseRepo.findByIdAndUserIdAndDeletedFalse(id, userId).ifPresent(base -> {
            base.setDeleted(true);
            baseRepo.save(base);
        });
    }

    /* ── INTERNAL HELPERS ─────────────────────────────────────────────── */

    private CardDto loadDto(String id, String userId) {
        CardBase base = baseRepo.findByIdAndUserIdAndDeletedFalse(id, userId).orElseThrow();
        return switch (base.getCategory()) {
            case "BADGE_IDENTITE"  -> biRepo.findById(id).map(e -> toDto(base, e)).orElse(baseOnlyDto(base));
            case "CARTE_VISITE"    -> cvRepo.findById(id).map(e -> toDto(base, e)).orElse(baseOnlyDto(base));
            case "BADGE_EVENEMENT" -> beRepo.findById(id).map(e -> toDto(base, e)).orElse(baseOnlyDto(base));
            case "CARTE_SCOLAIRE"  -> csRepo.findById(id).map(e -> toDto(base, e)).orElse(baseOnlyDto(base));
            default                -> baseOnlyDto(base);
        };
    }

    private CardBase buildBase(String userId, CardDto dto) {
        String cat = dto.getCategory() != null ? dto.getCategory().toUpperCase() : "";
        CardBase base = CardBase.builder()
                .userId(userId)
                .category(cat)
                .code(generateCode(cat))
                .cardDesignId(dto.getCardDesignId())
                .entrepriseId(dto.getEntrepriseId())
                .couleur1(dto.getCouleur1() != null ? dto.getCouleur1() : "#1565c0")
                .couleur2(dto.getCouleur2() != null ? dto.getCouleur2() : "#ffd600")
                .build();
        return base;
    }

    private String generateCode(String category) {
        String prefix = switch (category) {
            case "BADGE_IDENTITE"  -> "BI";
            case "BADGE_EVENEMENT" -> "BE";
            case "CARTE_VISITE"    -> "CV";
            case "CARTE_SCOLAIRE"  -> "CS";
            default                -> "CB";
        };
        return "CB-" + prefix + "-" + LocalDate.now().getYear() + "-"
                + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    /* ── Builders ─────────────────────────────────────────────────────── */

    private CardBadgeIdentite buildBi(CardDto d, CardBase base) {
        CardBadgeIdentite e = new CardBadgeIdentite();
        e.setBase(base);
        applyBi(d, e);
        return e;
    }

    private void applyBi(CardDto d, CardBadgeIdentite e) {
        e.setNom(d.getNom());                            e.setPrenoms(d.getPrenoms());
        e.setPhoto(d.getPhoto());                        e.setCivilite(d.getCivilite());
        e.setGenre(d.getGenre());                        e.setDateNaissance(d.getDateNaissance());
        e.setLieuNaissance(d.getLieuNaissance());        e.setNationalite(d.getNationalite());
        e.setTitrePoste(d.getTitre());                   e.setDepartement(d.getDepartement());
        e.setService(d.getService());                    e.setMatricule(d.getMatricule());
        e.setDateEmbauche(d.getDateEmbauche());          e.setDateExpiration(d.getDateExpiration());
        e.setAccessType(d.getAccessType());              e.setNiveauAcces(d.getNiveauAcces());
        e.setZonesAcces(d.getZonesAcces());              e.setEmail(d.getEmail());
        e.setTelephone(d.getContact());                  e.setAdresse(d.getAdresse());
        e.setSiteWeb(d.getSiteWeb());                    e.setEntreprise(d.getEntreprise());
        e.setSigleEntreprise(d.getSigleEntreprise());    e.setLogo(d.getLogo());
        e.setArmoirie(d.getArmoirie());                  e.setCachet(d.getCachet());
        e.setSignatureResponsable(d.getSignatureResponsable());
        e.setPhotoFormat(d.getPhotoFormat());
        e.setQrCode(d.getQrCode());                      e.setQrDataUrl(d.getQrDataUrl());
        e.setCodeBarre(d.getCodeBarre());
    }

    private CardCarteVisite buildCv(CardDto d, CardBase base) {
        CardCarteVisite e = new CardCarteVisite();
        e.setBase(base);
        applyCv(d, e);
        return e;
    }

    private void applyCv(CardDto d, CardCarteVisite e) {
        e.setNom(d.getNom());                            e.setPrenoms(d.getPrenoms());
        e.setPhoto(d.getPhoto());                        e.setCivilite(d.getCivilite());
        e.setTitrePoste(d.getTitre());                   e.setSpecialite(d.getSpecialite());
        e.setCertifications(d.getCertifications());      e.setSlogan(d.getSlogan());
        e.setEmail(d.getEmail());                        e.setEmailSecondaire(d.getEmailSecondaire());
        e.setTelephone(d.getContact());                  e.setMobile(d.getMobile());
        e.setFax(d.getFax());                            e.setWhatsapp(d.getWhatsapp());
        e.setSkype(d.getSkype());                        e.setSiteWeb(d.getSiteWeb());
        e.setLinkedin(d.getLinkedin());                  e.setTwitter(d.getTwitter());
        e.setInstagram(d.getInstagram());                e.setFacebook(d.getFacebook());
        e.setAdresseLigne1(d.getAdresseLigne1() != null ? d.getAdresseLigne1() : d.getAdresse());
        e.setAdresseLigne2(d.getAdresseLigne2());        e.setVille(d.getVille());
        e.setCodePostal(d.getCodePostal());              e.setPays(d.getPays());
        e.setEntreprise(d.getEntreprise());              e.setSigleEntreprise(d.getSigleEntreprise());
        e.setLogo(d.getLogo());                          e.setMatricule(d.getMatricule());
        e.setQrCode(d.getQrCode());                      e.setQrDataUrl(d.getQrDataUrl());
        e.setQrType(d.getQrType());
    }

    private CardBadgeEvenement buildBe(CardDto d, CardBase base) {
        CardBadgeEvenement e = new CardBadgeEvenement();
        e.setBase(base);
        applyBe(d, e);
        return e;
    }

    private void applyBe(CardDto d, CardBadgeEvenement e) {
        e.setNom(d.getNom());                            e.setPrenoms(d.getPrenoms());
        e.setPhoto(d.getPhoto());                        e.setTitreParticipant(d.getTitreParticipant() != null ? d.getTitreParticipant() : d.getTitre());
        e.setOrganisationParticipant(d.getOrganisationParticipant() != null ? d.getOrganisationParticipant() : d.getEntreprise());
        e.setPaysOrigine(d.getPaysOrigine());
        e.setTitreEvenement(d.getTitreEvenement());      e.setSousTitreEvenement(d.getSousTitreEvenement());
        e.setOwnerEvenement(d.getOwnerEvenement());      e.setContactOrganisateur(d.getContactOrganisateur());
        e.setDateDebut(d.getDateDebut() != null ? d.getDateDebut() : d.getSalleEvenement()); // compat
        e.setDateDebut(d.getDateDebut());                e.setDateFin(d.getDateFin());
        e.setHeureDebut(d.getHeureDebut());              e.setHeureFin(d.getHeureFin());
        e.setLieuEvenement(d.getLieuEvenement());        e.setSalle(d.getSalleEvenement());
        e.setStand(d.getStandEvenement());               e.setTableNumero(d.getTableNumero());
        e.setVilleEvenement(d.getVilleEvenement());      e.setPaysEvenement(d.getPaysEvenement());
        e.setTypeAcces(d.getTypeAcces() != null ? d.getTypeAcces() : d.getAccessType());
        e.setNumeroBadge(d.getNumeroBadge());            e.setSessionsAutorisees(d.getSessionsAutorisees());
        e.setValiditeJournee(d.getValiditeJournee());    e.setLogoEvenement(d.getLogoEvenement());
        e.setImageFond(d.getImageFond());                e.setCouleurTheme(d.getCouleurTheme());
        e.setQrCode(d.getQrCode());                      e.setQrDataUrl(d.getQrDataUrl());
        e.setCodeBarre(d.getCodeBarre());
    }

    private CardCarteScolaire buildCs(CardDto d, CardBase base) {
        CardCarteScolaire e = new CardCarteScolaire();
        e.setBase(base);
        applyCs(d, e);
        return e;
    }

    private void applyCs(CardDto d, CardCarteScolaire e) {
        e.setNom(d.getNom());                            e.setPrenoms(d.getPrenoms());
        e.setPhoto(d.getPhoto());                        e.setGenre(d.getGenre());
        e.setDateNaissance(d.getDateNaissance());        e.setLieuNaissance(d.getLieuNaissance());
        e.setNationalite(d.getNationalite());
        e.setNumeroMatricule(d.getNumeroMatricule() != null ? d.getNumeroMatricule() : d.getMatricule());
        e.setNumeroInscription(d.getNumeroInscription());
        e.setClasse(d.getClasse());                      e.setNiveau(d.getNiveau());
        e.setFiliere(d.getFiliere());                    e.setSerie(d.getSerie());
        e.setAnneeScolaire(d.getAnneeScolaire());        e.setDateInscription(d.getDateInscription());
        e.setDateExpiration(d.getDateExpiration());      e.setTypeApprenant(d.getTypeApprenant());
        e.setBoursier(d.getBoursier());                  e.setTypeBourse(d.getTypeBourse());
        e.setContact(d.getContact());                    e.setEmail(d.getEmail());
        e.setAdresse(d.getAdresse());
        e.setNomTuteur(d.getNomTuteur());                e.setContactTuteur(d.getContactTuteur());
        e.setRelationTuteur(d.getRelationTuteur());
        e.setEtablissement(d.getEtablissementScolaire()); e.setSigleEts(d.getSigleEts());
        e.setTypeEtablissement(d.getTypeEtablissement()); e.setAdresseEts(d.getAdresseEts());
        e.setVilleEts(d.getVilleEts());                  e.setPaysEts(d.getPaysEts());
        e.setLogoEts(d.getLogoEts() != null ? d.getLogoEts() : d.getLogo());
        e.setArmoirie(d.getArmoirie());                  e.setCachet(d.getCachet());
        e.setSignatureDirecteur(d.getSignatureDirecteur() != null ? d.getSignatureDirecteur() : d.getSignatureResponsable());
        e.setNomDirecteur(d.getNomDirecteur());
        e.setCouleurBandeau1(d.getCouleurBandeau1());    e.setCouleurBandeau2(d.getCouleurBandeau2());
        e.setTitreCarte(d.getTitreCarte());              e.setGroupeSanguin(d.getGroupeSanguin());
        e.setAllergies(d.getAllergies());
        e.setQrCode(d.getQrCode());                      e.setQrDataUrl(d.getQrDataUrl());
        e.setCodeBarre(d.getCodeBarre());
    }

    /* ── DTO converters ──────────────────────────────────────────────── */

    private CardDto baseOnlyDto(CardBase b) {
        return CardDto.builder()
                .id(b.getId()).userId(b.getUserId()).code(b.getCode())
                .category(b.getCategory()).cardDesignId(b.getCardDesignId())
                .entrepriseId(b.getEntrepriseId()).couleur1(b.getCouleur1())
                .couleur2(b.getCouleur2()).createdAt(b.getCreatedAt()).updatedAt(b.getUpdatedAt())
                .build();
    }

    private CardDto toDto(CardBase b, CardBadgeIdentite e) {
        return CardDto.builder()
                .id(b.getId()).userId(b.getUserId()).code(b.getCode())
                .category(b.getCategory()).cardDesignId(b.getCardDesignId())
                .entrepriseId(b.getEntrepriseId()).couleur1(b.getCouleur1())
                .couleur2(b.getCouleur2()).createdAt(b.getCreatedAt()).updatedAt(b.getUpdatedAt())
                .nom(e.getNom()).prenoms(e.getPrenoms()).photo(e.getPhoto())
                .civilite(e.getCivilite()).genre(e.getGenre())
                .dateNaissance(e.getDateNaissance()).lieuNaissance(e.getLieuNaissance())
                .nationalite(e.getNationalite()).titre(e.getTitrePoste())
                .departement(e.getDepartement()).service(e.getService())
                .matricule(e.getMatricule()).dateEmbauche(e.getDateEmbauche())
                .dateExpiration(e.getDateExpiration()).accessType(e.getAccessType())
                .niveauAcces(e.getNiveauAcces()).zonesAcces(e.getZonesAcces())
                .email(e.getEmail()).contact(e.getTelephone()).adresse(e.getAdresse())
                .siteWeb(e.getSiteWeb()).entreprise(e.getEntreprise())
                .sigleEntreprise(e.getSigleEntreprise()).logo(e.getLogo())
                .armoirie(e.getArmoirie()).cachet(e.getCachet())
                .signatureResponsable(e.getSignatureResponsable())
                .photoFormat(e.getPhotoFormat()).qrCode(e.getQrCode())
                .qrDataUrl(e.getQrDataUrl()).codeBarre(e.getCodeBarre())
                .build();
    }

    private CardDto toDto(CardBase b, CardCarteVisite e) {
        return CardDto.builder()
                .id(b.getId()).userId(b.getUserId()).code(b.getCode())
                .category(b.getCategory()).cardDesignId(b.getCardDesignId())
                .entrepriseId(b.getEntrepriseId()).couleur1(b.getCouleur1())
                .couleur2(b.getCouleur2()).createdAt(b.getCreatedAt()).updatedAt(b.getUpdatedAt())
                .nom(e.getNom()).prenoms(e.getPrenoms()).photo(e.getPhoto())
                .civilite(e.getCivilite()).titre(e.getTitrePoste())
                .specialite(e.getSpecialite()).certifications(e.getCertifications())
                .slogan(e.getSlogan()).email(e.getEmail())
                .emailSecondaire(e.getEmailSecondaire()).contact(e.getTelephone())
                .mobile(e.getMobile()).fax(e.getFax()).whatsapp(e.getWhatsapp())
                .skype(e.getSkype()).siteWeb(e.getSiteWeb()).linkedin(e.getLinkedin())
                .twitter(e.getTwitter()).instagram(e.getInstagram()).facebook(e.getFacebook())
                .adresseLigne1(e.getAdresseLigne1()).adresseLigne2(e.getAdresseLigne2())
                .adresse(e.getAdresseLigne1()).ville(e.getVille()).codePostal(e.getCodePostal())
                .pays(e.getPays()).entreprise(e.getEntreprise())
                .sigleEntreprise(e.getSigleEntreprise()).logo(e.getLogo())
                .matricule(e.getMatricule()).qrCode(e.getQrCode())
                .qrDataUrl(e.getQrDataUrl()).qrType(e.getQrType())
                .build();
    }

    private CardDto toDto(CardBase b, CardBadgeEvenement e) {
        return CardDto.builder()
                .id(b.getId()).userId(b.getUserId()).code(b.getCode())
                .category(b.getCategory()).cardDesignId(b.getCardDesignId())
                .entrepriseId(b.getEntrepriseId()).couleur1(b.getCouleur1())
                .couleur2(b.getCouleur2()).createdAt(b.getCreatedAt()).updatedAt(b.getUpdatedAt())
                .nom(e.getNom()).prenoms(e.getPrenoms()).photo(e.getPhoto())
                .titreParticipant(e.getTitreParticipant()).titre(e.getTitreParticipant())
                .organisationParticipant(e.getOrganisationParticipant())
                .entreprise(e.getOrganisationParticipant())
                .paysOrigine(e.getPaysOrigine())
                .titreEvenement(e.getTitreEvenement()).sousTitreEvenement(e.getSousTitreEvenement())
                .ownerEvenement(e.getOwnerEvenement()).contactOrganisateur(e.getContactOrganisateur())
                .dateDebut(e.getDateDebut()).dateFin(e.getDateFin())
                .heureDebut(e.getHeureDebut()).heureFin(e.getHeureFin())
                .lieuEvenement(e.getLieuEvenement()).salleEvenement(e.getSalle())
                .standEvenement(e.getStand()).tableNumero(e.getTableNumero())
                .villeEvenement(e.getVilleEvenement()).paysEvenement(e.getPaysEvenement())
                .typeAcces(e.getTypeAcces()).accessType(e.getTypeAcces())
                .numeroBadge(e.getNumeroBadge()).sessionsAutorisees(e.getSessionsAutorisees())
                .validiteJournee(e.getValiditeJournee()).logoEvenement(e.getLogoEvenement())
                .imageFond(e.getImageFond()).couleurTheme(e.getCouleurTheme())
                .qrCode(e.getQrCode()).qrDataUrl(e.getQrDataUrl()).codeBarre(e.getCodeBarre())
                .build();
    }

    private CardDto toDto(CardBase b, CardCarteScolaire e) {
        return CardDto.builder()
                .id(b.getId()).userId(b.getUserId()).code(b.getCode())
                .category(b.getCategory()).cardDesignId(b.getCardDesignId())
                .entrepriseId(b.getEntrepriseId()).couleur1(b.getCouleur1())
                .couleur2(b.getCouleur2()).createdAt(b.getCreatedAt()).updatedAt(b.getUpdatedAt())
                .nom(e.getNom()).prenoms(e.getPrenoms()).photo(e.getPhoto()).genre(e.getGenre())
                .dateNaissance(e.getDateNaissance()).lieuNaissance(e.getLieuNaissance())
                .nationalite(e.getNationalite())
                .numeroMatricule(e.getNumeroMatricule()).matricule(e.getNumeroMatricule())
                .numeroInscription(e.getNumeroInscription())
                .classe(e.getClasse()).niveau(e.getNiveau()).filiere(e.getFiliere())
                .serie(e.getSerie()).anneeScolaire(e.getAnneeScolaire())
                .dateInscription(e.getDateInscription()).dateExpiration(e.getDateExpiration())
                .typeApprenant(e.getTypeApprenant()).boursier(e.getBoursier())
                .typeBourse(e.getTypeBourse()).contact(e.getContact()).email(e.getEmail())
                .adresse(e.getAdresse()).nomTuteur(e.getNomTuteur())
                .contactTuteur(e.getContactTuteur()).relationTuteur(e.getRelationTuteur())
                .etablissementScolaire(e.getEtablissement()).sigleEts(e.getSigleEts())
                .typeEtablissement(e.getTypeEtablissement()).adresseEts(e.getAdresseEts())
                .villeEts(e.getVilleEts()).paysEts(e.getPaysEts()).logoEts(e.getLogoEts())
                .logo(e.getLogoEts()).armoirie(e.getArmoirie()).cachet(e.getCachet())
                .signatureDirecteur(e.getSignatureDirecteur()).nomDirecteur(e.getNomDirecteur())
                .signatureResponsable(e.getSignatureDirecteur())
                .couleurBandeau1(e.getCouleurBandeau1()).couleurBandeau2(e.getCouleurBandeau2())
                .titreCarte(e.getTitreCarte()).groupeSanguin(e.getGroupeSanguin())
                .allergies(e.getAllergies()).qrCode(e.getQrCode())
                .qrDataUrl(e.getQrDataUrl()).codeBarre(e.getCodeBarre())
                .build();
    }
}
