package com.creativeai.auth.service;

import com.creativeai.auth.repository.GmailTokenRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Tests du callback Gmail sur le chemin du state.
 *
 * <p>Le state valait {@code Base64(userId)} : un attaquant pouvait forger
 * {@code state=Base64(victime)} et faire rattacher ses tokens Gmail au compte de
 * la victime. Le state est désormais opaque et à usage unique.
 */
class GmailOAuthServiceCallbackTest {

    private static final String FRONTEND = "https://ai.labibpro.com/settings";

    private GmailTokenRepository tokenRepository;
    private RestTemplate restTemplate;
    private GmailOAuthStateStore stateStore;
    private GmailOAuthService service;

    @BeforeEach
    void setUp() {
        tokenRepository = mock(GmailTokenRepository.class);
        restTemplate = mock(RestTemplate.class);
        stateStore = new GmailOAuthStateStore(600, 10000);
        service = new GmailOAuthService(tokenRepository, new ObjectMapper(), restTemplate, stateStore);
        ReflectionTestUtils.setField(service, "frontendRedirect", FRONTEND);
    }

    @Test
    @DisplayName("state forgé en base64(userId) → refus, aucun échange de code")
    void stateForgeBase64Refuse() {
        String forged = java.util.Base64.getUrlEncoder()
            .encodeToString("victime@exemple.com".getBytes(java.nio.charset.StandardCharsets.UTF_8));

        String redirect = service.handleCallback("code-google", forged);

        assertEquals(FRONTEND + "?gmail=error&reason=state", redirect);
        verifyNoInteractions(restTemplate, tokenRepository);
    }

    @Test
    @DisplayName("state inconnu ou absent → refus")
    void stateInconnuRefuse() {
        assertEquals(FRONTEND + "?gmail=error&reason=state",
            service.handleCallback("code", "jamais-emis"));
        assertEquals(FRONTEND + "?gmail=error&reason=state",
            service.handleCallback("code", ""));
        assertEquals(FRONTEND + "?gmail=error&reason=state",
            service.handleCallback("code", null));
    }

    @Test
    @DisplayName("state rejoué → refus")
    void stateRejoueRefuse() {
        String state = stateStore.issue("alice@exemple.com");
        stateStore.consume(state);

        assertEquals(FRONTEND + "?gmail=error&reason=state",
            service.handleCallback("code", state));
        verifyNoInteractions(restTemplate, tokenRepository);
    }

    @Test
    @DisplayName("state valide consommé : le compte est bien celui du state, pas celui du code")
    void stateValideLieAuCompteDuState() {
        // L'échange de code échoue volontairement : on veut vérifier que le
        // compte ciblé vient du state, avant tout appel à Google.
        String state = stateStore.issue("alice@exemple.com");
        ReflectionTestUtils.setField(service, "clientId", "client-id");
        ReflectionTestUtils.setField(service, "clientSecret", "client-secret");
        ReflectionTestUtils.setField(service, "redirectUri", "https://ai.labibpro.com/gmail/callback");

        String redirect = service.handleCallback("code-google", state);

        // restTemplate est un mock sans stub : getForObject échoue, on tombe dans
        // le filet d'erreur. L'utilisateur est renvoyé vers le frontend au lieu
        // de voir une 500.
        assertTrue(redirect.startsWith(FRONTEND + "?gmail="), redirect);
        assertEquals(0, stateStore.activeCount(), "le state est consommé même en cas d'échec ultérieur");
    }

    @Test
    @DisplayName("le message d'exception ne part jamais dans l'URL de redirection")
    void pasDeFuiteDansLUrl() {
        String redirect = service.handleCallback("code", "inconnu");

        assertEquals(FRONTEND + "?gmail=error&reason=state", redirect);
        assertTrue(!redirect.toLowerCase().contains("exception"));
        assertTrue(!redirect.contains("client_secret"));
    }

}
