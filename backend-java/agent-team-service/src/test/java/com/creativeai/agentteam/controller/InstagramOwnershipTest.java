package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.service.ChannelService;
import com.creativeai.agentteam.service.InstagramCommentPollerService;
import com.creativeai.agentteam.service.InstagramService;
import com.creativeai.agentteam.service.ResourceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Même règle que {@code FacebookCommentsOwnershipTest}, côté Instagram.
 *
 * <p>{@code InstagramService.findChannel(agentId)} résout le canal sans
 * l'identité de l'appelant : sans garde-fou au contrôleur, la publication, la
 * suppression et les commentaires d'un compte Instagram rattaché à un autre
 * agent étaient ouverts à tout utilisateur authentifié.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class InstagramOwnershipTest {

    private static final String OWNER = "user-owner";
    private static final String AGENT = "agent-1";

    @Mock private InstagramService instagramService;
    @Mock private ChannelService channelService;

    private InstagramController controller;

    @BeforeEach
    void setUp() {
        controller = new InstagramController(
            instagramService, channelService, Optional.of(mock(InstagramCommentPollerService.class)));
    }

    private void givenAgentBelongsToSomeoneElse() {
        when(channelService.requireOwnedAgent(OWNER, AGENT))
            .thenThrow(new ResourceNotFoundException("Agent introuvable : " + AGENT));
    }

    private void givenAgentIsOwned() {
        when(channelService.requireOwnedAgent(OWNER, AGENT)).thenReturn(mock(Agent.class));
    }

    // ── Lecture ──────────────────────────────────────────────────────────────

    @Test
    void unAgentDAutruiNeRevelePasLesMedias() {
        givenAgentBelongsToSomeoneElse();

        assertThrows(ResourceNotFoundException.class,
            () -> controller.getMedia(OWNER, AGENT, 10));

        verify(instagramService, never()).fetchRecentMedia(anyString(), anyInt());
    }

    @Test
    void unAgentDAutruiNeRevelePasLesCommentaires() {
        givenAgentBelongsToSomeoneElse();

        assertThrows(ResourceNotFoundException.class,
            () -> controller.getComments(OWNER, AGENT, "media-1", 25));

        verify(instagramService, never()).fetchComments(anyString(), anyString(), anyInt());
    }

    // ── Écriture ─────────────────────────────────────────────────────────────

    @Test
    void unAgentDAutruiNePeutPasPublier() {
        givenAgentBelongsToSomeoneElse();

        assertThrows(ResourceNotFoundException.class, () -> controller.publish(
            OWNER, AGENT, Map.of("caption", "défaut", "mediaUrls", List.of("minio://a.png"))));

        verify(instagramService, never()).publish(anyString(), anyString(), any());
    }

    @Test
    void unAgentDAutruiNePeutPasSupprimerUnMedia() {
        givenAgentBelongsToSomeoneElse();

        assertThrows(ResourceNotFoundException.class,
            () -> controller.deleteMedia(OWNER, AGENT, "media-1"));

        verify(instagramService, never()).deleteMedia(anyString(), anyString());
    }

    @Test
    void unAgentDAutruiNePeutPasCommenter() {
        givenAgentBelongsToSomeoneElse();

        assertThrows(ResourceNotFoundException.class, () -> controller.commentOnMedia(
            OWNER, AGENT, "media-1", Map.of("message", "inj")));

        verify(instagramService, never()).commentOnMedia(anyString(), anyString(), anyString());
    }

    @Test
    void unAgentDAutruiNePeutPasRepondre() {
        givenAgentBelongsToSomeoneElse();

        assertThrows(ResourceNotFoundException.class, () -> controller.reply(
            OWNER, AGENT, "c-1", Map.of("message", "inj")));

        verify(instagramService, never()).replyToComment(anyString(), anyString(), anyString());
    }

    // ── Scan ─────────────────────────────────────────────────────────────────

    @Test
    void unAgentDAutruiNeDeclenchePasDeScan() {
        InstagramCommentPollerService poller = mock(InstagramCommentPollerService.class);
        controller = new InstagramController(instagramService, channelService, Optional.of(poller));
        givenAgentBelongsToSomeoneElse();

        assertThrows(ResourceNotFoundException.class, () -> controller.triggerScan(OWNER, AGENT));
        assertThrows(ResourceNotFoundException.class, () -> controller.scanMedia(OWNER, AGENT, "media-1"));

        verifyNoInteractions(poller);
    }

    // ── Nominal ──────────────────────────────────────────────────────────────

    @Test
    void leProprietairePEutLireSesMedias() {
        givenAgentIsOwned();
        when(instagramService.fetchRecentMedia(AGENT, 10)).thenReturn(List.of(Map.of("id", "m1")));

        ResponseEntity<Map<String, Object>> response = controller.getMedia(OWNER, AGENT, 10);

        assertEquals(200, response.getStatusCode().value());
        assertEquals(1, response.getBody().get("count"));
    }

    @Test
    void leProprietairePEutPublier() {
        givenAgentIsOwned();
        when(instagramService.publish(AGENT, "légende", List.of("minio://a.png"))).thenReturn("media-1");

        ResponseEntity<Map<String, Object>> response = controller.publish(
            OWNER, AGENT, Map.of("caption", "légende", "mediaUrls", List.of("minio://a.png")));

        assertEquals(200, response.getStatusCode().value());
        assertEquals("media-1", response.getBody().get("mediaId"));
    }

    /**
     * Répondre «.message vide » reste un 400 pour l'appelant légitime : le
     * contrôle de propriété ne doit pas masquer une erreur de validation.
     */
    @Test
    void leProprietaireReçoitUn400SiLeMessageEstVide() {
        givenAgentIsOwned();

        ResponseEntity<Map<String, Object>> response =
            controller.reply(OWNER, AGENT, "c-1", Map.of("message", ""));

        assertEquals(400, response.getStatusCode().value());
    }
}
