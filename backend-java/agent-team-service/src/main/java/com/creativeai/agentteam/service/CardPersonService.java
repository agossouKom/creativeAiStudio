package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.CardPerson;
import com.creativeai.agentteam.repository.CardPersonRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CardPersonService {

    private final CardPersonRepository repo;

    public List<CardPerson> list(String userId, String category, String entreprise) {
        if (category != null && !category.isBlank() && entreprise != null && !entreprise.isBlank()) {
            return repo.findByUserIdAndCategoryAndEntrepriseAndDeletedFalseOrderByCreatedAtDesc(userId, category, entreprise);
        } else if (category != null && !category.isBlank()) {
            return repo.findByUserIdAndCategoryAndDeletedFalseOrderByCreatedAtDesc(userId, category);
        } else if (entreprise != null && !entreprise.isBlank()) {
            return repo.findByUserIdAndEntrepriseAndDeletedFalseOrderByCreatedAtDesc(userId, entreprise);
        }
        return repo.findByUserIdAndDeletedFalseOrderByCreatedAtDesc(userId);
    }

    public List<String> listEntreprises(String userId, String category) {
        if (category != null && !category.isBlank()) {
            return repo.findDistinctEntreprisesByUserIdAndCategory(userId, category);
        }
        return repo.findDistinctEntreprisesByUserId(userId);
    }

    @Transactional
    public CardPerson save(CardPerson p) {
        if (p.getCode() == null || p.getCode().isBlank()) {
            p.setCode(generateCode(p.getCategory()));
        }
        return repo.save(p);
    }

    @Transactional
    public List<CardPerson> saveBulk(List<CardPerson> persons) {
        persons.forEach(p -> {
            if (p.getCode() == null || p.getCode().isBlank()) {
                p.setCode(generateCode(p.getCategory()));
            }
        });
        return repo.saveAll(persons);
    }

    @Transactional
    public CardPerson update(String id, String userId, CardPerson body) {
        CardPerson existing = repo.findByIdAndUserIdAndDeletedFalse(id, userId)
                .orElseThrow(() -> new RuntimeException("CardPerson not found"));
        existing.setNom(body.getNom());
        existing.setPrenoms(body.getPrenoms());
        existing.setPhoto(body.getPhoto());
        existing.setTitre(body.getTitre());
        existing.setProfession(body.getProfession());
        existing.setEmail(body.getEmail());
        existing.setContact(body.getContact());
        existing.setAdresse(body.getAdresse());
        existing.setSiteWeb(body.getSiteWeb());
        existing.setDescription(body.getDescription());
        existing.setMatricule(body.getMatricule());
        existing.setSignature(body.getSignature());
        existing.setQrCode(body.getQrCode());
        existing.setCouleur1(body.getCouleur1());
        existing.setCouleur2(body.getCouleur2());
        existing.setEntreprise(body.getEntreprise());
        existing.setSigleEntreprise(body.getSigleEntreprise());
        existing.setLogo(body.getLogo());
        existing.setAccessType(body.getAccessType());
        existing.setDateNaissance(body.getDateNaissance());
        existing.setLieuNaissance(body.getLieuNaissance());
        existing.setEtablissementScolaire(body.getEtablissementScolaire());
        existing.setSigleEts(body.getSigleEts());
        existing.setArmoirie(body.getArmoirie());
        existing.setClasse(body.getClasse());
        existing.setAnneeScolaire(body.getAnneeScolaire());
        existing.setCachet(body.getCachet());
        existing.setSignatureResponsable(body.getSignatureResponsable());
        existing.setTitreEvenement(body.getTitreEvenement());
        existing.setOwnerEvenement(body.getOwnerEvenement());
        existing.setSousTitreEvenement(body.getSousTitreEvenement());
        existing.setDateEvenement(body.getDateEvenement());
        existing.setSalleEvenement(body.getSalleEvenement());
        existing.setStandEvenement(body.getStandEvenement());
        existing.setCardDesignId(body.getCardDesignId());
        existing.setEntrepriseId(body.getEntrepriseId());
        return repo.save(existing);
    }

    @Transactional
    public void delete(String id, String userId) {
        repo.findByIdAndUserIdAndDeletedFalse(id, userId).ifPresent(p -> {
            p.setDeleted(true);
            repo.save(p);
        });
    }

    private String generateCode(String category) {
        String prefix = switch (category == null ? "" : category.toUpperCase()) {
            case "BADGE_IDENTITE"  -> "BI";
            case "BADGE_EVENEMENT" -> "BE";
            case "CARTE_VISITE"    -> "CV";
            case "CARTE_SCOLAIRE"  -> "CS";
            default                -> "CB";
        };
        String year   = String.valueOf(LocalDate.now().getYear());
        String suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return "CB-" + prefix + "-" + year + "-" + suffix;
    }
}
