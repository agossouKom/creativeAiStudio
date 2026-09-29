package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.creativeai.agentteam.service.ChannelService;
import com.creativeai.agentteam.service.EncryptionService;
import com.creativeai.agentteam.service.OAuthStateStore;
import com.creativeai.agentteam.service.SocialPlatformConfigService;
import com.creativeai.agentteam.service.UserSocialAccountService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Sélection de Page pour un agent gérant plusieurs Pages Facebook/Instagram.
 *
 * Contrainte n°1 du besoin : ne rien casser. Un canal historique (sans
 * {@code availablePages} dans ses credentials chiffrés) doit rester
 * publiable et ne doit déclencher aucun sélecteur. Un échange OAuth qui ne
 * renvoie qu'une seule Page doit produire exactement les mêmes credentials
 * qu'avant. Ces tests verrouillent les deux cas.
 */
@ExtendWith(MockitoExtension.class)
class OAuthSocialPagesSelectionTest {

    private static final String USER = "user-1";
    private static final String AGENT = "agent-1";
    private static final String CHANNEL = "channel-1";

    @Mock private ChannelService channelService;
    @Mock private ChannelRepository channelRepo;
    @Mock private AgentRepository agentRepo;
    @Mock private EncryptionService encryptionService;
    @Mock private SocialPlatformConfigService platformConfig;
    @Mock private UserSocialAccountService userSocialAccounts;

    private OAuthSocialController controller;

    @BeforeEach
    void setUp() {
        controller = new OAuthSocialController(channelService, channelRepo, agentRepo,
            encryptionService, new OAuthStateStore(600, 1000), new ObjectMapper(), platformConfig, userSocialAccounts);
        ReflectionTestUtils.setField(controller, "publicUrl", "https://app.test");
        ReflectionTestUtils.setField(controller, "frontendUrl", "https://app.test");
        // Résolution de la config plateforme : sans stub, le mock renvoie null
        // et le contrôleur-plantait sur un NPE avant même d'atteindre sa logique.
        lenient().when(platformConfig.resolve(anyString())).thenReturn(
            new SocialPlatformConfigService.Credentials("client-id", "client-secret", false));
        ReflectionTestUtils.setField(controller, "fbAppId", "fb-id");
        ReflectionTestUtils.setField(controller, "fbAppSecret", "fb-secret");
        ReflectionTestUtils.setField(controller, "linkedinClientId", "");
        ReflectionTestUtils.setField(controller, "linkedinClientSecret", "");
        ReflectionTestUtils.setField(controller, "twitterClientId", "");
        ReflectionTestUtils.setField(controller, "twitterClientSecret", "");
        ReflectionTestUtils.setField(controller, "tiktokClientKey", "");
        ReflectionTestUtils.setField(controller, "tiktokClientSecret", "");
        ReflectionTestUtils.setField(controller, "googleClientId", "");
        ReflectionTestUtils.setField(controller, "googleClientSecret", "");
    }

