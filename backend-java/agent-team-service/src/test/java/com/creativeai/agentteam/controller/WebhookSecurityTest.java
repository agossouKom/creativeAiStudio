package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.creativeai.agentteam.security.WebhookVerifier;
import com.creativeai.agentteam.service.TaskService;
import com.creativeai.agentteam.service.WebhookEventDeduplicator;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests de sécurité des webhooks agent-team-service.
 *
 * <p>Ces tests couvrent le comportement de bout en bout des contrôleurs
 * (verdict → code HTTP → création de tâche ou non). Ils échouent tous avec
 * l'implémentation d'origine, qui avait quatre fail-open.
 */
@ExtendWith(MockitoExtension.class)
class WebhookSecurityTest {

    @Mock private ChannelRepository channelRepo;
    @Mock private TaskService taskService;
    @Mock private WebhookEventDeduplicator dedup;

    private FacebookWebhookController facebook;
    private InstagramWebhookController instagram;
    private WhatsAppWebhookController whatsApp;
    private TelegramWebhookController telegram;
    private WebhookVerifier verifier;

    private static final String APP_SECRET = "app-secret-meta";
    private static final String PAYLOAD = "{\"object\":\"page\",\"entry\":[]}";
    private static final String IG_PAYLOAD = "{\"object\":\"instagram\",\"entry\":[]}";

    @BeforeEach
    void setUp() {
        verifier = new WebhookVerifier();
        ObjectMapper mapper = new ObjectMapper();

        facebook = new FacebookWebhookController(channelRepo, taskService, mapper, verifier);
        instagram = new InstagramWebhookController(channelRepo, taskService, mapper, verifier, dedup);
        whatsApp = new WhatsAppWebhookController(taskService, mapper, verifier);
        telegram = new TelegramWebhookController(taskService, mapper, verifier);
    }

    private void configureAll() {
        ReflectionTestUtils.setField(verifier, "facebookVerifyToken", "fb-verify-token");
        ReflectionTestUtils.setField(verifier, "facebookAppSecret", APP_SECRET);
        ReflectionTestUtils.setField(verifier, "instagramVerifyToken", "ig-verify-token");
        ReflectionTestUtils.setField(verifier, "instagramAppSecret", APP_SECRET);
        ReflectionTestUtils.setField(verifier, "whatsappVerifyToken", "wa-verify-token");
        ReflectionTestUtils.setField(verifier, "whatsappAppSecret", APP_SECRET);
        ReflectionTestUtils.setField(verifier, "telegramWebhookSecret", "tg-secret");
    }

    private void configureNothing() {
        configureAll();
        ReflectionTestUtils.setField(verifier, "facebookAppSecret", "");
        ReflectionTestUtils.setField(verifier, "instagramAppSecret", "");
        ReflectionTestUtils.setField(verifier, "whatsappAppSecret", "");
        ReflectionTestUtils.setField(verifier, "telegramWebhookSecret", "");
    }

    private static String metaSignature(String payload, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "sha256=" + HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    }

    // ── Facebook : POST legacy ───────────────────────────────────────────────

