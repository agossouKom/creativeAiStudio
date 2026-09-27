package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.creativeai.agentteam.service.ChannelService;
import com.creativeai.agentteam.service.EncryptionService;
import com.creativeai.agentteam.service.OAuthStateStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Sécurité du wizard OAuth.
 *
 * Régression sur le flaw tiré par l'audit : `/authorize` était en `permitAll` et
 * retombait sur `agentRepo.findById(agentId).getOwnerId()` — n'importe quel
 * appelant pouvait donc déclencher un flow OAuth au nom du propriétaire d'un agent
 * et récupérer ses tokens. Ici : refus sans JWT, refus sur un agent qui n'est pas
 * à l'appelant, et callback ancré sur un `state` à usage unique.
 */
@ExtendWith(MockitoExtension.class)
class OAuthSocialControllerSecurityTest {

    private static final String USER = "user-1";
    private static final String AGENT = "agent-1";
    private static final String CHANNEL = "channel-1";

    @Mock private ChannelService channelService;
    @Mock private ChannelRepository channelRepo;
    @Mock private AgentRepository agentRepo;
    @Mock private EncryptionService encryptionService;

    private OAuthStateStore stateStore;
    private OAuthSocialController controller;

    @BeforeEach
    void setUp() {
        stateStore = new OAuthStateStore(600, 1000);
        controller = new OAuthSocialController(channelService, channelRepo, agentRepo,
            encryptionService, stateStore, new ObjectMapper());
        ReflectionTestUtils.setField(controller, "publicUrl", "https://app.test");
        ReflectionTestUtils.setField(controller, "frontendUrl", "https://app.test");
        ReflectionTestUtils.setField(controller, "fbAppId", "fb-id");
        ReflectionTestUtils.setField(controller, "fbAppSecret", "fb-secret");
        ReflectionTestUtils.setField(controller, "twitterClientId", "tw-id");
        ReflectionTestUtils.setField(controller, "twitterClientSecret", "tw-secret");
    }

