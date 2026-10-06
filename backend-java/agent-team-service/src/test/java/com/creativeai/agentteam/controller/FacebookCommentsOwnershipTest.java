package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.service.ChannelSenderService;
import com.creativeai.agentteam.service.ChannelService;
import com.creativeai.agentteam.service.FacebookCommentPollerService;
import com.creativeai.agentteam.service.ResourceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Les endpoints Facebook doivent refuser l'agent d'un autre utilisateur.
 *
 * <p>{@code ChannelSenderService} résout le canal par {@code agentId} seul : sans
 * le garde-fou du contrôleur, l'identité de l'appelant n'était jamais
 * consultée. Toute la surface — lecture, édition, suppression, réponse,
 * renouvellement de token — était donc accessible à quiconque authentifié
 * pouvait deviner un identifiant d'agent.
 *
 * <p>Le refus attendu est 404 et non 403 : un agent appartenant à quelqu'un
 * d'autre ne doit pas être distinguable d'un agent inexistant.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FacebookCommentsOwnershipTest {

    private static final String OWNER  = "user-owner";
    private static final String INTRUDER = "user-intruder";
    private static final String AGENT = "agent-1";

    @Mock private ChannelSenderService channelSender;
    @Mock private ChannelService channelService;

    private FacebookCommentsController controller;

    @BeforeEach
    void setUp() {
        controller = new FacebookCommentsController(
            channelSender, channelService, Optional.of(mock(FacebookCommentPollerService.class)));
    }

    /** Configure le refus : l'agent existe mais n'appartient pas à l'appelant. */
    private void givenAgentBelongsToSomeoneElse() {
        when(channelService.requireOwnedAgent(OWNER, AGENT))
            .thenThrow(new ResourceNotFoundException("Agent introuvable : " + AGENT));
    }

    private void givenAgentIsOwned() {
        when(channelService.requireOwnedAgent(OWNER, AGENT))
            .thenReturn(mock(com.creativeai.agentteam.model.Agent.class));
    }

    /** L'agent est au propriétaire et possède un canal Facebook CONNECTED. */
    private void givenAgentIsOwnedWithFacebookChannel() {
        givenAgentIsOwned();
        when(channelService.listChannels(OWNER, AGENT))
            .thenReturn(List.of(new com.creativeai.agentteam.dto.response.ChannelResponse(
                "channel-1", AGENT, com.creativeai.agentteam.model.enums.ChannelType.SOCIAL_MEDIA,
                PlatformType.FACEBOOK, "Page", com.creativeai.agentteam.model.enums.ChannelStatus.CONNECTED,
                "acc-1", "Compte", null, null, null, null, false, null, null, null, null)));
    }

    // ── Lecture ──────────────────────────────────────────────────────────────

    @Test
    void unAgentDAutruiNeRevelePasLesPosts() {
        givenAgentBelongsToSomeoneElse();

        assertThrows(ResourceNotFoundException.class,
            () -> controller.getPosts(OWNER, AGENT, 24, 10));

        // Le point essentiel : le service n'est jamais appelé, donc aucun jeton
        // de Page d'un autre tenant n'est déchiffré.
        verify(channelSender, never()).fetchRecentFacebookPosts(anyString(), anyLong(), anyInt());
    }

    @Test
    void unAgentDAutruiNeRevelePasLesCommentaires() {
        givenAgentBelongsToSomeoneElse();

        assertThrows(ResourceNotFoundException.class,
            () -> controller.getComments(OWNER, AGENT, "page-1_42", 25));

        verify(channelSender, never()).fetchFacebookComments(anyString(), anyString(), anyInt());
    }

    // ── Écriture ─────────────────────────────────────────────────────────────

    @Test
    void unAgentDAutruiNePeutPasSupprimerUnPost() {
        givenAgentBelongsToSomeoneElse();

        assertThrows(ResourceNotFoundException.class,
            () -> controller.deletePost(OWNER, AGENT, "page-1_42"));

        verify(channelSender, never()).deleteFacebookPost(anyString(), anyString());
    }

    @Test
    void unAgentDAutruiNePeutPasModifierUnPost() {
        givenAgentBelongsToSomeoneElse();

        assertThrows(ResourceNotFoundException.class,
            () -> controller.editPost(OWNER, AGENT, "page-1_42", Map.of("message", "défacé")));

        verify(channelSender, never()).editFacebookPost(anyString(), anyString(), anyString());
    }

    @Test
    void unAgentDAutruiNePeutPasCommenter() {
        givenAgentBelongsToSomeoneElse();

        assertThrows(ResourceNotFoundException.class,
            () -> controller.commentOnPost(OWNER, AGENT, "page-1_42", Map.of("message", "inj")));

        verify(channelSender, never()).commentOnFacebookPost(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void unAgentDAutruiNePeutPasRepondreAUnCommentaire() {
        givenAgentBelongsToSomeoneElse();

        assertThrows(ResourceNotFoundException.class,
            () -> controller.reply(OWNER, AGENT, "c-1", Map.of("message", "inj")));

        verify(channelSender, never()).replyToFacebookComment(anyString(), anyString(), anyString(), anyString());
    }

    // ── Le cas le plus grave : réécrire le token de la Page ───────────────────

    @Test
    void unAgentDAutruiNePeutPasReecrireLeTokenDeLaPage() {
        givenAgentBelongsToSomeoneElse();

        assertThrows(ResourceNotFoundException.class, () -> controller.renewToken(OWNER, AGENT, Map.of(
            "appId", "123", "appSecret", "secret", "shortToken", "EAAG...")));

        verify(channelSender, never())
            .renewFacebookToken(anyString(), anyString(), anyString(), anyString());
    }

    // ── Scan manuel ──────────────────────────────────────────────────────────

    @Test
    void unAgentDAutruiNeDeclenchePasDeScan() {
        FacebookCommentPollerService poller = mock(FacebookCommentPollerService.class);
        controller = new FacebookCommentsController(channelSender, channelService, Optional.of(poller));
        givenAgentBelongsToSomeoneElse();

        assertThrows(ResourceNotFoundException.class, () -> controller.triggerScan(OWNER, AGENT));
        assertThrows(ResourceNotFoundException.class, () -> controller.scanPost(OWNER, AGENT, "page-1_42"));

        // Le scan crée des tâches assignées à l'agent : le déclencher pour un
        // agent d'autrui injecterait du travail dans son orchestration.
        verifyNoInteractions(poller);
    }

    // ── Le cas nominal ne doit pas être cassé ────────────────────────────────

    @Test
    void leProprietairePEutLireSesPosts() {
        givenAgentIsOwned();
        when(channelSender.fetchRecentFacebookPosts(eq(AGENT), anyLong(), eq(10)))
            .thenReturn(List.of(Map.of("id", "1")));

        ResponseEntity<Map<String, Object>> response = controller.getPosts(OWNER, AGENT, 24, 10);

        assertEquals(200, response.getStatusCode().value());
        assertEquals(1, response.getBody().get("count"));
    }

    @Test
    void leProprietairePEutSupprimerUnPost() {
        givenAgentIsOwnedWithFacebookChannel();
        when(channelSender.deleteFacebookPost(AGENT, "page-1_42"))
            .thenReturn(new ChannelSenderService.SendResult(true, null, null));

        ResponseEntity<Map<String, Object>> response = controller.deletePost(OWNER, AGENT, "page-1_42");

        assertEquals(200, response.getStatusCode().value());
        assertTrue((Boolean) response.getBody().get("success"));
    }

    @Test
    void leProprietairePEutRepondreAUnCommentaire() {
        givenAgentIsOwnedWithFacebookChannel();
        when(channelSender.replyToFacebookComment(OWNER, AGENT, "c-1", "merci"))
            .thenReturn(new ChannelSenderService.SendResult(true, "reply-1", null));

        ResponseEntity<Map<String, Object>> response =
            controller.reply(OWNER, AGENT, "c-1", Map.of("message", "merci"));

        assertEquals(200, response.getStatusCode().value());
        assertEquals("reply-1", response.getBody().get("replyId"));
    }

    /**
     * Le contrôle d'accès ne doit pas court-circuiter la validation des
     * paramètres : un appelant légitime reçoit toujours son 400 si le message
     * manque, et non un 404 trompeur.
     */
    @Test
    void leProprietaireReçoitUn400EtPasUn404SiLeMessageEstVide() {
        givenAgentIsOwned();

        ResponseEntity<Map<String, Object>> response =
            controller.commentOnPost(OWNER, AGENT, "page-1_42", Map.of("message", "  "));

        assertEquals(400, response.getStatusCode().value());
        verify(channelSender, never()).commentOnFacebookPost(any(), any(), any(), any());
    }

    // ── Aucun canal Facebook CONNECTED → 404, pas de fausse panne ───────────

    @Test
    void repondreSansCanalConnecteRetourneUn404() {
        givenAgentIsOwned();

        ResponseEntity<Map<String, Object>> response =
            controller.reply(OWNER, AGENT, "c-1", Map.of("message", "merci"));

        assertEquals(404, response.getStatusCode().value());
        assertFalse((Boolean) response.getBody().get("success"));
        // Le service ne reçoit aucun appel : pas de déchiffrage d'un jeton absent.
        verify(channelSender, never()).replyToFacebookComment(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void commenterSansCanalConnecteRetourneUn404() {
        givenAgentIsOwned();

        ResponseEntity<Map<String, Object>> response =
            controller.commentOnPost(OWNER, AGENT, "page-1_42", Map.of("message", "hello"));

        assertEquals(404, response.getStatusCode().value());
        verify(channelSender, never()).commentOnFacebookPost(any(), any(), any(), any());
    }

    @Test
    void modifierSansCanalConnecteRetourneUn404() {
        givenAgentIsOwned();

        ResponseEntity<Map<String, Object>> response =
            controller.editPost(OWNER, AGENT, "page-1_42", Map.of("message", "hello"));

        assertEquals(404, response.getStatusCode().value());
        verify(channelSender, never()).editFacebookPost(anyString(), anyString(), anyString());
    }

    @Test
    void supprimerSansCanalConnecteRetourneUn404() {
        givenAgentIsOwned();

        ResponseEntity<Map<String, Object>> response = controller.deletePost(OWNER, AGENT, "page-1_42");

        assertEquals(404, response.getStatusCode().value());
        verify(channelSender, never()).deleteFacebookPost(anyString(), anyString());
    }

    @Test
    void scanSansCanalConnecteRetourneUn404() {
        givenAgentIsOwned();

        ResponseEntity<Map<String, Object>> response = controller.triggerScan(OWNER, AGENT);

        assertEquals(404, response.getStatusCode().value());
    }

    @Test
    void scanPostSansCanalConnecteRetourneUn404() {
        givenAgentIsOwned();

        ResponseEntity<Map<String, Object>> response = controller.scanPost(OWNER, AGENT, "page-1_42");

        assertEquals(404, response.getStatusCode().value());
    }

    @Test
    void scanAvecCanalConnecteDeclencheLePolling() {
        givenAgentIsOwnedWithFacebookChannel();
        FacebookCommentPollerService poller = mock(FacebookCommentPollerService.class);
        controller = new FacebookCommentsController(channelSender, channelService, Optional.of(poller));
        when(poller.triggerNow(AGENT)).thenReturn(2);

        ResponseEntity<Map<String, Object>> response = controller.triggerScan(OWNER, AGENT);

        assertEquals(200, response.getStatusCode().value());
        assertEquals(2, response.getBody().get("channelsScanned"));
    }

    // ── Le refus est un 404, jamais un 403 ───────────────────────────────────

    /**
     * Un 403 confirmerait à l'attaquant que l'agent existe. Le refus doit être
     * indiscernable de celui d'un identifiant inventé.
     */
    @Test
    void leRefusEstUn404EtNonUn403() {
        givenAgentBelongsToSomeoneElse();

        assertThrows(ResourceNotFoundException.class,
            () -> controller.getPosts(OWNER, AGENT, 24, 10));

        // Le code HTTP vient de l'annotation @ResponseStatus sur l'exception,
        // reprise telle quelle par le GlobalExceptionHandler.
        ResponseStatus annotation = ResourceNotFoundException.class.getAnnotation(ResponseStatus.class);
        assertNotNull(annotation);
        assertEquals(HttpStatus.NOT_FOUND, annotation.value());
    }
}
