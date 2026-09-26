package com.creativeai.generation.service;

import com.creativeai.generation.exception.PlatformApiException;
import com.creativeai.generation.social.SocialPlatform;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;

/**
 * Pont vers agent-team-service, qui détient déjà les credentials Meta chiffrés et
 * les adaptateurs Facebook / Instagram (Graph API). Ce service ne stocke aucun
 * token et n'appelle jamais Meta directement.
 */
@Slf4j
@Service
public class AgentTeamSocialClient {

    private final RestClient restClient;

    public AgentTeamSocialClient(@Value("${generation.publish.agent-team-base-url}") String baseUrl,
                                 @Value("${generation.publish.request-timeout-seconds:120}") int timeoutSeconds) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Math.min(timeoutSeconds, 10) * 1000);
        factory.setReadTimeout(timeoutSeconds * 1000);
        this.restClient = RestClient.builder()
            .baseUrl(baseUrl)
            .requestFactory(factory)
            .build();
    }

    public record AgentPostResult(boolean success, String messageId, String error) {}

    public record AgentPostBody(String platform, String content, List<String> mediaUrls) {}

    /**
     * @param callerToken jeton Bearer de l'utilisateur appelant, relayé vers
     *                    agent-team-service. C'est ce jeton qui permet au
     *                    destinataire de vérifier que l'agent et ses canaux
     *                    appartiennent bien à l'appelant : sans lui, la
     *                    publication est refusée plutôt que d'être acceptée.
     */
    public AgentPostResult publish(String agentId, SocialPlatform platform, String content,
                                   List<String> mediaUrls, String callerToken) {
        if (callerToken == null || callerToken.isBlank()) {
            throw new PlatformApiException("AGENT_TEAM_NO_TOKEN",
                "Jeton de l'appelant absent : la publication doit être initiée depuis un utilisateur authentifié");
        }
        AgentPostResult result;
        try {
            result = restClient.post()
                .uri("/api/agents/{agentId}/posts", agentId)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + callerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .body(new AgentPostBody(platform.name(), content, mediaUrls))
                .retrieve()
                .body(AgentPostResult.class);
        } catch (RestClientResponseException e) {
            throw new PlatformApiException("AGENT_TEAM_HTTP_" + e.getStatusCode().value(),
                "agent-team-service a répondu " + e.getStatusCode().value() + ": " + e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new PlatformApiException("AGENT_TEAM_UNAVAILABLE",
                "agent-team-service est injoignable: " + e.getMessage());
        }
        if (result == null) {
            throw new PlatformApiException("AGENT_TEAM_EMPTY_RESPONSE",
                "agent-team-service n'a renvoyé aucune réponse");
        }
        return result;
    }
}
