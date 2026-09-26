package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.response.ChannelResponse;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.service.ChannelSenderService;
import com.creativeai.agentteam.service.ChannelService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SocialPostControllerTest {

    private static final String USER = "user-1";
    private static final String AGENT = "agent-1";

    @Mock private ChannelSenderService channelSenderService;
    @Mock private ChannelService channelService;

    private SocialPostController controller;

    @BeforeEach
    void setUp() {
        controller = new SocialPostController(channelSenderService, channelService);
    }

    private ChannelResponse channel(PlatformType platform, ChannelStatus status) {
        return new ChannelResponse("channel-1", AGENT, ChannelType.SOCIAL_MEDIA, platform,
            "Page", status, "acc-1", "Compte", null, null, null, null, false, null, null,
            null, null);
    }

    @Test
    void platformWithoutAdapterIsRefused() {
        ResponseEntity<ChannelSenderService.SendResult> response = controller.publish(
            AGENT, USER, new SocialPostController.SocialPostRequest("TIKTOK", "hello", List.of()));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertFalse(response.getBody().success());
        assertTrue(response.getBody().error().contains("non prise en charge"));
        verify(channelSenderService, never()).postSocial(anyString(), anyString(), anyString(),
            anyString(), anyList());
    }

    @Test
    void unknownPlatformIsRefused() {
        ResponseEntity<ChannelSenderService.SendResult> response = controller.publish(
            AGENT, USER, new SocialPostController.SocialPostRequest("MASTODON", "hello", List.of()));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(channelSenderService, never()).postSocial(anyString(), anyString(), anyString(),
            anyString(), anyList());
    }

    @Test
    void agentWithoutConnectedChannelIsRefused() {
        when(channelService.listChannels(USER, AGENT))
            .thenReturn(List.of(channel(PlatformType.FACEBOOK, ChannelStatus.DISCONNECTED)));

        ResponseEntity<ChannelSenderService.SendResult> response = controller.publish(
            AGENT, USER, new SocialPostController.SocialPostRequest("FACEBOOK", "hello", List.of()));

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertFalse(response.getBody().success());
        assertTrue(response.getBody().error().contains("CONNECTED"));
        verify(channelSenderService, never()).postSocial(anyString(), anyString(), anyString(),
            anyString(), anyList());
    }

    @Test
    void connectedChannelOfAnotherPlatformIsNotEnough() {
        when(channelService.listChannels(USER, AGENT))
            .thenReturn(List.of(channel(PlatformType.FACEBOOK, ChannelStatus.CONNECTED)));

        ResponseEntity<ChannelSenderService.SendResult> response = controller.publish(
            AGENT, USER, new SocialPostController.SocialPostRequest("INSTAGRAM", "hello", List.of()));

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        verify(channelSenderService, never()).postSocial(anyString(), anyString(), anyString(),
            anyString(), anyList());
    }

    @Test
    void emptyContentAndMediaIsRefused() {
        ResponseEntity<ChannelSenderService.SendResult> response = controller.publish(
            AGENT, USER, new SocialPostController.SocialPostRequest("FACEBOOK", "  ", List.of()));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody().error().contains("contenu texte"));
    }

    @Test
    void connectedChannelDelegatesToChannelSenderService() {
        when(channelService.listChannels(USER, AGENT))
            .thenReturn(List.of(channel(PlatformType.INSTAGRAM, ChannelStatus.CONNECTED)));
        when(channelSenderService.postSocial(eq(USER), eq(AGENT), eq("INSTAGRAM"), eq("ma légende"),
            anyList())).thenReturn(new ChannelSenderService.SendResult(true, "media-1", null));

        ResponseEntity<ChannelSenderService.SendResult> response = controller.publish(
            AGENT, USER,
            new SocialPostController.SocialPostRequest("instagram", "ma légende", List.of("minio://a.png")));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().success());
        assertEquals("media-1", response.getBody().messageId());
        verify(channelSenderService).postSocial(USER, AGENT, "INSTAGRAM", "ma légende",
            List.of("minio://a.png"));
    }
}
