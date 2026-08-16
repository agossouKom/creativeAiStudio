package com.creativeai.auth.service;

import com.creativeai.auth.dto.SenderProfileDto;
import com.creativeai.auth.model.SenderProfile;
import com.creativeai.auth.model.User;
import com.creativeai.auth.repository.SenderProfileRepository;
import com.creativeai.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SenderProfileService {

    private final SenderProfileRepository repo;
    private final UserRepository userRepo;

    public SenderProfileDto get() {
        User user = currentUser();
        return repo.findByUserId(user.getId())
                .map(this::toDto)
                .orElse(emptyDto());
    }

    public SenderProfileDto upsert(SenderProfileDto dto) {
        User user = currentUser();
        SenderProfile p = repo.findByUserId(user.getId())
                .orElseGet(() -> SenderProfile.builder().user(user).build());

        p.setPrenom(dto.prenom());       p.setNom(dto.nom());
        p.setPoste(dto.poste());         p.setDepartement(dto.departement());
        p.setSociete(dto.societe());     p.setSecteur(dto.secteur());
        p.setSiteWeb(dto.siteWeb());     p.setAdresse(dto.adresse());
        p.setEmail(dto.email());         p.setTelephone(dto.telephone());
        p.setTelephoneFixe(dto.telephoneFixe()); p.setLinkedin(dto.linkedin());
        p.setSignature(dto.signature()); p.setTonEmail(dto.tonEmail());
        p.setLangue(dto.langue());       p.setDevise(dto.devise());
        p.setContexteSup(dto.contexteSup());

        return toDto(repo.save(p));
    }

    private SenderProfileDto toDto(SenderProfile p) {
        return new SenderProfileDto(
            p.getId(), p.getPrenom(), p.getNom(), p.getPoste(), p.getDepartement(),
            p.getSociete(), p.getSecteur(), p.getSiteWeb(), p.getAdresse(),
            p.getEmail(), p.getTelephone(), p.getTelephoneFixe(), p.getLinkedin(),
            p.getSignature(), p.getTonEmail(), p.getLangue(), p.getDevise(),
            p.getContexteSup()
        );
    }

    private SenderProfileDto emptyDto() {
        return new SenderProfileDto(null, "", "", "", "", "", "", "", "", "", "", "", "", "", "professionnel", "fr", "EUR", "");
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepo.findByEmail(email).orElseThrow();
    }
}
