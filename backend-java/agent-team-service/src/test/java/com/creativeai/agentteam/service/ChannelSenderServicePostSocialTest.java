package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.repository.ChannelRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Une plateforme sans adaptateur d'envoi ne doit jamais produire un succès.
 *
 * <p>{@code postSocial} avait une branche {@code default} qui journalisait un
 * stub puis renvoyait {@code SendResult(true, null)} : l'appelant — l'agent via
 * l'outil {@code post_social}, qui ne passe pas par le filtre de
 * {@code SocialPostController} — annonçait à l'utilisateur « post publié sur
 * LINKEDIN » pour un contenu jamais sorti. L'entrée d'inbox sortante était
 * également créée, rendant le mensonge invisible jusqu'à la lecture du fil.
 */
@ExtendWith(MockitoExtension.class)
class ChannelSenderServicePostSocialTest {

    private static final String USER  = "user-1";
    private static final String AGENT = "agent-1";

    @Mock private ChannelRepository  channelRepo;
    @Mock private InboxService       inboxService;
    @Mock private EncryptionService  encryptionService;
    @Mock private InstagramService   instagramService;

    private ChannelSenderService service;

    @BeforeEach
    void setUp() {
        service = new ChannelSenderService(
            channelRepo, inboxService, encryptionService,
            mock(org.springframework.mail.javamail.JavaMailSender.class),
            mock(org.springframework.web.reactive.function.client.WebClient.Builder.class),
            new com.fasterxml.jackson.databind.ObjectMapper(),
            mock(MinioService.class), mock(MediaSecurityService.class), instagramService,
            mock(SocialPlatformConfigService.class));
    }

    /**
     * Canal CONNECTED valide, pour une plateforme donnée. Stub lenient : le
     * refus de plateforme intervient <em>avant</em> la résolution du canal, donc
     * ces tests l'exercent volontairement sans qu'il soit consommé — c'est
     * justement ce qui prouve qu'aucun credential n'est touché.
     */
    private void givenConnectedChannelFor(PlatformType platform) {
        Channel channel = Channel.builder()
            .type(ChannelType.SOCIAL_MEDIA)
            .platformType(platform)
            .status(ChannelStatus.CONNECTED)
            .accountId("acc-1")
            .build();
        lenient().when(channelRepo.findByAgentIdAndDeletedFalse(AGENT)).thenReturn(List.of(channel));
    }

    // ── Le mensonge ──────────────────────────────────────────────────────────

    /**
     * Chaque plateforme pour laquelle un canal peut exister mais aucun
     * adaptateur d'envoi n'est écrit. Toutes doivent être refusées : c'est
     * exactement la liste que l'outil {@code post_social} annonçait au modèle
     * comme supportée.
     */
    @Test
    void unePlateformeSansAdaptateurEstRefuseeEtNonSimulee() {
        for (PlatformType platform : List.of(PlatformType.LINKEDIN, PlatformType.TWITTER_X,
                                             PlatformType.TIKTOK, PlatformType.YOUTUBE,
                                             PlatformType.PINTEREST, PlatformType.SNAPCHAT,
                                             PlatformType.THREADS)) {
            givenConnectedChannelFor(platform);

            ChannelSenderService.SendResult result =
                service.postSocial(USER, AGENT, platform.name(), "contenu", List.of());

            assertFalse(result.success(), platform + " ne doit pas être rapporté comme publié");
            assertNotNull(result.error());
            assertTrue(result.error().contains("adaptateur"), result.error());
        }
    }

    /**
     * Le refus doit précéder l'archivage : une entrée d'inbox sortante pour une
     * publication inexistante est ce qui rendait le mensonge durable.
     */
    @Test
    void aucuneEntreeInboxNEstCreeePourUnePlateformeRefusee() {
        service.postSocial(USER, AGENT, "LINKEDIN", "contenu", List.of());

        verify(inboxService, never()).createMessage(any(), any());
    }

