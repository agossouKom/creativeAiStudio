package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.AgentConfig;
import com.creativeai.agentteam.model.AgentProfile;
import com.creativeai.agentteam.model.KnowledgeBase;
import com.creativeai.agentteam.model.enums.AgentType;
import com.creativeai.agentteam.repository.AgentConfigRepository;
import com.creativeai.agentteam.repository.AgentProfileRepository;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.KnowledgeBaseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Crée l'agent « Studio » dans chaque compte, une seule fois.
 *
 * <p>Studio est l'agent que l'utilisateur trouve en arrivant : il appartient au
 * compte, pas à une équipe en particulier, et l'interface l'affiche dans le
 * filtre de chacune des équipes du compte.
 *
 * <p>Une ligne par compte plutôt qu'un agent partagé. {@code owner_id} est la
 * clef d'autorisation de tout le service — liste du tableau de bord, contrôle
 * d'accès à chaque endpoint, sélection des providers. Un agent sans
 * propriétaire unique n'appartendrait à personne et ne pourrait plus être
 * protégé : il faudrait réécrire ces contrôles partout, avec le risque d'ouvrir
 * des failles sur les agents des autres.
 *
 * <p>Le provisionnement est paresseux, déclenché au premier chargement du
 * tableau de bord. Aucun branchement sur l'inscription n'est nécessaire : le
 * compte et son agent système n'ont pas à être créés dans la même transaction,
 * et un agent manquant se rattrape tout seul au premier affichage.
 *
 * <p>{@code REQUIRES_NEW} est nécessaire, comme pour les providers : l'appelant
 * est une lecture seule, où Hibernate working in {@code FlushMode.MANUAL} et
 * n'écrirait jamais la ligne créée.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DefaultAgentProvisioningService {

    /** Nom de l'agent système. Constant : l'interface s'appuie dessus pour l'identifier. */
    public static final String STUDIO_NAME = "Studio";

    private final AgentRepository         agentRepo;
    private final AgentConfigRepository   configRepo;
    private final AgentProfileRepository  profileRepo;
    private final KnowledgeBaseRepository kbRepo;

    /**
     * Crée Studio pour ce compte s'il n'en a pas encore.
     *
     * @return l'agent système du compte, vide si le compte est inconnu ou vide
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<Agent> ensureStudioFor(String ownerId) {
        if (ownerId == null || ownerId.isBlank()) {
            return Optional.empty();
        }

        List<Agent> existing = agentRepo.findByOwnerIdAndDefaultSystemTrueAndDeletedFalse(ownerId);
        if (!existing.isEmpty()) {
            return Optional.of(existing.get(0));
        }

        Agent studio = Agent.builder()
            .name(STUDIO_NAME)
            .slug(uniqueSlug(ownerId))
            .code(uniqueCode())
            .description("Agent système du compte. Présent dans chacune de vos équipes.")
            .type(AgentType.VIDEO_CREATOR)
            .ownerId(ownerId)
            .teamId(null)
            .defaultSystem(true)
            .build();
        studio = agentRepo.save(studio);

        // Config et profil : le tableau de bord et l'éditeur lisent ces objets.
        // Les provisionner ici évite un agent affiché mais inutilisable.
        configRepo.save(AgentConfig.builder().agent(studio).build());
        profileRepo.save(AgentProfile.builder().agent(studio)
            .displayName(STUDIO_NAME).build());
        kbRepo.save(KnowledgeBase.builder().agent(studio)
            .name(STUDIO_NAME + " - Knowledge Base").build());

        log.info("[AGENT] Agent système « {} » créé pour userId={} (id={})",
            STUDIO_NAME, ownerId, studio.getId());
        return Optional.of(studio);
    }

    /** Slug unique dérivé du compte : deux comptes doivent donner deux slugs. */
    private String uniqueSlug(String ownerId) {
        String base = STUDIO_NAME.toLowerCase() + "-" + Integer.toHexString(ownerId.hashCode());
        String slug = base;
        int suffix = 2;
        while (agentRepo.findBySlugAndDeletedFalse(slug).isPresent()) {
            slug = base + "-" + suffix++;
        }
        return slug;
    }

    /** Code court à 6 caractères max, comme les agents créés manuellement. */
    private String uniqueCode() {
        String code;
        do {
            code = Long.toHexString(
                (long) (Math.random() * 0xFFFFFFL) + 0x100000L).toUpperCase();
            code = code.substring(0, Math.min(6, code.length()));
        } while (agentRepo.existsByCode(code));
        return code;
    }
}