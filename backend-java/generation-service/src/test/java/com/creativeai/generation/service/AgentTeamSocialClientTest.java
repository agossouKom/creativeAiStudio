package com.creativeai.generation.service;

import com.creativeai.generation.exception.PlatformApiException;
import com.creativeai.generation.social.SocialPlatform;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AgentTeamSocialClientTest {

    private final AgentTeamSocialClient client =
        new AgentTeamSocialClient("http://localhost:1", 1, "");

    /** Client\subsidiaire disposant d'un secret : sert aux cas qui doivent réellement appeler. */
    private final AgentTeamSocialClient clientWithToken =
        new AgentTeamSocialClient("http://localhost:1", 1, "service-secret");

    @Test
    void missingCallerTokenIsRefusedWithoutCallingAgentTeam() {
        PlatformApiException ex = assertThrows(PlatformApiException.class,
            () -> client.publish("agent-1", SocialPlatform.FACEBOOK, "hello",
                List.of("minio://a.png"), null));

        assertEquals("AGENT_TEAM_NO_TOKEN", ex.getCode());
    }

    @Test
    void blankCallerTokenIsRefused() {
        PlatformApiException ex = assertThrows(PlatformApiException.class,
            () -> client.publish("agent-1", SocialPlatform.INSTAGRAM, "hello",
                List.of("minio://a.png"), "   "));

        assertEquals("AGENT_TEAM_NO_TOKEN", ex.getCode());
    }

    /**
     * Sans secret configuré, le planificateur doit échouer franchement avant tout
     * appel : une requête partie sans authentification serait refusée en 401 par
     * agent-team, et l'utilisateur verrait une erreur opaque.
     */
    @Test
    void unpublishedScheduleFailsClosedWhenServiceSecretIsMissing() {
        PlatformApiException ex = assertThrows(PlatformApiException.class,
            () -> client.publishInternal("agent-1", SocialPlatform.FACEBOOK, "hello",
                List.of("minio://a.png"), "user@example.com"));

        assertEquals("INTERNAL_TOKEN_UNSET", ex.getCode());
    }

    /**
     * Sans email, agent-team ne peut pas prouver que l'agent appartient au
     * propriétaire : mieux vaut refuser que d'envoyer une requête qui sera
     * rejetée.
     */
    @Test
    void internalPublishWithoutOwnerEmailIsRefused() {
        PlatformApiException ex = assertThrows(PlatformApiException.class,
            () -> clientWithToken.publishInternal("agent-1", SocialPlatform.FACEBOOK, "hello",
                List.of("minio://a.png"), "  "));

        assertEquals("INTERNAL_NO_USER", ex.getCode());
    }

    @Test
    void unreachableAgentTeamIsReportedAsPlatformError() {
        PlatformApiException ex = assertThrows(PlatformApiException.class,
            () -> client.publish("agent-1", SocialPlatform.FACEBOOK, "hello",
                List.of("minio://a.png"), "a.token"));

        assertEquals("AGENT_TEAM_UNAVAILABLE", ex.getCode());
        assertTrue(ex.getMessage().contains("injoignable"));
    }
}
