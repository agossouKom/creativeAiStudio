package com.creativeai.generation.service;

import com.creativeai.generation.exception.PlatformApiException;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;

@Slf4j
@Service
public class AgentTeamGenerationClient {

    private final RestClient restClient;

    public AgentTeamGenerationClient(
            @Value("${generation.publish.agent-team-base-url}") String baseUrl,
            @Value("${generation.publish.request-timeout-seconds:120}") int timeoutSeconds) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Math.min(timeoutSeconds, 10) * 1000);
        factory.setReadTimeout(timeoutSeconds * 1000);
        this.restClient = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }

    public record StoryboardRequest(String prompt, int durationSeconds, String language, int variations) {}
    public record StoryboardResponse(List<JsonNode> storyboards) {}

    public List<JsonNode> generateStoryboards(
            String agentId, String prompt, int durationSeconds, String language,
            int variations, String callerToken) {
        if (callerToken == null || callerToken.isBlank()) {
            throw new PlatformApiException("AGENT_TEAM_NO_TOKEN",
                "Un jeton utilisateur est nécessaire pour utiliser le provider de l'agent.");
        }
        try {
            StoryboardResponse response = restClient.post()
                .uri("/api/agents/{agentId}/generation/storyboards", agentId)
                .header(HttpHeaders.AUTHORIZATION, callerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .body(new StoryboardRequest(prompt, durationSeconds, language, variations))
                .retrieve()
                .body(StoryboardResponse.class);
            if (response == null || response.storyboards() == null
                    || response.storyboards().size() != variations) {
                throw new PlatformApiException("AGENT_TEAM_INVALID_RESPONSE",
                    "agent-team-service n'a pas renvoyé le nombre attendu de storyboards.");
            }
            return response.storyboards();
        } catch (RestClientResponseException e) {
            throw new PlatformApiException("AGENT_TEAM_HTTP_" + e.getStatusCode().value(),
                "Échec du provider de l'agent (HTTP " + e.getStatusCode().value() + ").");
        } catch (PlatformApiException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Agent storyboard provider request failed: {}", e.getMessage());
            throw new PlatformApiException("AGENT_TEAM_UNAVAILABLE",
                "Impossible de joindre le provider de l'agent.");
        }
    }
}
