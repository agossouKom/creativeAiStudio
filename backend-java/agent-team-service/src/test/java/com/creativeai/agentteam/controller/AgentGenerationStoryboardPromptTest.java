package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.GenerationStoryboardRequest;
import com.creativeai.agentteam.llm.LlmGateway;
import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.enums.PromptType;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.service.PromptService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Le system prompt du storyboard doit embarquer la persona de l'agent.
 * Regression : il n'envoyait que le contrat JSON, donc ton, garde-fous et
 * instructions de l'agent etaient ignores a la generation video.
 */
class AgentGenerationStoryboardPromptTest {

    private static final String PERSONA = "Tu es Studio, createur de videos aux ton calme et direct.";
    private static final String VALID_STORYBOARD = """
        {"title":"Test","duration":10,"scenes":[
          {"duration":10,"narration":"Texte","visual_prompt":"aerial city","keywords":["city"]}]}
        """;

    private final AgentRepository agentRepository = mock(AgentRepository.class);
    private final LlmGateway llmGateway = mock(LlmGateway.class);
    private final PromptService promptService = mock(PromptService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    private AgentGenerationController controller() {
        return new AgentGenerationController(agentRepository, llmGateway, objectMapper, promptService);
    }

    private void givenAuthenticatedOwner() {
        Authentication auth = mock(Authentication.class);
        when(auth.getName()).thenReturn("owner-1");
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private void givenOwnedAgent(String agentId) {
        when(agentRepository.findByIdAndOwnerIdAndDeletedFalse(agentId, "owner-1"))
            .thenReturn(Optional.of(Agent.builder().ownerId("owner-1").build()));
    }

    @Test
    @DisplayName("le system prompt contient la persona de l'agent ET le contrat JSON")
    void systemPromptCarriesPersonaAndSchema() throws Exception {
        String agentId = "agent-1";
        givenAuthenticatedOwner();
        givenOwnedAgent(agentId);
        when(promptService.renderPrompt(agentId, PromptType.SYSTEM, java.util.Map.of()))
            .thenReturn(PERSONA);
        when(llmGateway.completeText(anyString(), anyString(), anyString())).thenReturn(VALID_STORYBOARD);

        controller().storyboards("owner-1", agentId,
            new GenerationStoryboardRequest("Une ville au reve", 10, "francais", 1));

        ArgumentCaptor<String> system = ArgumentCaptor.forClass(String.class);
        verify(llmGateway).completeText(anyString(), system.capture(), anyString());

        assertThat(system.getValue())
            .contains(PERSONA)
            .contains("Return only a JSON object matching this schema")
            .contains("\"scenes\"");
    }

    @Test
    @DisplayName("sans prompt SYSTEM, on retombe sur un defaut et le schema reste present")
    void fallsBackWhenNoPersona() throws Exception {
        String agentId = "agent-2";
        givenAuthenticatedOwner();
        givenOwnedAgent(agentId);
        when(promptService.renderPrompt(anyString(), any(), any())).thenReturn(null);
        when(llmGateway.completeText(anyString(), anyString(), anyString())).thenReturn(VALID_STORYBOARD);

        controller().storyboards("owner-1", agentId,
            new GenerationStoryboardRequest("Sujet", 10, "francais", 1));

        ArgumentCaptor<String> system = ArgumentCaptor.forClass(String.class);
        verify(llmGateway).completeText(anyString(), system.capture(), anyString());

        assertThat(system.getValue())
            .contains("professional video storytelling assistant")
            .contains("Return only a JSON object matching this schema");
    }

    @Test
    @DisplayName("si le rendu du prompt leve, la generation ne casse pas")
    void survivesPromptServiceFailure() throws Exception {
        String agentId = "agent-3";
        givenAuthenticatedOwner();
        givenOwnedAgent(agentId);
        when(promptService.renderPrompt(anyString(), any(), any()))
            .thenThrow(new RuntimeException("template cassé"));
        when(llmGateway.completeText(anyString(), anyString(), anyString())).thenReturn(VALID_STORYBOARD);

        var response = controller().storyboards("owner-1", agentId,
            new GenerationStoryboardRequest("Sujet", 10, "francais", 1));

        assertThat(response.getBody().storyboards()).hasSize(1);
    }
}
