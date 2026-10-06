package com.creativeai.agentteam.llm;

import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.AgentTeam;
import com.creativeai.agentteam.model.LlmProvider;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.AgentTeamRepository;
import com.creativeai.agentteam.repository.LlmProviderRepository;
import com.creativeai.agentteam.service.EncryptionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class LlmGatewayTeamProviderTest {

    private final LlmProviderRepository llmRepository = mock(LlmProviderRepository.class);
    private final AgentRepository agentRepository = mock(AgentRepository.class);
    private final AgentTeamRepository teamRepository = mock(AgentTeamRepository.class);
    private final LlmGateway gateway = new LlmGateway(
        llmRepository,
        agentRepository,
        teamRepository,
        mock(EncryptionService.class),
        mock(WebClient.Builder.class),
        new ObjectMapper(),
        mock(QuotaTracker.class));

    @BeforeEach
    void setUp() {
        when(llmRepository.findByAgentIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("agent-1"))
            .thenReturn(List.of());
        when(llmRepository.findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("owner@example.com"))
            .thenReturn(List.of());
    }

    @Test
    void resolvesTeamProvidersBeforeAccountProviders() {
        Agent agent = Agent.builder().ownerId("owner@example.com").teamId("team-1").build();
        LlmProvider teamProvider = LlmProvider.builder().teamId("team-1").autoAssigned(false).build();
        LlmProvider accountProvider = LlmProvider.builder().userId("owner@example.com").build();
        when(agentRepository.findByIdAndOwnerIdAndDeletedFalse("agent-1", "owner@example.com"))
            .thenReturn(Optional.of(agent));
        when(teamRepository.findByIdAndOwnerIdAndDeletedFalse("team-1", "owner@example.com"))
            .thenReturn(Optional.of(AgentTeam.builder().build()));
        when(llmRepository.findByTeamIdAndAutoAssignedFalseAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("team-1"))
            .thenReturn(List.of(teamProvider));
        when(llmRepository.findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("owner@example.com"))
            .thenReturn(List.of(accountProvider));

        List<LlmProvider> candidates =
            gateway.resolveProviderCandidates("agent-1", "owner@example.com");

        assertEquals(2, candidates.size());
        assertSame(teamProvider, candidates.get(0));
        assertSame(accountProvider, candidates.get(1));
        verify(llmRepository).findByTeamIdAndAutoAssignedFalseAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("team-1");
    }

    /**
     * C'est la régression que tout ce dispositif d'attribution automatique
     * cherche à éviter. Le provider d'équipe déposé automatiquement est un
     * choix de la plateforme, pas de l'utilisateur : s'il passait avant le
     * provider de compte, l'utilisateur verrait son modèle dans son espace de
     * travail tout en étant servi par un autre, sans le savoir et sans moyen de
     * le constater.
     */
    @Test
    void resolvesAccountProvidersBeforeAutoAssignedTeamProviders() {
        Agent agent = Agent.builder().ownerId("owner@example.com").teamId("team-1").build();
        LlmProvider autoTeamProvider = LlmProvider.builder().teamId("team-1").autoAssigned(true).build();
        LlmProvider accountProvider = LlmProvider.builder().userId("owner@example.com").build();
        when(agentRepository.findByIdAndOwnerIdAndDeletedFalse("agent-1", "owner@example.com"))
            .thenReturn(Optional.of(agent));
        when(teamRepository.findByIdAndOwnerIdAndDeletedFalse("team-1", "owner@example.com"))
            .thenReturn(Optional.of(AgentTeam.builder().build()));
        when(llmRepository.findByTeamIdAndAutoAssignedTrueAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("team-1"))
            .thenReturn(List.of(autoTeamProvider));
        when(llmRepository.findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("owner@example.com"))
            .thenReturn(List.of(accountProvider));

        List<LlmProvider> candidates =
            gateway.resolveProviderCandidates("agent-1", "owner@example.com");

        assertEquals(2, candidates.size());
        assertSame(accountProvider, candidates.get(0));
        assertSame(autoTeamProvider, candidates.get(1));
    }

    /**
     * Sans provider de compte, l'attribution automatique prend le relais : une
     * équipe doit toujours avoir un modèle, sinon l'agent resterait muet.
     */
    @Test
    void fallsBackToAutoAssignedTeamProviderWhenAccountHasNone() {
        Agent agent = Agent.builder().ownerId("owner@example.com").teamId("team-1").build();
        LlmProvider autoTeamProvider = LlmProvider.builder().teamId("team-1").autoAssigned(true).build();
        when(agentRepository.findByIdAndOwnerIdAndDeletedFalse("agent-1", "owner@example.com"))
            .thenReturn(Optional.of(agent));
        when(teamRepository.findByIdAndOwnerIdAndDeletedFalse("team-1", "owner@example.com"))
            .thenReturn(Optional.of(AgentTeam.builder().build()));
        when(llmRepository.findByTeamIdAndAutoAssignedTrueAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("team-1"))
            .thenReturn(List.of(autoTeamProvider));

        List<LlmProvider> candidates =
            gateway.resolveProviderCandidates("agent-1", "owner@example.com");

        assertEquals(1, candidates.size());
        assertSame(autoTeamProvider, candidates.get(0));
    }

    @Test
    void doesNotResolveAnotherOwnersTeamProvider() {
        when(llmRepository.findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("owner@example.com"))
            .thenReturn(List.of(LlmProvider.builder().userId("owner@example.com").build()));
        when(agentRepository.findByIdAndOwnerIdAndDeletedFalse("agent-1", "owner@example.com"))
            .thenReturn(Optional.empty());

        gateway.resolveProviderCandidates("agent-1", "owner@example.com");

        verifyNoInteractions(teamRepository);
        verify(llmRepository).findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("owner@example.com");
    }

    /**
     * Un provider désactivé (active=false) ne doit plus être proposé au
     * runtime : le filtre est porté par les méthodes ActiveTrue du repository.
     */
    @Test
    void skipsInactiveAccountProviders() {
        LlmProvider inactive = LlmProvider.builder().userId("owner@example.com").active(false).build();
        // Le repository ne renvoie que les lignes active=true : une ligne
        // désactivée est absente du résultat.
        when(llmRepository.findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("owner@example.com"))
            .thenReturn(List.of());

        assertThrows(IllegalStateException.class, () -> gateway.resolveProviderCandidates(null, "owner@example.com"));

        verify(llmRepository).findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("owner@example.com");
        assertFalse(inactive.isActive());
    }
}