    /** Ce que produit JwtAuthFilter après un JWT valide. */
    private static Authentication authOf(String userId) {
        return new UsernamePasswordAuthenticationToken(userId, null,
            List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    /** Ce que produit le filtre d'anonymat de Spring quand aucun JWT n'est présent. */
    private static Authentication anonymous() {
        return new AnonymousAuthenticationToken("key", "anonymousUser",
            List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));
    }

    private void givenAgentOwnedBy(String ownerId) {
        when(agentRepo.findByIdAndOwnerIdAndDeletedFalse(AGENT, ownerId))
            .thenReturn(Optional.of(mock(Agent.class)));
    }

    @Test
    void authorizeSansAuthentificationRenvoie401EtNEmetPasDEtat() {
        ResponseEntity<Map<String, Object>> response =
            controller.getAuthUrl(null, "facebook", AGENT, null);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertEquals(0, stateStore.activeCount(), "un state a été émis pour un appelant anonyme");
        verify(agentRepo, never()).findById(anyString());
    }

    /**
     * Régression du {@code AnonymousAuthenticationFilter} : son principal est la
     * chaîne {@code "anonymousUser"}, non nulle et non vide. Un contrôle
     * {@code userId == null} l'aurait laissé passer comme s'il s'agissait d'un
     * utilisateur authentifié.
     */
    @Test
    void authorizeAvecPrincipalAnonymeRenvoie401() {
        ResponseEntity<Map<String, Object>> response =
            controller.getAuthUrl(anonymous(), "facebook", AGENT, null);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertEquals(0, stateStore.activeCount(), "un state a été émis pour 'anonymousUser'");
        verify(agentRepo, never()).findById(anyString());
    }

    @Test
    void statusAvecPrincipalAnonymeRenvoie401() {
        ResponseEntity<?> response = controller.platformStatus(anonymous(), AGENT);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verify(channelRepo, never()).findByAgentIdAndDeletedFalse(anyString());
    }

    @Test
    void authorizeAvecAgentAppartenantAUnAutreUtilisateurRenvoie403() {
        // L'agent existe, mais il appartient à quelqu'un d'autre : la requête porte
        // (AGENT, USER) et ne trouve rien.
        when(agentRepo.findByIdAndOwnerIdAndDeletedFalse(AGENT, USER)).thenReturn(Optional.empty());

        ResponseEntity<Map<String, Object>> response =
            controller.getAuthUrl(authOf(USER), "facebook", AGENT, null);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertEquals(0, stateStore.activeCount(), "un state a été émis pour un agent volé");
    }

    @Test
    void authorizeLieLEtatALUtilisateurAuthentifie() {
        givenAgentOwnedBy(USER);

        ResponseEntity<Map<String, Object>> response =
            controller.getAuthUrl(authOf(USER), "facebook", AGENT, null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        String state = (String) response.getBody().get("state");
        assertNotNull(state);

        OAuthStateStore.Entry entry = stateStore.consume(state).orElseThrow();
        assertEquals(USER, entry.userId(), "l'état n'est pas ancré sur l'utilisateur authentifié");
        assertEquals(AGENT, entry.agentId());
        assertEquals("FACEBOOK", entry.platform());
    }

    @Test
    void authorizeAvecCanalDUnAutreAgentRenvoie403() {
        givenAgentOwnedBy(USER);
        when(channelRepo.findByIdAndAgentIdAndDeletedFalse(CHANNEL, AGENT)).thenReturn(Optional.empty());

        ResponseEntity<Map<String, Object>> response =
            controller.getAuthUrl(authOf(USER), "facebook", AGENT, CHANNEL);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertEquals(0, stateStore.activeCount());
    }

    @Test
    void authorizeAvecPlateformeInconnueRenvoie400() {
        ResponseEntity<Map<String, Object>> response =
            controller.getAuthUrl(authOf(USER), "myspace", AGENT, null);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals(0, stateStore.activeCount());
    }

    @Test
    void challengePkceTwitterEstS256EtNonLeState() {
        givenAgentOwnedBy(USER);

        ResponseEntity<Map<String, Object>> response =
            controller.getAuthUrl(authOf(USER), "twitter_x", AGENT, null);

        String state = (String) response.getBody().get("state");
        String authUrl = (String) response.getBody().get("authUrl");
        assertTrue(authUrl.contains("code_challenge_method=S256"), authUrl);
        assertTrue(!authUrl.contains("code_challenge_method=plain"), "PKCE en plain régressé : " + authUrl);
        assertTrue(!authUrl.contains("code_challenge=" + state), "le state sert encore de code_challenge");
    }

    @Test
    void callbackAvecStateInconnuNeCreeAucunCanal() {
        ResponseEntity<Void> response =
            controller.facebookCallback("code-oauth", "state-fabrique", null);

        assertEquals(HttpStatus.FOUND, response.getStatusCode());
        assertTrue(response.getHeaders().getLocation().toString().contains("oauth_error=invalid_state"));
        verify(channelService, never()).createChannel(any(), any(), any());
        verify(channelService, never()).connect(any(), any(), any());
    }

    @Test
    void callbackAvecStateRejoueEstRefuse() {
        givenAgentOwnedBy(USER);
        String state = (String) controller.getAuthUrl(authOf(USER), "facebook", AGENT, null)
            .getBody().get("state");
        // Le state est consommé (usage unique) ; un rejeu doit échouer.
        stateStore.consume(state);

        ResponseEntity<Void> response = controller.facebookCallback("code-oauth", state, null);

        assertTrue(response.getHeaders().getLocation().toString().contains("oauth_error=invalid_state"));
        verify(channelService, never()).createChannel(any(), any(), any());
    }

    @Test
    void callbackAvecStateEmisPourUneAutrePlateformeEstRefuse() {
        givenAgentOwnedBy(USER);
        // Un state Facebook présenté sur le callback Twitter : sinon les tokens
        // récupérés d'une plateforme seraient acceptés pour une autre.
        String state = (String) controller.getAuthUrl(authOf(USER), "facebook", AGENT, null)
            .getBody().get("state");

        ResponseEntity<Void> response = controller.twitterCallback("code-oauth", state, null);

        assertTrue(response.getHeaders().getLocation().toString().contains("oauth_error=invalid_state"));
        verify(channelService, never()).createChannel(any(), any(), any());
    }

    @Test
    void callbackSansCodeEtSansStateNeProvoquePasDErreurServeur() {
        // Régression NPE : `oauthStateStore.remove(null)` sur une ConcurrentHashMap.
        ResponseEntity<Void> noState = controller.facebookCallback(null, null, null);
        assertEquals(HttpStatus.FOUND, noState.getStatusCode());
        assertTrue(noState.getHeaders().getLocation().toString().contains("oauth_error=no_code"));

        ResponseEntity<Void> deniedByPlatform = controller.facebookCallback(null, "state-x", "access_denied");
        assertEquals(HttpStatus.FOUND, deniedByPlatform.getStatusCode());
        assertTrue(deniedByPlatform.getHeaders().getLocation().toString().contains("oauth_error=access_denied"));
    }

    @Test
    void erreurDichangeNeFuitPasLeMessageInterneAuNavigateur() {
        givenAgentOwnedBy(USER);
        String state = (String) controller.getAuthUrl(authOf(USER), "facebook", AGENT, null)
            .getBody().get("state");

        // Clés configurées mais aucun appel réseau possible : l'échange échoue.
        ResponseEntity<Void> response = controller.facebookCallback("code-oauth", state, null);

        String location = response.getHeaders().getLocation().toString();
        assertTrue(location.contains("oauth_error=exchange_failed"), location);
        assertTrue(!location.contains("graph.facebook.com"), "détail technique fuite dans l'URL : " + location);
    }

    @Test
    void statusSurAgentDAutruiRenvoie403() {
        when(agentRepo.findByIdAndOwnerIdAndDeletedFalse(AGENT, USER)).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.platformStatus(authOf(USER), AGENT);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(channelRepo, never()).findByAgentIdAndDeletedFalse(anyString());
    }

    @Test
    void statusSansAuthentificationRenvoie401() {
        ResponseEntity<?> response = controller.platformStatus(null, AGENT);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verify(channelRepo, never()).findByAgentIdAndDeletedFalse(anyString());
    }
}