    /**
     * Le jeton ne doit même pas être déchiffré : inutile d'aller chercher une
     * Page Access Token pour une plateforme dont on sait déjà qu'on ne publiera
     * pas.
     */
    @Test
    void lesCredentialsNeSontPasDechiffreesPourUnePlateformeRefusee() {
        service.postSocial(USER, AGENT, "TIKTOK", "contenu", List.of());

        verify(encryptionService, never()).decrypt(any());
        verify(channelRepo, never()).findAll();
    }

    @Test
    void unePlateformeInconnueEstRefusee() {
        ChannelSenderService.SendResult result =
            service.postSocial(USER, AGENT, "MASTODON", "contenu", List.of());

        assertFalse(result.success());
        assertTrue(result.error().contains("adaptateur"));
    }

    // ── Le refus ne doit rien casser de réel ─────────────────────────────────

    /**
     * Facebook reste publiable. On ne simule pas le serveur Graph, mais on
     * vérifie que le chemin atteint bien l'adaptateur : un échec de
     * déchiffrement doit ressortir comme un échec, jamais comme un succès — et
     * il doit mentionner la cause, pas « aucun adaptateur ».
     */
    @Test
    void facebookAtteintLAdaptateurEtNonLeRefusDePlateforme() {
        givenConnectedChannelFor(PlatformType.FACEBOOK);
        when(encryptionService.decrypt(any())).thenThrow(new RuntimeException("clé absente"));

        ChannelSenderService.SendResult result =
            service.postSocial(USER, AGENT, "FACEBOOK", "contenu", List.of());

        assertFalse(result.success());
        assertTrue(result.error().contains("clé absente"), result.error());
        // Le filtre de plateforme ne doit pas avoir intercepté l'appel.
        assertFalse(result.error().contains("adaptateur"), result.error());
    }

    @Test
    void instagramAtteintLAdaptateurEtPublieReellement() {
        givenConnectedChannelFor(PlatformType.INSTAGRAM);
        when(encryptionService.decrypt(any())).thenReturn("{\"accessToken\":\"EAA\",\"igUserId\":\"1\"}");
        when(instagramService.publish(AGENT, "légende", List.of())).thenReturn("media-1");

        ChannelSenderService.SendResult result =
            service.postSocial(USER, AGENT, "INSTAGRAM", "légende", List.of());

        assertTrue(result.success());
        assertEquals("media-1", result.messageId());
        verify(instagramService).publish(AGENT, "légende", List.of());
    }

    /**
     * Le nom est normalisé (casse, espaces) avant le filtre : « instagram » doit
     * atteindre l'adaptateur, pas être refusé à tort.
     */
    @Test
    void leNomDeLaPlateformeEstNormaliseAvantLeFiltre() {
        givenConnectedChannelFor(PlatformType.INSTAGRAM);
        when(encryptionService.decrypt(any())).thenReturn("{\"accessToken\":\"EAA\",\"igUserId\":\"1\"}");
        when(instagramService.publish(AGENT, "légende", List.of())).thenReturn("media-1");

        assertTrue(service.postSocial(USER, AGENT, "  instagram  ", "légende", List.of()).success());
        assertTrue(service.postSocial(USER, AGENT, "Instagram", "légende", List.of()).success());
    }

    /**
     * Twitter se dit « X » dans l'interface mais TWITTER_X en base. « X » n'est
     * pas un nom d'énumération : il doit être refusé comme les autres plateformes
     * sans adaptateur, jamais publishé.
     */
    @Test
    void twitterXEstRefuseEtNonSimule() {
        givenConnectedChannelFor(PlatformType.TWITTER_X);

        assertFalse(service.postSocial(USER, AGENT, "X", "contenu", List.of()).success());
        assertTrue(service.postSocial(USER, AGENT, "twitter_x", "contenu", List.of()).error()
            .contains("adaptateur"));
    }

    @Test
    void unNomDePlateformeVideEstRefuse() {
        assertFalse(service.postSocial(USER, AGENT, "", "contenu", List.of()).success());
        assertFalse(service.postSocial(USER, AGENT, null, "contenu", List.of()).success());
    }
}
