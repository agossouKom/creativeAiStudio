package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.dto.response.ChannelResponse;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.service.ChannelSenderService;
import com.creativeai.agentteam.service.ChannelService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Sécurité du point d'entrée interne.
 *
 * <p>Ce contrôleur est le seul endroit où une publication peut démarrer sans
 * jeton d'utilisateur. Les tests portent donc sur ce qui doit être refusé :
 * c'est un point d'entrée sans session, et une erreur ici se traduit par une
 * publication sur le compte d'un tiers.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class InternalSocialPostControllerTest {

    private static final String SECRET = "service-secret";
    private static final String OWNER = "owner@example.com";
    private static final String OTHER = "victim@example.com";

    @Mock private ChannelSenderService channelSenderService;
    @Mock private AgentRepository agentRepository;
    @Mock private ChannelService channelService;

    private SocialPostController socialPostController;
    private InternalSocialPostController controller;

    @BeforeEach
    void setUp() {
        socialPostController = new SocialPostController(channelSenderService, channelService);
        controller = new InternalSocialPostController(
            channelSenderService, agentRepository, socialPostController);
        ReflectionTestUtils.setField(controller, "serviceToken", SECRET);
    }

    private void givenAgent(String agentId, String ownerId) {
        Agent agent = mock(Agent.class);
        when(agent.getOwnerId()).thenReturn(ownerId);
        when(agentRepository.findByIdAndDeletedFalse(agentId)).thenReturn(Optional.of(agent));
    }

    private InternalSocialPostController.InternalPostRequest request(String userEmail) {
        return new InternalSocialPostController.InternalPostRequest(
            userEmail, "FACEBOOK", "Bonjour", List.of("minio://a.png"));
    }

    @Test
    void refusesWhenServiceSecretIsMissing() {
        givenAgent("agent-1", OWNER);

        ResponseEntity<ChannelSenderService.SendResult> response = controller.publishScheduled(
            "agent-1", null, request(OWNER));

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verify(channelSenderService, never()).postSocial(any(), any(), any(), any(), any());
    }

    @Test
    void refusesWhenServiceSecretIsWrong() {
        givenAgent("agent-1", OWNER);

        ResponseEntity<ChannelSenderService.SendResult> response = controller.publishScheduled(
            "agent-1", "mauvais-secret", request(OWNER));

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verify(channelSenderService, never()).postSocial(any(), any(), any(), any(), any());
    }

    /**
     * C'est le contrôle qui compte. Le secret prouve qu'on est generation-service,
     * pas que l'agent appartient à l'utilisateur annoncé : un planificateur
     * détourné ne doit pas pouvoir publier sur le compte de quelqu'un d'autre.
     */
    @Test
    void refusesWhenAgentBelongsToSomebodyElse() {
        givenAgent("agent-1", OTHER);

        ResponseEntity<ChannelSenderService.SendResult> response = controller.publishScheduled(
            "agent-1", SECRET, request(OWNER));

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(channelSenderService, never()).postSocial(any(), any(), any(), any(), any());
    }

    @Test
    void refusesUnknownAgent() {
        when(agentRepository.findByIdAndDeletedFalse("inconnu")).thenReturn(Optional.empty());

        ResponseEntity<ChannelSenderService.SendResult> response = controller.publishScheduled(
            "inconnu", SECRET, request(OWNER));

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    /** La casse de l'email ne doit pas faire échouer la propriété. */
    @Test
    void acceptsOwnerEmailRegardlessOfCase() {
        givenAgent("agent-1", OWNER);
        // Construit hors du when() : Mockito n'accepte pas de stubbing imbriqué.
        ChannelResponse channel = connectedChannel();
        when(channelService.listChannels(eq(OWNER), eq("agent-1")))
            .thenReturn(List.of(channel));
        when(channelSenderService.postSocial(any(), any(), any(), any(), anyList()))
            .thenReturn(new ChannelSenderService.SendResult(true, "post-1", null));

        ResponseEntity<ChannelSenderService.SendResult> response = controller.publishScheduled(
            "agent-1", SECRET, request(OWNER.toUpperCase()));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().success());
    }

    /**
     * Le canal interne ne doit pas devenir un raccourci : si le compte n'est pas
     * connecté, la publication programmée échoue comme une publication manuelle.
     */
    @Test
    void refusesWhenNoConnectedChannel() {
        givenAgent("agent-1", OWNER);
        when(channelService.listChannels(anyString(), anyString())).thenReturn(List.of());

        ResponseEntity<ChannelSenderService.SendResult> response = controller.publishScheduled(
            "agent-1", SECRET, request(OWNER));

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
    }

    @Test
    void refusesPlatformWithoutAdapter() {
        givenAgent("agent-1", OWNER);
        ChannelResponse channel = connectedChannel();
        when(channelService.listChannels(anyString(), anyString()))
            .thenReturn(List.of(channel));

        ResponseEntity<ChannelSenderService.SendResult> response = controller.publishScheduled(
            "agent-1", SECRET,
            new InternalSocialPostController.InternalPostRequest(
                OWNER, "YOUTUBE", "Bonjour", List.of("minio://a.png")));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    /** Un secret vide ne doit jamais valider un appel. */
    @Test
    void refusesWhenConfiguredSecretIsBlank() {
        ReflectionTestUtils.setField(controller, "serviceToken", "   ");
        givenAgent("agent-1", OWNER);

        ResponseEntity<ChannelSenderService.SendResult> response = controller.publishScheduled(
            "agent-1", "", request(OWNER));

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    private static ChannelResponse connectedChannel() {
        ChannelResponse channel = mock(ChannelResponse.class);
        when(channel.platformType()).thenReturn(PlatformType.FACEBOOK);
        when(channel.status()).thenReturn(ChannelStatus.CONNECTED);
        return channel;
    }

    @Test
    void doesNotLeakWhetherAgentExistsWhenSecretIsWrong() {
        // Ni 404 ni 403 avant authentification : la réponse ne doit pas
        // devenir un oracle permettant d'énumérer les agents.
        givenAgent("agent-1", OTHER);
        ResponseEntity<ChannelSenderService.SendResult> response = controller.publishScheduled(
            "agent-1", "mauvais-secret", request(OWNER));

        assertFalse(response.getStatusCode().is2xxSuccessful());
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }
}
