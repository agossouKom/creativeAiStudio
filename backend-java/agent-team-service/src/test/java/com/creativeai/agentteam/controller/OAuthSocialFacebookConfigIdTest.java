package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.creativeai.agentteam.service.ChannelService;
import com.creativeai.agentteam.service.EncryptionService;
import com.creativeai.agentteam.service.MetaWebhookSubscriptionService;
import com.creativeai.agentteam.service.OAuthStateStore;
import com.creativeai.agentteam.service.SocialPlatformConfigService;
import com.creativeai.agentteam.service.UserSocialAccountService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bascule vers Facebook Login for Business.
 *
 * <p>Meta veut désormais les permissions Pages demandées via une configuration
 * créée dans le dashboard ({@code config_id}) et non via un {@code scope} brut
 * dans le dialog : c'est le dialogue par scope qui renvoyait « Invalid Scopes :
 * pages_manage_posts » et faisait échouer la connexion.
 *
 * <p>Ces tests verrouillent les deux branches : {@code config_id} seul quand une
 * configuration existe, {@code scope} seul sinon, et jamais les deux.
 */
@ExtendWith(MockitoExtension.class)
class OAuthSocialFacebookConfigIdTest {

    private static final String USER = "user-1";
    private static final String AGENT = "agent-1";
    private static final String CONFIG_ID = "1084366337684150";

    @Mock private ChannelService channelService;
    @Mock private ChannelRepository channelRepo;
    @Mock private AgentRepository agentRepo;
    @Mock private EncryptionService encryptionService;
    @Mock private SocialPlatformConfigService platformConfig;
    @Mock private MetaWebhookSubscriptionService metaSubscriptions;
    @Mock private UserSocialAccountService userSocialAccounts;

    private OAuthSocialController controller;

    @BeforeEach
    void setUp() {
        controller = new OAuthSocialController(channelService, channelRepo, agentRepo,
            encryptionService, new OAuthStateStore(600, 1000), new ObjectMapper(),
            platformConfig, userSocialAccounts, metaSubscriptions);
        ReflectionTestUtils.setField(controller, "frontendUrl", "https://app.test");
        lenient().when(platformConfig.resolve(anyString())).thenReturn(
            new SocialPlatformConfigService.Credentials("client-id", "client-secret", false));
        lenient().when(platformConfig.resolveCallback(anyString())).thenAnswer(inv -> {
            String p = inv.getArgument(0);
            return new SocialPlatformConfigService.CallbackConfig("https://app.test",
                "/api/oauth/social/" + p.toLowerCase() + "/callback", false);
        });
        lenient().when(platformConfig.resolveScopes(anyString())).thenReturn(List.of());
        ReflectionTestUtils.setField(controller, "fbAppId", "fb-id");
        ReflectionTestUtils.setField(controller, "fbAppSecret", "fb-secret");
        when(agentRepo.findByIdAndOwnerIdAndDeletedFalse(AGENT, USER))
            .thenReturn(Optional.of(mock(Agent.class)));
    }

    private static Authentication authOf(String userId) {
        return new UsernamePasswordAuthenticationToken(userId, null,
            List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    private UriComponentsBuilder authorizeUrlFor(String platform) {
        ResponseEntity<Map<String, Object>> response =
            controller.getAuthUrl(authOf(USER), platform, AGENT, null);
        assertEquals(200, response.getStatusCode().value());
        return UriComponentsBuilder.fromUri(URI.create((String) response.getBody().get("authUrl")));
    }

    @Test
    void configIdRemplaceLeScope() {
        lenient().when(platformConfig.resolveFacebookConfigId("FACEBOOK")).thenReturn(CONFIG_ID);

        var query = authorizeUrlFor("facebook").build().getQueryParams();

        assertEquals(CONFIG_ID, query.getFirst("config_id"));
        assertNull(query.getFirst("scope"),
            "config_id et scope ne doivent jamais être envoyés ensemble : "
                + "Meta rejette le dialog quand les deux sont présents");
    }

    @Test
    void configIdForceLEchangeDeCodeEtConserveLesParametresDuDialog() {
        lenient().when(platformConfig.resolveFacebookConfigId("FACEBOOK")).thenReturn(CONFIG_ID);

        var query = authorizeUrlFor("facebook").build().getQueryParams();

        assertEquals("code", query.getFirst("response_type"));
        // Force le code même si la configuration Meta déclare un autre défaut.
        assertEquals("true", query.getFirst("override_default_response_type"));
        assertEquals("client-id", query.getFirst("client_id"));
        assertEquals("https://app.test/api/oauth/social/facebook/callback",
            query.getFirst("redirect_uri"));
    }

    @Test
    void sansConfigIdLeFacebookLoginClassiqueConserveLesScopes() {
        lenient().when(platformConfig.resolveFacebookConfigId(anyString())).thenReturn(null);
        lenient().when(platformConfig.resolveScopes("FACEBOOK"))
            .thenReturn(List.of("pages_show_list", "public_profile"));

        var query = authorizeUrlFor("facebook").build().getQueryParams();

        assertEquals("pages_show_list,public_profile", query.getFirst("scope"));
        assertNull(query.getFirst("config_id"));
    }

    /**
     * Instagram partage la ligne « facebook » en base mais pas les permissions :
     * lui envoyer la configuration Facebook reviendrait à réclamer des scopes
     * {@code pages_*} au lieu des scopes {@code instagram_*}.
     */
    @Test
    void instagramNestPasAffecteParLaConfigurationFacebook() {
        lenient().when(platformConfig.resolveFacebookConfigId("INSTAGRAM")).thenReturn(null);
        lenient().when(platformConfig.resolveScopes("INSTAGRAM"))
            .thenReturn(List.of("instagram_basic", "instagram_content_publish"));

        var query = authorizeUrlFor("instagram").build().getQueryParams();

        assertEquals("instagram_basic,instagram_content_publish", query.getFirst("scope"));
        assertNull(query.getFirst("config_id"));
    }
}
