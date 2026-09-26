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
        new AgentTeamSocialClient("http://localhost:1", 1);

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

    @Test
    void unreachableAgentTeamIsReportedAsPlatformError() {
        PlatformApiException ex = assertThrows(PlatformApiException.class,
            () -> client.publish("agent-1", SocialPlatform.FACEBOOK, "hello",
                List.of("minio://a.png"), "a.token"));

        assertEquals("AGENT_TEAM_UNAVAILABLE", ex.getCode());
        assertTrue(ex.getMessage().contains("injoignable"));
    }
}
