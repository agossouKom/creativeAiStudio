package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Instagram n'a pas de publication texte seule.
 *
 * <p>Le conteneur {@code /media} exige {@code image_url}, {@code video_url}
 * (REELS) ou {@code children} (CAROUSEL). Le code envoyait quand même
 * {@code media_type=IMAGE} sans image, et Meta répondait
 * {@code (#100) The parameter image_url is required} — une erreur brute,
 *.Msg illisible pour l'utilisateur, après avoir déjà résolu le canal et
 * déchiffré le jeton. Vu en prod le 2026-10-03 sur le compte
 * « Labibpro Bénin Officiel ».
 */
@ExtendWith(MockitoExtension.class)
class InstagramServicePublishTest {

    private static final String AGENT = "agent-1";

    @Mock private ChannelRepository           channelRepo;
    @Mock private EncryptionService           encryptionService;
    @Mock private SocialPlatformConfigService platformConfig;

    private InstagramService service;

    @BeforeEach
    void setUp() {
        service = new InstagramService(channelRepo, encryptionService, new ObjectMapper(),
            mock(WebClient.Builder.class), platformConfig);

        Agent agent = new Agent();
        agent.setId(AGENT);
        Channel channel = Channel.builder()
            .type(ChannelType.SOCIAL_MEDIA)
            .platformType(PlatformType.INSTAGRAM)
            .status(ChannelStatus.CONNECTED)
            .accountId("17841439090551534")
            .agent(agent)
            .build();
        lenient().when(channelRepo.findAll()).thenReturn(List.of(channel));
        lenient().when(encryptionService.decrypt(any()))
            .thenReturn("{\"accessToken\":\"EAA\",\"igUserId\":\"17841439090551534\"}");
        lenient().when(platformConfig.graphBaseUrl("INSTAGRAM"))
            .thenReturn("https://graph.facebook.com/v24.0");
    }

    @Test
    @DisplayName("un post texte seul est refusé avec un message lisible")
    void texteSeulRefuse() {
        IllegalStateException e = assertThrows(IllegalStateException.class,
            () -> service.publish(AGENT, "légende", List.of()));

        assertTrue(e.getMessage().contains("texte seule"), e.getMessage());
        assertTrue(e.getMessage().contains("mediaUrls"), "le message doit dire quoi fournir : " + e.getMessage());
    }

    @Test
    @DisplayName("le refus ne laisse pas croire à une publication réussie")
    void leRefusEstExplicite() {
        // Le message ne doit pas être une erreur Meta opaque : il doit nommer la
        // contrainte, sinon l'utilisateur cherche un problème de jeton inexistant.
        String message = assertThrows(IllegalStateException.class,
            () -> service.publish(AGENT, "légende", List.of())).getMessage();
        assertTrue(!message.contains("#100"), "le refus doit être prophylactic, pas le retour de Meta : " + message);
    }
}