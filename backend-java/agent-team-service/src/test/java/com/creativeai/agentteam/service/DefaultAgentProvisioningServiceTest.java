package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.repository.AgentConfigRepository;
import com.creativeai.agentteam.repository.AgentProfileRepository;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.KnowledgeBaseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Couvre l'agent système « Studio », créé une fois par compte.
 *
 * <p>Deux propriétés sont non négociables : une seule ligne par compte, et une
 * ligne par compte — jamais un agent partagé. Un agent sans propriétaire unique
 * n'appartient à personne : les accès, comme la liste du tableau de bord, sont
 * filtrés sur ownerId, donc un agent partagé serait soit invisible, soit
 * visible par tout le monde.
 */
class DefaultAgentProvisioningServiceTest {

    private AgentRepository         agentRepo;
    private AgentConfigRepository   configRepo;
    private AgentProfileRepository  profileRepo;
    private KnowledgeBaseRepository kbRepo;
    private DefaultAgentProvisioningService service;

    @BeforeEach
    void setUp() {
        agentRepo  = mock(AgentRepository.class);
        configRepo = mock(AgentConfigRepository.class);
        profileRepo = mock(AgentProfileRepository.class);
        kbRepo     = mock(KnowledgeBaseRepository.class);
        service = new DefaultAgentProvisioningService(agentRepo, configRepo, profileRepo, kbRepo);
    }

    @Test
    @DisplayName("Le premier chargement crée Studio, sans équipe")
    void createsStudioForNewAccount() {
        when(agentRepo.findByOwnerIdAndDefaultSystemTrueAndDeletedFalse("user@creativeai.com"))
            .thenReturn(List.of());
        when(agentRepo.existsByCode(anyString())).thenReturn(false);
        when(agentRepo.findBySlugAndDeletedFalse(anyString())).thenReturn(Optional.empty());
        when(agentRepo.save(any(Agent.class))).thenAnswer(inv -> {
            Agent saved = inv.getArgument(0);
            saved.setId("studio-1");
            return saved;
        });

        Optional<Agent> result = service.ensureStudioFor("user@creativeai.com");

        assertThat(result).isPresent();
        Agent studio = result.orElseThrow();
        assertThat(studio.getName()).isEqualTo("Studio");
        assertThat(studio.getOwnerId()).isEqualTo("user@creativeai.com");
        // Sans équipe : c'est ce qui permet à l'interface de l'afficher dans le
        // filtre de chacune des équipes du compte.
        assertThat(studio.getTeamId()).isNull();
        assertThat(studio.isDefaultSystem()).isTrue();

        // Config, profil et base de connaissances : sans eux l'agent serait
        // affiché mais inutilisable.
        verify(configRepo).save(any());
        verify(profileRepo).save(any());
        verify(kbRepo).save(any());
    }

    @Test
    @DisplayName("Les chargements suivants ne recréent rien")
    void isIdempotentForAccountThatAlreadyHasStudio() {
        Agent existing = Agent.builder().name("Studio").ownerId("user@creativeai.com").defaultSystem(true).build();
        existing.setId("studio-1");
        when(agentRepo.findByOwnerIdAndDefaultSystemTrueAndDeletedFalse("user@creativeai.com"))
            .thenReturn(List.of(existing));

        Optional<Agent> result = service.ensureStudioFor("user@creativeai.com");

        assertThat(result).containsSame(existing);

        verify(agentRepo, never()).save(any(Agent.class));
        verifyNoInteractions(configRepo, profileRepo, kbRepo);
    }

    /**
     * Deux comptes doivent produire deux slugs et deux codes. Un slug commun
     * ferait pointer le premier Studio créé vers l'agent du second compte.
     */
    @Test
    @DisplayName("Deux comptes obtiennent des identifiants distincts")
    void generatesDistinctIdentifiersPerAccount() {
        when(agentRepo.findByOwnerIdAndDefaultSystemTrueAndDeletedFalse(anyString()))
            .thenReturn(List.of());
        when(agentRepo.existsByCode(anyString())).thenReturn(false);
        when(agentRepo.findBySlugAndDeletedFalse(anyString())).thenReturn(Optional.empty());
        when(agentRepo.save(any(Agent.class))).thenAnswer(inv -> inv.getArgument(0));

        String slugA = service.ensureStudioFor("alice@creativeai.com").orElseThrow().getSlug();
        String slugB = service.ensureStudioFor("bob@creativeai.com").orElseThrow().getSlug();

        assertThat(slugA).isNotEqualTo(slugB);
        verify(agentRepo, times(2)).save(any(Agent.class));
    }

    @Test
    @DisplayName("Un slug déjà pris reçoit un suffixe plutôt que d'écraser l'agent existant")
    void avoidsSlugCollisionWithExistingAgent() {
        when(agentRepo.findByOwnerIdAndDefaultSystemTrueAndDeletedFalse("user@creativeai.com"))
            .thenReturn(List.of());
        when(agentRepo.existsByCode(anyString())).thenReturn(false);
        when(agentRepo.findBySlugAndDeletedFalse(anyString()))
            .thenReturn(Optional.of(Agent.builder().name("Studio").build()))
            .thenReturn(Optional.empty());
        when(agentRepo.save(any(Agent.class))).thenAnswer(inv -> inv.getArgument(0));

        String slug = service.ensureStudioFor("user@creativeai.com").orElseThrow().getSlug();

        assertThat(slug).startsWith("studio-").endsWith("-2");
    }

    @Test
    @DisplayName("Un compte vide n'est jamais provisionné")
    void ignoresBlankOwner() {
        assertThat(service.ensureStudioFor(null)).isEmpty();
        assertThat(service.ensureStudioFor("  ")).isEmpty();

        verifyNoInteractions(agentRepo, configRepo, profileRepo, kbRepo);
    }
}