    private static Authentication authOf(String userId) {
        return new UsernamePasswordAuthenticationToken(userId, null,
            List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    private static Authentication anonymous() {
        return new AnonymousAuthenticationToken("key", "anonymousUser",
            List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));
    }

    /** Canal appartenant bien à l'agent de l'appelant, prêt à être persisté. */
    private Channel givenOwnedChannel(PlatformType platform, Map<String, Object> creds) throws Exception {
        Agent agent = mock(Agent.class);
        lenient().when(agent.getId()).thenReturn(AGENT);

        Channel channel = new Channel();
        channel.setId(CHANNEL);
        channel.setType(ChannelType.SOCIAL_MEDIA);
        channel.setPlatformType(platform);
        channel.setStatus(ChannelStatus.CONNECTED);
        channel.setAccountId("111");
        channel.setAccountName("Page A");
        channel.setDisplayName("FACEBOOK — Page A");
        channel.setAgent(agent);
        channel.setEncryptedCredentials("cipher");

        lenient().when(channelRepo.findById(CHANNEL)).thenReturn(Optional.of(channel));
        lenient().when(agentRepo.findByIdAndOwnerIdAndDeletedFalse(AGENT, USER))
            .thenReturn(Optional.of(mock(Agent.class)));
        lenient().when(encryptionService.decrypt("cipher"))
            .thenReturn(new ObjectMapper().writeValueAsString(creds));
        lenient().when(encryptionService.encrypt(anyString())).thenReturn("cipher-v2");
        return channel;
    }

    private static Map<String, Object> twoPagesCreds() {
        return new java.util.LinkedHashMap<>(Map.of(
            "pageId", "111",
            "accessToken", "token-page-a",
            "pageName", "Page A",
            "accountId", "111",
            "accountName", "Page A",
            "availablePages", List.of(
                Map.of("id", "111", "name", "Page A", "accessToken", "token-page-a"),
                Map.of("id", "222", "name", "Page B", "accessToken", "token-page-b")),
            "pageSelectionPending", true));
    }

    // ── Non-régression : ce qui marche aujourd'hui doit continuer ──────────

    @Test
    void canalHistoriqueSansAvailablePagesNestPasSelectionnable() throws Exception {
        // Credentials d'un canal créé avant la multi-page : pas de availablePages.
        givenOwnedChannel(PlatformType.FACEBOOK, new java.util.LinkedHashMap<>(Map.of(
            "pageId", "111", "accessToken", "token-a", "pageName", "Page A",
            "accountId", "111", "accountName", "Page A")));

        ResponseEntity<Map<String, Object>> response =
            controller.selectPage(authOf(USER), "facebook", CHANNEL, Map.of("pageId", "222"));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(false, response.getBody().get("changed"),
            "un canal historique ne doit jamais être considéré comme basculé");
        assertEquals("single_page", response.getBody().get("reason"));
        verify(channelRepo, never()).save(any());
    }

    @Test
    void statutDunCanalHistoriqueNExposePasDeSelecteur() throws Exception {
        givenOwnedChannel(PlatformType.FACEBOOK, new java.util.LinkedHashMap<>(Map.of(
            "pageId", "111", "accessToken", "token-a", "accountName", "Page A")));
        Channel persisted = channelOf();
        when(channelRepo.findByAgentIdAndDeletedFalse(AGENT)).thenReturn(List.of(persisted));

        ResponseEntity<List<Map<String, Object>>> response = controller.platformStatus(authOf(USER), AGENT);

        Map<String, Object> facebook = response.getBody().stream()
            .filter(m -> "FACEBOOK".equals(m.get("platform"))).findFirst().orElseThrow();
        assertEquals(false, facebook.get("pageSelectionPending"));
        assertEquals(0, facebook.get("availablePageCount"));
        // Les champs historiques sont inchangés.
        assertEquals(true, facebook.get("connected"));
        assertEquals("Page A", facebook.get("accountName"));
        assertEquals(CHANNEL, facebook.get("channelId"));
    }

    // ── Sécurité : l'isolation doit être aussi stricte que sur /authorize ──

    @Test
    void listPagesSansAuthentificationRenvoie401() {
        ResponseEntity<Map<String, Object>> response =
            controller.listPages(anonymous(), "facebook", CHANNEL);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verify(channelRepo, never()).findById(anyString());
    }

    @Test
    void listPagesSurUnCanalDUnAutreUtilisateurRenvoie403() {
        Channel stolen = channelOf();
        when(channelRepo.findById(CHANNEL)).thenReturn(Optional.of(stolen));
        when(agentRepo.findByIdAndOwnerIdAndDeletedFalse(AGENT, USER)).thenReturn(Optional.empty());

        ResponseEntity<Map<String, Object>> response =
            controller.listPages(authOf(USER), "facebook", CHANNEL);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }

    @Test
    void selectPageSurUnCanalDUnAutreUtilisateurRenvoie403() {
        Channel stolen = channelOf();
        when(channelRepo.findById(CHANNEL)).thenReturn(Optional.of(stolen));
        when(agentRepo.findByIdAndOwnerIdAndDeletedFalse(AGENT, USER)).thenReturn(Optional.empty());

        ResponseEntity<Map<String, Object>> response =
            controller.selectPage(authOf(USER), "facebook", CHANNEL, Map.of("pageId", "222"));

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(channelRepo, never()).save(any());
    }

    @Test
    void plateformeIncoherenteAvecLeCanalRenvoie403() throws Exception {
        // Un canal INSTAGRAM interrogé via /facebook/pages/... : le pathVariable
        // ne doit pas servir à contourner le contrôle.
        givenOwnedChannel(PlatformType.INSTAGRAM, twoPagesCreds());

        ResponseEntity<Map<String, Object>> response =
            controller.selectPage(authOf(USER), "facebook", CHANNEL, Map.of("pageId", "222"));

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(channelRepo, never()).save(any());
    }

    @Test
    void pageIdInconnuEstRefuse() throws Exception {
        givenOwnedChannel(PlatformType.FACEBOOK, twoPagesCreds());

        ResponseEntity<Map<String, Object>> response =
            controller.selectPage(authOf(USER), "facebook", CHANNEL, Map.of("pageId", "999"));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(String.valueOf(response.getBody().get("error")).contains("pages connectées"));
        verify(channelRepo, never()).save(any());
    }

    @Test
    void pageIdVideEstRefuse() throws Exception {
        givenOwnedChannel(PlatformType.FACEBOOK, twoPagesCreds());

        ResponseEntity<Map<String, Object>> response =
            controller.selectPage(authOf(USER), "facebook", CHANNEL, Map.of("pageId", "  "));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(channelRepo, never()).save(any());
    }

    // ── Pas de fuite de secret ─────────────────────────────────────────────

    @Test
    void listPagesNeRenvoieJAucunToken() throws Exception {
        givenOwnedChannel(PlatformType.FACEBOOK, twoPagesCreds());

        ResponseEntity<Map<String, Object>> response =
            controller.listPages(authOf(USER), "facebook", CHANNEL);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        String serialised = new ObjectMapper().writeValueAsString(response.getBody());
        assertFalse(serialised.contains("token-page-a"), "token de Page A exposé : " + serialised);
        assertFalse(serialised.contains("token-page-b"), "token de Page B exposé : " + serialised);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> pages = (List<Map<String, Object>>) response.getBody().get("pages");
        assertEquals(2, pages.size());
        assertEquals("Page B", pages.get(1).get("name"));
        assertEquals("111", response.getBody().get("pageId"), "page courante = 1re page");
    }

    // ── Le cas nominal ────────────────────────────────────────────────────

    @Test
    void selectionDunePageBasculeLesCredentials() throws Exception {
        Channel channel = givenOwnedChannel(PlatformType.FACEBOOK, twoPagesCreds());

        ResponseEntity<Map<String, Object>> response =
            controller.selectPage(authOf(USER), "facebook", CHANNEL, Map.of("pageId", "222"));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(true, response.getBody().get("changed"));
        assertEquals("Page B", response.getBody().get("pageName"));

        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(encryptionService).encrypt(captor.capture());

        @SuppressWarnings("unchecked")
        Map<String, Object> saved = new ObjectMapper()
            .readValue(captor.getValue(), Map.class);
        assertEquals("222", saved.get("pageId"));
        assertEquals("token-page-b", saved.get("accessToken"));
        assertEquals("222", saved.get("accountId"));
        assertEquals("Page B", saved.get("accountName"));
        assertEquals(false, saved.get("pageSelectionPending"));
        // Les autres Pages restent disponibles pour rebasculer.
        assertTrue(saved.containsKey("availablePages"));

        assertEquals("222", channel.getAccountId());
        assertEquals("Page B", channel.getAccountName());
        assertEquals("FACEBOOK — Page B", channel.getDisplayName());
        assertEquals(ChannelStatus.CONNECTED, channel.getStatus());
    }

    @Test
    void selectionSurLaPageDejaActiveEstUnNoOp() throws Exception {
        givenOwnedChannel(PlatformType.FACEBOOK, twoPagesCreds());

        ResponseEntity<Map<String, Object>> response =
            controller.selectPage(authOf(USER), "facebook", CHANNEL, Map.of("pageId", "111"));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("Page A", response.getBody().get("pageName"));
        verify(channelRepo).save(any());
    }

    @Test
    void instagramSansCompteProRejetteLaPageEtNeSauvePas() throws Exception {
        RestTemplate rest = mock(RestTemplate.class);
        ReflectionTestUtils.setField(controller, "restTemplate", rest);
        when(rest.getForEntity(anyString(), org.mockito.ArgumentMatchers.eq(String.class)))
            .thenReturn(ResponseEntity.ok("{\"data\":[]}"));

        givenOwnedChannel(PlatformType.INSTAGRAM, twoPagesCreds());

        ResponseEntity<Map<String, Object>> response =
            controller.selectPage(authOf(USER), "instagram", CHANNEL, Map.of("pageId", "222"));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(String.valueOf(response.getBody().get("error"))
            .contains("Instagram professionnel"));
        verify(channelRepo, never()).save(any());
    }

    @Test
    void instagramRersolutLeCompteProDeLaNouvellePage() throws Exception {
        RestTemplate rest = mock(RestTemplate.class);
        ReflectionTestUtils.setField(controller, "restTemplate", rest);
        when(rest.getForEntity(anyString(), org.mockito.ArgumentMatchers.eq(String.class)))
            .thenReturn(ResponseEntity.ok("{\"instagram_business_account\":{\"id\":\"ig-777\"}}"));

        givenOwnedChannel(PlatformType.INSTAGRAM, twoPagesCreds());

        ResponseEntity<Map<String, Object>> response =
            controller.selectPage(authOf(USER), "instagram", CHANNEL, Map.of("pageId", "222"));

        assertEquals(HttpStatus.OK, response.getStatusCode());

        ArgumentCaptor<String> url = ArgumentCaptor.forClass(String.class);
        verify(rest).getForEntity(url.capture(), org.mockito.ArgumentMatchers.eq(String.class));
        assertTrue(url.getValue().startsWith("https://graph.facebook.com/v19.0/222?"),
            "l'igUserId doit être demandé pour la page 222, pas pour l'ancienne : " + url.getValue());
        assertTrue(url.getValue().contains("access_token=token-page-b"),
            "il faut utiliser le token de la page 222 : " + url.getValue());

        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(encryptionService).encrypt(captor.capture());
        @SuppressWarnings("unchecked")
        Map<String, Object> saved = new ObjectMapper().readValue(captor.getValue(), Map.class);
        assertEquals("ig-777", saved.get("igUserId"),
            "l'id Instagram doit correspondre à la NOUVELLE page");
        assertEquals("ig-777", saved.get("accountId"),
            "accountId pointe sur le compte IG, pas sur la page");
    }

    // ── Fixture ───────────────────────────────────────────────────────────

    private Channel channelOf() {
        Agent agent = mock(Agent.class);
        lenient().when(agent.getId()).thenReturn(AGENT);

        Channel channel = new Channel();
        channel.setId(CHANNEL);
        channel.setType(ChannelType.SOCIAL_MEDIA);
        channel.setPlatformType(PlatformType.FACEBOOK);
        channel.setStatus(ChannelStatus.CONNECTED);
        channel.setAccountName("Page A");
        channel.setAccountId("111");
        channel.setEncryptedCredentials("cipher");
        channel.setAgent(agent);
        return channel;
    }
}