    @Test
    @DisplayName("Facebook POST sans app-secret configuré → 503, webhook fermé")
    void facebookSansAppSecretFermeLEpping() {
        // AVANT : `if (appSecret != null && !appSecret.isBlank())` — avec la
        // variable vide (le cas du VPS), la vérification était sautée et la
        // requête acceptée. n'importe qui pouvait créer des tâches.
        configureNothing();

        ResponseEntity<String> r = facebook.receive(null, PAYLOAD);

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, r.getStatusCode());
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    @Test
    @DisplayName("Facebook POST sans signature → 403, aucune tâche créée")
    void facebookSansSignatureRefuse() {
        configureAll();

        ResponseEntity<String> r = facebook.receive(null, PAYLOAD);

        assertEquals(HttpStatus.FORBIDDEN, r.getStatusCode());
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    @Test
    @DisplayName("Facebook POST avec signature forgée → 403")
    void facebookSignatureForgeeRefusee() throws Exception {
        configureAll();

        ResponseEntity<String> r = facebook.receive(metaSignature(PAYLOAD, "mauvais-secret"), PAYLOAD);

        assertEquals(HttpStatus.FORBIDDEN, r.getStatusCode());
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    @Test
    @DisplayName("Facebook POST avec signature valide → traité (200)")
    void facebookSignatureValideAcceptee() throws Exception {
        configureAll();

        ResponseEntity<String> r = facebook.receive(metaSignature(PAYLOAD, APP_SECRET), PAYLOAD);

        assertEquals(HttpStatus.OK, r.getStatusCode());
    }

    // ── Facebook : handshake GET ─────────────────────────────────────────────

    @Test
    @DisplayName("Facebook GET avec le bon verify_token → 200 + challenge")
    void facebookHandshakeValide() {
        configureAll();

        ResponseEntity<String> r = facebook.verify("subscribe", "fb-verify-token", "42");

        assertEquals(HttpStatus.OK, r.getStatusCode());
        assertEquals("42", r.getBody());
    }

    @Test
    @DisplayName("Facebook GET avec le secret dev par défaut → 403")
    void facebookHandshakeRejetteSecretDev() {
        // `creativeai-facebook-verify` était le défaut en dur, donc public :
        // quiconque lisait le dépôt pouvait s'enregistrer comme Meta.
        configureAll();

        ResponseEntity<String> r = facebook.verify("subscribe", "creativeai-facebook-verify", "42");

        assertEquals(HttpStatus.FORBIDDEN, r.getStatusCode());
    }

    @Test
    @DisplayName("Facebook GET sans verify_token configuré → 503")
    void facebookHandshakeSansToken() {
        configureAll();
        ReflectionTestUtils.setField(verifier, "facebookVerifyToken", "");

        ResponseEntity<String> r = facebook.verify("subscribe", "n'importe-quoi", "42");

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, r.getStatusCode());
    }

    // ── Facebook : POST par canal ────────────────────────────────────────────

    @Test
    @DisplayName("Facebook POST /{channelId} sans appSecret global configuré → 503")
    void facebookParCanalSansAppSecretGlobalFerme() {
        // AVANT : « Si absent, on accepte quand même (dégradé) » — commentaire
        // explicite dans le code. Il suffisait de connaître l'ID d'un canal
        // existant pour injecter des tâches au nom de son propriétaire.
        configureAll();
        ReflectionTestUtils.setField(verifier, "facebookAppSecret", "");
        when(channelRepo.findByIdAndDeletedFalse("canal-1"))
            .thenReturn(Optional.of(channel()));

        ResponseEntity<String> r = facebook.receivePerChannel("canal-1", "sha256=deadbeef", PAYLOAD);

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, r.getStatusCode());
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    @Test
    @DisplayName("Facebook POST /{channelId} : la config du canal n'a pas besoin de porter l'appSecret")
    void facebookParCanalUtiliseAppSecretGlobal() throws Exception {
        // X-Hub-Signature-256 est signé par le secret de l'APPLICATION Meta,
        // pas par le token de page. Aucune écriture ne place d'appSecret dans
        // Channel.config : le lire désactivait à tort tous les callbacks par
        // canal. Le secret global est donc le seul bon candidat.
        configureAll();
        when(channelRepo.findByIdAndDeletedFalse("canal-1"))
            .thenReturn(Optional.of(channel()));

        ResponseEntity<String> r =
            facebook.receivePerChannel("canal-1", metaSignature(PAYLOAD, APP_SECRET), PAYLOAD);

        assertEquals(HttpStatus.OK, r.getStatusCode());
    }

    @Test
    @DisplayName("Facebook GET /{channelId} : config JSON illisible → 503, pas de repli ouvert")
    void facebookParCanalConfigIllisible() {
        // Le verifyToken du canal est le seul secret lu depuis Channel.config.
        // Une config illisible rend le canal indéfiniment non vérifiable —
        // avant, l'exception était avalée en échec ouvert.
        configureAll();
        Channel channel = new Channel();
        channel.setId("canal-1");
        channel.setConfig("{ ceci n'est pas du JSON");
        channel.setEncryptedCredentials("chiffre");
        when(channelRepo.findByIdAndDeletedFalse("canal-1")).thenReturn(Optional.of(channel));

        ResponseEntity<String> r =
            facebook.verifyPerChannel("canal-1", "subscribe", "anything", "challenge-123");

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, r.getStatusCode());
    }

