package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.CardEntreprise;
import com.creativeai.agentteam.repository.CardEntrepriseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CardEntrepriseService {

    private final CardEntrepriseRepository repo;

    public List<CardEntreprise> list(String userId) {
        return repo.findByUserIdAndDeletedFalseOrderByRaisonSocialAsc(userId);
    }

    @Transactional
    public CardEntreprise save(CardEntreprise e) {
        if (e.getCode() == null || e.getCode().isBlank()) {
            e.setCode(generateCode());
        }
        return repo.save(e);
    }

    @Transactional
    public CardEntreprise update(String id, String userId, CardEntreprise body) {
        CardEntreprise ex = repo.findByIdAndUserIdAndDeletedFalse(id, userId)
                .orElseThrow(() -> new RuntimeException("CardEntreprise not found"));
        ex.setRaisonSocial(body.getRaisonSocial());
        ex.setSigleEntreprise(body.getSigleEntreprise());
        ex.setFormeJuridique(body.getFormeJuridique());
        ex.setIfu(body.getIfu());
        ex.setRccm(body.getRccm());
        ex.setCapitalSocial(body.getCapitalSocial());
        ex.setEmail(body.getEmail());
        ex.setContact(body.getContact());
        ex.setTelephone(body.getTelephone());
        ex.setFax(body.getFax());
        ex.setSiteWeb(body.getSiteWeb());
        ex.setAdresse(body.getAdresse());
        ex.setBoitePostale(body.getBoitePostale());
        ex.setVille(body.getVille());
        ex.setPays(body.getPays());
        ex.setSecteurActivite(body.getSecteurActivite());
        ex.setNiche(body.getNiche());
        ex.setDescription(body.getDescription());
        ex.setResponsable(body.getResponsable());
        ex.setTitreResponsable(body.getTitreResponsable());
        ex.setLogo(body.getLogo());
        ex.setArmoirie(body.getArmoirie());
        ex.setCachet(body.getCachet());
        ex.setSignatureResponsable(body.getSignatureResponsable());
        ex.setCouleur1(body.getCouleur1());
        ex.setCouleur2(body.getCouleur2());
        return repo.save(ex);
    }

    @Transactional
    public void delete(String id, String userId) {
        repo.findByIdAndUserIdAndDeletedFalse(id, userId).ifPresent(e -> {
            e.setDeleted(true);
            repo.save(e);
        });
    }

    private String generateCode() {
        String year   = String.valueOf(LocalDate.now().getYear());
        String suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return "CE-" + year + "-" + suffix;
    }
}
