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
import static org.junit.jupiter.api.Assertions.assertSame;
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
        when(llmRepository.findByAgentIdAndDeletedFalseOrderByPrimaryDesc("agent-1"))
            .thenReturn(List.of());
        when(llmRepository.findByUserIdAndDeletedFalseOrderByPrimaryDesc("owner@example.com"))
            .thenReturn(List.of());
    }

    @Test
    void resolvesTeamProvidersBeforeAccountProviders() {
        Agent agent = Agent.builder().ownerId("owner@example.com").teamId("team-1").build();
        LlmProvider teamProvider = LlmProvider.builder().teamId("team-1").build();
        LlmProvider accountProvider = LlmProvider.builder().userId("owner@example.com").build();
        when(agentRepository.findByIdAndOwnerIdAndDeletedFalse("agent-1", "owner@example.com"))
            .thenReturn(Optional.of(agent));
        when(teamRepository.findByIdAndOwnerIdAndDeletedFalse("team-1", "owner@example.com"))
            .thenReturn(Optional.of(AgentTeam.builder().build()));
        when(llmRepository.findByTeamIdAndDeletedFalseOrderByPrimaryDesc("team-1"))
            .thenReturn(List.of(teamProvider));
        when(llmRepository.findByUserIdAndDeletedFalseOrderByPrimaryDesc("owner@example.com"))
            .thenReturn(List.of(accountProvider));

        List<LlmProvider> candidates =
            gateway.resolveProviderCandidates("agent-1", "owner@example.com");

        assertEquals(2, candidates.size());
        assertSame(teamProvider, candidates.get(0));
        assertSame(accountProvider, candidates.get(1));
        verify(llmRepository).findByTeamIdAndDeletedFalseOrderByPrimaryDesc("team-1");
    }

    @Test
    void doesNotResolveAnotherOwnersTeamProvider() {
        when(llmRepository.findByUserIdAndDeletedFalseOrderByPrimaryDesc("owner@example.com"))
            .thenReturn(List.of(LlmProvider.builder().userId("owner@example.com").build()));
        when(agentRepository.findByIdAndOwnerIdAndDeletedFalse("agent-1", "owner@example.com"))
            .thenReturn(Optional.empty());

        gateway.resolveProviderCandidates("agent-1", "owner@example.com");

        verifyNoInteractions(teamRepository);
        verify(llmRepository).findByUserIdAndDeletedFalseOrderByPrimaryDesc("owner@example.com");
    }
}