    // ── Instagram ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Instagram POST sans app-secret configuré → 503, webhook fermé")
    void instagramSansAppSecretFerme() {
        configureNothing();

        ResponseEntity<String> r = instagram.receive(null, IG_PAYLOAD);

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, r.getStatusCode());
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    @Test
    @DisplayName("Instagram POST sans signature → 403, aucune tâche créée")
    void instagramSansSignatureRefuse() {
        configureAll();

        ResponseEntity<String> r = instagram.receive(null, IG_PAYLOAD);

        assertEquals(HttpStatus.FORBIDDEN, r.getStatusCode());
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    @Test
    @DisplayName("Instagram POST avec signature forgée → 403")
    void instagramSignatureForgeeRefusee() throws Exception {
        configureAll();

        ResponseEntity<String> r = instagram.receive(metaSignature(IG_PAYLOAD, "mauvais-secret"), IG_PAYLOAD);

        assertEquals(HttpStatus.FORBIDDEN, r.getStatusCode());
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    @Test
    @DisplayName("Instagram POST avec signature valide → traité (200)")
    void instagramSignatureValideAcceptee() throws Exception {
        configureAll();

        ResponseEntity<String> r = instagram.receive(metaSignature(IG_PAYLOAD, APP_SECRET), IG_PAYLOAD);

        assertEquals(HttpStatus.OK, r.getStatusCode());
    }

    @Test
    @DisplayName("Instagram GET avec le bon verify_token → 200 + challenge")
    void instagramHandshakeValide() {
        configureAll();

        ResponseEntity<String> r = instagram.verify("subscribe", "ig-verify-token", "1158201444");

        assertEquals(HttpStatus.OK, r.getStatusCode());
        assertEquals("1158201444", r.getBody());
    }

    @Test
    @DisplayName("Instagram GET avec le verify_token Facebook → 403")
    void instagramHandshakeRejetteLeJetonFacebook() {
        // Le jeton global est propre à l'endpoint : accepter celui de Facebook
        // permettrait de valider un abonnement Instagram avec un secret d'un autre
        // endpoint. La comparaison reste en temps constant dans WebhookVerifier.
        configureAll();

        ResponseEntity<String> r = instagram.verify("subscribe", "fb-verify-token", "42");

        assertEquals(HttpStatus.FORBIDDEN, r.getStatusCode());
    }

    @Test
    @DisplayName("Instagram GET sans aucun verify_token configuré → 503")
    void instagramHandshakeSansToken() {
        configureAll();
        // Les deux doivent être vides : un token Instagram vide retombe sur celui
        // de Facebook, c'est le cas nominal d'une seule application Meta.
        ReflectionTestUtils.setField(verifier, "instagramVerifyToken", "");
        ReflectionTestUtils.setField(verifier, "facebookVerifyToken", "");

        ResponseEntity<String> r = instagram.verify("subscribe", "n'importe-quoi", "42");

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, r.getStatusCode());
    }

    @Test
    @DisplayName("Instagram GET : token Instagram vide → le token Facebook est accepté")
    void instagramReprendLeVerifyTokenFacebook() {
        // docker-compose injecte INSTAGRAM_VERIFY_TOKEN vide : sans repli, le
        // handshake Instagram échouerait en 503 alors que Meta est configuré.
        configureAll();
        ReflectionTestUtils.setField(verifier, "instagramVerifyToken", "");

        assertEquals(HttpStatus.OK,
            instagram.verify("subscribe", "fb-verify-token", "42").getStatusCode());
        assertEquals(HttpStatus.FORBIDDEN,
            instagram.verify("subscribe", "ig-verify-token", "42").getStatusCode());
    }

    @Test
    @DisplayName("Instagram GET /{channelId} sans appSecret global configuré → 503")
    void instagramParCanalSansAppSecretGlobalFerme() {
        configureAll();
        ReflectionTestUtils.setField(verifier, "instagramAppSecret", "");
        ReflectionTestUtils.setField(verifier, "facebookAppSecret", "");
        when(channelRepo.findByIdAndDeletedFalse("canal-1"))
            .thenReturn(Optional.of(channel()));

        ResponseEntity<String> r = instagram.receivePerChannel("canal-1", "sha256=deadbeef", IG_PAYLOAD);

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, r.getStatusCode());
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    // ── WhatsApp ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("WhatsApp POST sans signature → 403 (avant : aucune vérification)")
    void whatsAppSansSignatureRefuse() {
        configureAll();

        ResponseEntity<String> r = whatsApp.receive("victime@x.com", null,
            "{\"entry\":[{\"changes\":[{\"value\":{\"messages\":[{\"type\":\"text\",\"text\":{\"body\":\"paye 1000\"}}]}}]}]}");

        assertEquals(HttpStatus.FORBIDDEN, r.getStatusCode());
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    @Test
    @DisplayName("WhatsApp POST avec app-secret absent → 503, webhook fermé")
    void whatsAppSansAppSecretFerme() {
        // Le contrôleur WhatsApp ne lisait même pas `whatsapp.app-secret` :
        // la propriété existait dans application.yml, morte.
        configureNothing();

        ResponseEntity<String> r = whatsApp.receive("victime@x.com", "sha256=deadbeef", PAYLOAD);

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, r.getStatusCode());
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    @Test
    @DisplayName("WhatsApp POST signé par quelqu'un d'autre → 403")
    void whatsAppSignatureForgeeRefusee() throws Exception {
        configureAll();

        ResponseEntity<String> r = whatsApp.receive("victime@x.com",
            metaSignature(PAYLOAD, "attaquant"), PAYLOAD);

        assertEquals(HttpStatus.FORBIDDEN, r.getStatusCode());
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    @Test
    @DisplayName("WhatsApp GET : le secret dev par défaut est rejeté")
    void whatsAppHandshakeRejetteSecretDev() {
        configureAll();

        ResponseEntity<String> r = whatsApp.verify("u1", "subscribe", "creativeai-whatsapp-verify", "7");

        assertEquals(HttpStatus.FORBIDDEN, r.getStatusCode());
    }

    // ── Telegram ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Telegram sans secret configuré → 503 (avant : requête acceptée)")
    void telegramSansSecretFerme() {
        // AVANT : `if (!webhookSecret.isBlank() && ...)`. Variable vide ⇒
        // condition fausse ⇒ acceptation. POST sans header, création de tâche
        // pour le userId fourni dans l'URL.
        configureNothing();

        ResponseEntity<String> r = telegram.receive("victime@x.com", null,
            "{\"message\":{\"text\":\"supprime tout\"}}");

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, r.getStatusCode());
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    @Test
    @DisplayName("Telegram sans header → 403 quand le secret est configuré")
    void telegramSansHeaderRefuse() {
        configureAll();

        ResponseEntity<String> r = telegram.receive("victime@x.com", null, "{\"message\":{\"text\":\"x\"}}");

        assertEquals(HttpStatus.FORBIDDEN, r.getStatusCode());
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    @Test
    @DisplayName("Telegram avec mauvais secret → 403")
    void telegramMauvaisSecretRefuse() {
        configureAll();

        ResponseEntity<String> r = telegram.receive("victime@x.com", "devine",
            "{\"message\":{\"text\":\"x\"}}");

        assertEquals(HttpStatus.FORBIDDEN, r.getStatusCode());
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    // ── Garde-fou commun ─────────────────────────────────────────────────────

    @Test
    @DisplayName("aucun secret configuré : les webhooks renvoient 503, pas 200")
    void aucunSecretTousFermes() {
        configureNothing();

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE,
            facebook.receive(null, PAYLOAD).getStatusCode());
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE,
            instagram.receive(null, IG_PAYLOAD).getStatusCode());
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE,
            whatsApp.receive("u", "sha256=x", PAYLOAD).getStatusCode());
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE,
            telegram.receive("u", "x", PAYLOAD).getStatusCode());
    }

    @Test
    @DisplayName("le refus est un corps non vide : l'opérateur voit la cause")
    void refusExplicite() {
        configureNothing();

        assertNotNull(facebook.receive(null, PAYLOAD).getBody());
        assertEquals("Webhook non configuré", facebook.receive(null, PAYLOAD).getBody());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Channel channel() {
        Channel c = new Channel();
        c.setId("canal-1");
        c.setEncryptedCredentials("chiffre");
        c.setConfig("{\"verifyToken\":\"uuid-du-canal\"}");
        return c;
    }
}
