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
    private final String internalServiceToken;

    public AgentTeamSocialClient(@Value("${generation.publish.agent-team-base-url}") String baseUrl,
                                 @Value("${generation.publish.request-timeout-seconds:120}") int timeoutSeconds,
                                 @Value("${generation.publish.internal-service-token:}") String internalServiceToken) {
        this.internalServiceToken = internalServiceToken;
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

    /** Ajoute l'email du propriétaire : le destinataire doit pouvoir vérifier la propriété. */
    public record InternalAgentPostBody(String userEmail, String platform, String content, List<String> mediaUrls) {}

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
        return call("/api/agents/{agentId}/posts", agentId,
            new AgentPostBody(platform.name(), content, mediaUrls),
            HttpHeaders.AUTHORIZATION, "Bearer " + callerToken);
    }

    /**
     * Publication déclenchée par le planificateur, sans jeton d'utilisateur.
     *
     * <p>Le jeton de session n'existe plus à l'heure de diffusion, et le stocker
     * serait pire : il expire entre-temps et il faudrait le rafraîchir en son
     * nom. Le secret de service remplace donc l'authentification, et la
     * propriété de l'agent est prouvée côté agent-team par l'email transmis ici.
     *
     * <p>Ce chemin est volontairement aussi étroit que {@link #publish} : mêmes
     * contrôles de plateforme, de média et de compte connecté, appliqués plus
     * loin dans {@code SocialPublishService}. Programmer n'est pas un droit
     * plus large que publier.
     */
    public AgentPostResult publishInternal(String agentId, SocialPlatform platform, String content,
                                           List<String> mediaUrls, String userEmail) {
        if (internalServiceToken == null || internalServiceToken.isBlank()) {
            // Fail-closed : sans secret configuré, on refuse d'envoyer plutôt que
            // de tenter un appel qui sera rejeté en 401 par agent-team.
            throw new PlatformApiException("INTERNAL_TOKEN_UNSET",
                "Secret de service non configuré (generation.publish.internal-service-token) : "
                    + "la publication programmée ne peut pas être exécutée");
        }
        if (userEmail == null || userEmail.isBlank()) {
            throw new PlatformApiException("INTERNAL_NO_USER",
                "Email du propriétaire absent : agent-team ne peut pas vérifier l'appartenance de l'agent");
        }
        return call("/internal/agents/{agentId}/posts", agentId,
            new InternalAgentPostBody(userEmail, platform.name(), content, mediaUrls),
            "X-Internal-Token", internalServiceToken);
    }

    private AgentPostResult call(String uriTemplate, String agentId, Object body,
                                 String headerName, String headerValue) {
        AgentPostResult result;
        try {
            result = restClient.post()
                .uri(uriTemplate, agentId)
                .header(headerName, headerValue)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
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
