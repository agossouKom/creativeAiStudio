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

    /**
     * Le cas qui a coûté une fausse lecture en production.
     *
     * <p>Un provider d'agent et un provider sans équipe ni compte ne se
     * distinguent pas par leurs attributs : dans les deux cas userId et teamId
     * sont nuls, actif est vrai, et le modèle affiché est le même. En ne
     * regardant que ces champs, le provider d'agent passerait pour le repli sur
     * la clé d'environnement — ce qui est arrivé, et a fait conclure à tort
     * qu'aucun provider n'était configuré.
     *
     * <p>Le tier est donc la seule information fiable, et il doit venir de la
     * même chaîne que l'ordre des candidats.
     */
    @Test
    void reportsAgentSourceForAgentScopedProvider() {
        // Le provider est rattaché par association à l'agent, pas par un
        // agentId : c'est ce qui produit exactement la situation mal lue, un
        // provider sans userId ni teamId mais relié à un agent.
        Agent attached = Agent.builder().ownerId("owner@example.com").build();
        attached.setId("agent-1");
        LlmProvider agentProvider = LlmProvider.builder().agent(attached).build();
        when(llmRepository.findByAgentIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("agent-1"))
            .thenReturn(List.of(agentProvider));

        LlmResolution resolution = gateway.resolveProviderResolution("agent-1", "owner@example.com");

        assertSame(agentProvider, resolution.provider());
        assertEquals(LlmSource.AGENT, resolution.source());
    }

    @Test
    void reportsAccountSourceForAccountProvider() {
        Agent agent = Agent.builder().ownerId("owner@example.com").teamId("team-1").build();
        LlmProvider accountProvider = LlmProvider.builder().userId("owner@example.com").build();
        when(agentRepository.findByIdAndOwnerIdAndDeletedFalse("agent-1", "owner@example.com"))
            .thenReturn(Optional.of(agent));
        when(teamRepository.findByIdAndOwnerIdAndDeletedFalse("team-1", "owner@example.com"))
            .thenReturn(Optional.of(AgentTeam.builder().build()));
        when(llmRepository.findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("owner@example.com"))
            .thenReturn(List.of(accountProvider));

        LlmResolution resolution = gateway.resolveProviderResolution("agent-1", "owner@example.com");

        assertEquals(LlmSource.ACCOUNT, resolution.source());
    }

    @Test
    void reportsAutoTeamSourceForAutoAssignedProvider() {
        Agent agent = Agent.builder().ownerId("owner@example.com").teamId("team-1").build();
        LlmProvider autoTeamProvider = LlmProvider.builder().teamId("team-1").autoAssigned(true).build();
        when(agentRepository.findByIdAndOwnerIdAndDeletedFalse("agent-1", "owner@example.com"))
            .thenReturn(Optional.of(agent));
        when(teamRepository.findByIdAndOwnerIdAndDeletedFalse("team-1", "owner@example.com"))
            .thenReturn(Optional.of(AgentTeam.builder().build()));
        when(llmRepository.findByTeamIdAndAutoAssignedTrueAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("team-1"))
            .thenReturn(List.of(autoTeamProvider));

        LlmResolution resolution = gateway.resolveProviderResolution("agent-1", "owner@example.com");

        assertEquals(LlmSource.TEAM_AUTO, resolution.source());
    }

    /**
     * Le premier tier qui fournit un provider gagne pour ce provider. Sans cela,
     * un même provider présent à la fois au compte et comme défaut plateforme
     * serait étiqueté par le tier le plus générique, ce qui ferait croire à un
     * choix personnel alors que l'utilisateur n'a rien choisi.
     */
    @Test
    void keepsFirstTierWhenSameProviderAppearsAtSeveralTiers() {
        Agent agent = Agent.builder().ownerId("owner@example.com").build();
        LlmProvider platformDefault = LlmProvider.builder()
            .userId("owner@example.com").modelId("gpt-oss-20b")
            .platformDefault(true).active(true).build();
        when(agentRepository.findByIdAndOwnerIdAndDeletedFalse("agent-1", "owner@example.com"))
            .thenReturn(Optional.of(agent));
        when(llmRepository.findByUserIdAndActiveTrueAndDeletedFalseOrderByPrimaryDesc("owner@example.com"))
            .thenReturn(List.of(platformDefault));

        LlmResolution resolution = gateway.resolveProviderResolution("agent-1", "owner@example.com");

        assertSame(platformDefault, resolution.provider());
        assertEquals(LlmSource.ACCOUNT, resolution.source());
    }
}
