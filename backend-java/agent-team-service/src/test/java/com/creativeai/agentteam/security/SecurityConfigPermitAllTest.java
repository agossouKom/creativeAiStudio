package com.creativeai.agentteam.security;

import com.creativeai.agentteam.controller.FacebookWebhookController;
import com.creativeai.agentteam.controller.MediaController;
import com.creativeai.agentteam.controller.OAuthSocialController;
import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.creativeai.agentteam.service.ChannelService;
import com.creativeai.agentteam.service.EncryptionService;
import com.creativeai.agentteam.service.MinioService;
import com.creativeai.agentteam.service.OAuthStateStore;
import com.creativeai.agentteam.service.TaskService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verrouille la chaîne de filtres elle-même (SecurityConfig + JwtAuthFilter).
 *
 * <p>Les tests unitaires des contrôleurs ne prouvent qu'une chose : que la logique
 * refuse quand elle est atteinte. Or la faille du commit d'origine était
 * précisément que la chaîne laissait passer. Ce test échouerait si l'upload ou
 * l'endpoint d'autorisation OAuth repassait en {@code permitAll}, ou si le filtre
 * JWT cessait de s'appliquer.
 */
@WebMvcTest(controllers = {MediaController.class, OAuthSocialController.class,
    FacebookWebhookController.class})
@Import({SecurityConfig.class, JwtAuthFilter.class, WebhookVerifier.class})
class SecurityConfigPermitAllTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private WebhookVerifier webhookVerifier;

    @MockBean private JwtService jwtService;
    @MockBean private MinioService minioService;
    @MockBean private ChannelService channelService;
    @MockBean private ChannelRepository channelRepo;
    @MockBean private AgentRepository agentRepo;
    @MockBean private EncryptionService encryptionService;
    @MockBean private OAuthStateStore stateStore;
    @MockBean private TaskService taskService;

    /**
     * L'app ne déclare aucun AuthenticationEntryPoint : une requête sans
     * credentials est donc rejetée en 403, pas en 401. Le refus est bien réel,
     * seul le code HTTP est moins précis — on Asserte le comportement observé.
     */
    private static final int UNAUTHENTICATED = HttpStatus.FORBIDDEN.value();

    private void givenValidJwt() {
        when(jwtService.isValid(anyString())).thenReturn(true);
        when(jwtService.extractUserId(anyString())).thenReturn("user-1");
        when(agentRepo.findByIdAndOwnerIdAndDeletedFalse(anyString(), anyString()))
            .thenReturn(Optional.of(org.mockito.Mockito.mock(Agent.class)));
    }

    private static MockMultipartFile png() {
        return new MockMultipartFile("file", "a.png", MediaType.IMAGE_PNG_VALUE,
            new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A});
    }

    // ── Ce qui doit exiger un jeton ──────────────────────────────────────────

    @Test
    void uploadSansJetonEstRefuse() throws Exception {
        mockMvc.perform(multipart("/api/media/upload").file(png()))
            .andExpect(status().is(UNAUTHENTICATED));
    }

    @Test
    void uploadAvecJetonInvalideEstRefuse() throws Exception {
        when(jwtService.isValid(anyString())).thenReturn(false);

        mockMvc.perform(multipart("/api/media/upload").file(png())
                .header("Authorization", "Bearer jwt-bidon"))
            .andExpect(status().is(UNAUTHENTICATED));
    }

    @Test
    void authorizeOAuthSansJetonEstRefuse() throws Exception {
        mockMvc.perform(get("/api/oauth/social/facebook/authorize").param("agentId", "agent-1"))
            .andExpect(status().is(UNAUTHENTICATED));
    }

    @Test
    void statusOAuthSansJetonEstRefuse() throws Exception {
        mockMvc.perform(get("/api/oauth/social/status/agent-1"))
            .andExpect(status().is(UNAUTHENTICATED));
    }

    @Test
    void unJetonValideTraverseLeFiltre() throws Exception {
        givenValidJwt();
        // Le scanner est injoignable (aucun @Value file-security.url résolu) :
        // le filtre a laissé passer, c'est la logique métier qui répond en 503
        // fail-closed. Un 403 ici signifierait que le filtre JWT ne s'applique plus.
        mockMvc.perform(multipart("/api/media/upload").file(png())
                .header("Authorization", "Bearer jeton-valide"))
            .andExpect(status().isServiceUnavailable());
    }

    @Test
    void authorizeOAuthAvecJetonTraverseLeFiltre() throws Exception {
        givenValidJwt();
        when(stateStore.issue(anyString(), anyString(), any(), anyString()))
            .thenReturn(new OAuthStateStore.Issued("state-opaque", "verificateur"));

        mockMvc.perform(get("/api/oauth/social/facebook/authorize")
                .param("agentId", "agent-1")
                .header("Authorization", "Bearer jeton-valide"))
            .andExpect(status().isOk());
    }

    // ── Ce qui doit rester public ───────────────────────────────────────────

    @Test
    void callbackOAuthRestePublicSinonTouteConnexionEstCassee() throws Exception {
        // La plateforme redirige le navigateur : aucun Authorization. Si ce test
        // échoue, plus personne ne peut connecter un compte social.
        mockMvc.perform(get("/api/oauth/social/facebook/callback")
                .param("code", "code-oauth").param("state", "state-inconnu"))
            .andExpect(status().is3xxRedirection());
    }

    @Test
    void webhookFacebookRestePublicEtSeValideLuiMeme() throws Exception {
        // Public, mais pas aveugle : c'est le verify_token Meta qui décide, et il
        // est comparé dans le handler puisque le filtre JWT ne s'applique pas.
        // Aucun FACEBOOK_VERIFY_TOKEN dans ce contexte → le handler refuse en
        // fail-closed. Le statut vient bien du handler, pas de la chaîne de
        // filtres : un 403 de la chaîne aurait signifié que le filtre s'applique.
        mockMvc.perform(get("/api/facebook/webhook")
                .param("hub.mode", "subscribe")
                .param("hub.verify_token", "jeton-incorrect")
                .param("hub.challenge", "42"))
            .andExpect(status().isServiceUnavailable());

        // Avec un verify_token configuré, un jeton erroné donne un 403 : la
        // requête traverse bien le filtre et atteint le contrôleur.
        ReflectionTestUtils.setField(webhookVerifier, "facebookVerifyToken", "jeton-attendu");
        mockMvc.perform(get("/api/facebook/webhook")
                .param("hub.mode", "subscribe")
                .param("hub.verify_token", "jeton-incorrect")
                .param("hub.challenge", "42"))
            .andExpect(status().isForbidden());
    }
}
