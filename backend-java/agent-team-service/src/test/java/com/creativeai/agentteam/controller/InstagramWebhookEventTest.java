package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.CreateTaskRequest;
import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.model.enums.TaskType;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.creativeai.agentteam.security.WebhookVerifier;
import com.creativeai.agentteam.service.TaskService;
import com.creativeai.agentteam.service.WebhookEventDeduplicator;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Comportement du webhook Instagram : routage, dédoublonnage, et refus de tout
 * événement que l'agent ne peut pas traiter.
 *
 * <p>Ces tests échouent tous avec l'implémentation d'origine, qui n'existait pas :
 * Instagram n'avait aucun endpoint, alors que Meta livre bien ses notifications
 * sur l'objet {@code instagram} — elles partaient dans le vide, sans erreur.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class InstagramWebhookEventTest {

    private static final String APP_SECRET  = "app-secret-meta";
    private static final String IG_USER_ID  = "17841405726653026";
    private static final String CHANNEL_ID  = "canal-ig-1";
    private static final String OWNER       = "owner@example.com";
    private static final String AGENT_ID    = "agent-1";

    @Mock private ChannelRepository        channelRepo;
    @Mock private TaskService              taskService;
    @Mock private WebhookEventDeduplicator dedup;

    private InstagramWebhookController instagram;
    private WebhookVerifier verifier;

    @BeforeEach
    void setUp() {
        verifier = new WebhookVerifier();
        ReflectionTestUtils.setField(verifier, "facebookAppSecret", APP_SECRET);
        ReflectionTestUtils.setField(verifier, "instagramAppSecret", APP_SECRET);
        ReflectionTestUtils.setField(verifier, "instagramVerifyToken", "jeton-insta");

        instagram = new InstagramWebhookController(
            channelRepo, taskService, new ObjectMapper(), verifier, dedup);
    }

    private static String signature(String payload) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(APP_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "sha256=" + HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    }

    /** Payload officiel « comments » (Facebook Login for Business) : clé `id`. */
    private static String commentPayload(String commentId, String text) {
        return commentPayloadFor(IG_USER_ID, commentId, text);
    }

    /** Même payload, mais émis pour un autre compte Instagram que l'agent. */
    private static String commentPayloadFor(String igUserId, String commentId, String text) {
        return """
            {"object":"instagram","entry":[{"id":"%s","time":1520622968,"changes":[
              {"field":"comments","value":{
                "id":"%s",
                "from":{"id":"17900","username":"client_ouf"},
                "text":"%s",
                "media":{"id":"17918195224117851","media_product_type":"FEED"}}}]}]}
            """.formatted(json(igUserId), json(commentId), json(text));
    }

    /**
     * Échappe une chaîne pour l'injecter dans un littéral JSON du payload.
     * writeValueAsString d'une String rend un littéral JSON complet, guillemets
     * compris : on retire ces deux guillemets, pas les séquences d'échappement.
     */
    private static String json(String raw) {
        try {
            String quoted = new ObjectMapper().writeValueAsString(raw);
            return quoted.substring(1, quoted.length() - 1);
        } catch (Exception e) {
            throw new IllegalArgumentException("Chaîne non sérialisable : " + raw, e);
        }
    }

    private void givenConnectedChannel() {
        when(channelRepo.findFirstByAccountIdAndPlatformTypeAndStatusAndDeletedFalse(
                IG_USER_ID, PlatformType.INSTAGRAM, ChannelStatus.CONNECTED))
            .thenReturn(Optional.of(channel()));
    }

    private void givenNothingSeenBefore() {
        when(dedup.firstTime(any(), anyString())).thenReturn(true);
    }

    private Channel channel() {
        Agent agent = new Agent();
        agent.setId(AGENT_ID);
        agent.setOwnerId(OWNER);
        Channel c = new Channel();
        c.setId(CHANNEL_ID);
        c.setType(ChannelType.SOCIAL_MEDIA);
        c.setPlatformType(PlatformType.INSTAGRAM);
        c.setStatus(ChannelStatus.CONNECTED);
        c.setAccountId(IG_USER_ID);
        c.setEncryptedCredentials("chiffre");
        c.setConfig("{\"verifyToken\":\"uuid-du-canal\"}");
        c.setAgent(agent);
        return c;
    }

    // ── Routage ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("commentaire Instagram → tâche SOCIAL_REPLY pour le propriétaire du canal")
    void commentaireCreeUneTache() throws Exception {
        String payload = commentPayload("179999999", "Bonjour, quel prix ?");
        givenConnectedChannel();
        givenNothingSeenBefore();

        ResponseEntity<String> r = instagram.receive(signature(payload), payload);

        assertEquals(HttpStatus.OK, r.getStatusCode());
        ArgumentCaptor<CreateTaskRequest> captor = ArgumentCaptor.forClass(CreateTaskRequest.class);
        verify(taskService).createTask(eq(OWNER), captor.capture(), any());
        CreateTaskRequest req = captor.getValue();
        assertEquals(TaskType.SOCIAL_REPLY, req.type());
        assertTrue(req.description().contains("17918195224117851"), "l'agent doit connaître le média");
        assertTrue(req.description().contains("179999999"), "l'agent doit connaître le commentaire");
        assertTrue(req.description().contains("client_ouf"), "l'agent doit connaître l'auteur");
    }

    @Test
    @DisplayName("routage par entry.id : aucun canal pour ce compte IG → aucune tâche")
    void compteInconnuIgnore() throws Exception {
        // Sans ce routage, il suffirait de forger un entry.id pour faire créer
        // une tâche au nom du propriétaire du premier canal Instagram trouvé.
        String payload = commentPayload("179999999", "Bonjour");
        givenNothingSeenBefore();
        when(channelRepo.findFirstByAccountIdAndPlatformTypeAndStatusAndDeletedFalse(
                eq(IG_USER_ID), eq(PlatformType.INSTAGRAM), eq(ChannelStatus.CONNECTED)))
            .thenReturn(Optional.empty());

        ResponseEntity<String> r = instagram.receive(signature(payload), payload);

        assertEquals(HttpStatus.OK, r.getStatusCode());
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    @Test
    @DisplayName("un webhook de Page ne doit pas créer de tâche Instagram")
    void objetPageIgnore() throws Exception {
        // Meta peut router plusieurs objets vers la même URL d'application.
        // Confondre `page` et `instagram` enverrait des réponses Instagram à des
        // événements Facebook.
        String payload = """
            {"object":"page","entry":[{"id":"1181996944992363","changes":[
              {"field":"feed","value":{"item":"comment","verb":"add","comment_id":"c1",
               "post_id":"p1","message":"salut","from":{"id":"9","name":"Zoé"}}}]}]}
            """;
        givenConnectedChannel();
        givenNothingSeenBefore();

        ResponseEntity<String> r = instagram.receive(signature(payload), payload);

        assertEquals(HttpStatus.OK, r.getStatusCode());
        assertTrue(r.getBody().contains("ignored"));
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    // ── Variantes de payload ─────────────────────────────────────────────────

    @Test
    @DisplayName("variante comment_id (Instagram Login) : acceptée aussi")
    void varianteCommentIdAcceptee() throws Exception {
        // La clé est `id` sur Facebook Login for Business et `comment_id` sur
        // Instagram Login. Ne garder qu'un des deux raterait la moitié des Apps.
        String payload = """
            {"object":"instagram","entry":[{"id":"%s","changes":[
              {"field":"comments","value":{
                "comment_id":"180111111","text":"Merci !","parent_id":"180000000",
                "from":{"id":"17900","username":"client_merci"},
                "media":{"id":"17918195224117851"}}}]}]}
            """.formatted(IG_USER_ID);
        givenConnectedChannel();
        givenNothingSeenBefore();

        assertEquals(HttpStatus.OK, instagram.receive(signature(payload), payload).getStatusCode());
        verify(taskService).createTask(eq(OWNER), any(), any());
    }

    @Test
    @DisplayName("live_comments : même format, même traitement")
    void liveCommentsTraite() throws Exception {
        String payload = """
            {"object":"instagram","entry":[{"id":"%s","changes":[
              {"field":"live_comments","value":{
                "id":"180999999","text":"ça passe ?",
                "from":{"id":"17900","username":"spectateur"},
                "media":{"id":"17918195224999999","media_product_type":"STORY"}}}]}]}
            """.formatted(IG_USER_ID);
        givenConnectedChannel();
        givenNothingSeenBefore();

        assertEquals(HttpStatus.OK, instagram.receive(signature(payload), payload).getStatusCode());
        verify(taskService).createTask(eq(OWNER), any(), any());
    }

    @Test
    @DisplayName("champs sans action possible (mentions, story_insights) : ignorés")
    void champsIgnores() throws Exception {
        // `mentions` ne contient ni texte ni auteur : créer une tâche dessus
        // produirait une consigne « réponds à @inconnu ». `story_insights` n'a
        // rien à publier. Mieux vaut un 200 silencieux qu'une tâche inexploitable.
        String payload = """
            {"object":"instagram","entry":[{"id":"%s","changes":[
              {"field":"mentions","value":{"comment_id":"17894227972186120","media_id":"17918195224117851"}},
              {"field":"story_insights","value":{"media_id":"18023345989012587","reach":17,"exits":1}}]}]}
            """.formatted(IG_USER_ID);
        givenConnectedChannel();
        givenNothingSeenBefore();

        assertEquals(HttpStatus.OK, instagram.receive(signature(payload), payload).getStatusCode());
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    @Test
    @DisplayName("commentaire sans texte (réaction) : pas de tâche")
    void commentaireSansTexteIgnore() throws Exception {
        String payload = """
            {"object":"instagram","entry":[{"id":"%s","changes":[
              {"field":"comments","value":{"id":"180222222","text":"",
                "from":{"id":"17900","username":"x"},"media":{"id":"17918195224117851"}}}]}]}
            """.formatted(IG_USER_ID);
        givenConnectedChannel();
        givenNothingSeenBefore();

        assertEquals(HttpStatus.OK, instagram.receive(signature(payload), payload).getStatusCode());
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    // ── Dédoublonnage ────────────────────────────────────────────────────────

    @Test
    @DisplayName("Meta réémet le même commentaire → une seule tâche")
    void rejeuMetaDeduplique() throws Exception {
        String payload = commentPayload("179999999", "Bonjour");
        givenConnectedChannel();
        // Deuxième livraison du même événement : le marqueur partagé avec le
        // poller répond « déjà vu ».
        when(dedup.firstTime(eq(PlatformType.INSTAGRAM), eq("179999999")))
            .thenReturn(true, false);

        assertEquals(HttpStatus.OK, instagram.receive(signature(payload), payload).getStatusCode());
        assertEquals(HttpStatus.OK, instagram.receive(signature(payload), payload).getStatusCode());

        verify(taskService).createTask(eq(OWNER), any(), any());
    }

    // ── Sécurité ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("signature absente ou fausse → 403, aucune tâche")
    void signatureInvalideRefusee() throws Exception {
        String payload = commentPayload("179999999", "Bonjour");
        givenConnectedChannel();
        givenNothingSeenBefore();

        assertEquals(HttpStatus.FORBIDDEN, instagram.receive(null, payload).getStatusCode());
        assertEquals(HttpStatus.FORBIDDEN,
            instagram.receive("sha256=deadbeefdeadbeef", payload).getStatusCode());
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    @Test
    @DisplayName("payload Meta modifié après signature → 403")
    void payloadModifieRefuse() throws Exception {
        String original = commentPayload("179999999", "Bonjour");
        givenConnectedChannel();
        givenNothingSeenBefore();

        // Signature de la version d'origine appliquée à une version modifiée :
        // c'est exactement ce que ferait un attaquant qui rejoue un webhook.
        String forged = commentPayload("179999999", "virement 5000 EUR");

        assertEquals(HttpStatus.OK, instagram.receive(signature(original), original).getStatusCode());
        assertEquals(HttpStatus.FORBIDDEN, instagram.receive(signature(original), forged).getStatusCode());
    }

    @Test
    @DisplayName("handshake : bon jeton → challenge renvoyé")
    void handshakeValide() {
        ResponseEntity<String> r = instagram.verify("subscribe", "jeton-insta", "1158201444");

        assertEquals(HttpStatus.OK, r.getStatusCode());
        assertEquals("1158201444", r.getBody());
    }

    @Test
    @DisplayName("handshake : jeton absent de la config → 503, webhook fermé")
    void handshakeSansTokenFerme() {
        ReflectionTestUtils.setField(verifier, "instagramVerifyToken", "");

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE,
            instagram.verify("subscribe", "n'importe-quoi", "42").getStatusCode());
    }

    @Test
    @DisplayName("handshake : jeton erroné → 403")
    void handshakeJetonFauxRefuse() {
        assertEquals(HttpStatus.FORBIDDEN,
            instagram.verify("subscribe", "jeton-bidon", "42").getStatusCode());
    }

    // ── Webhook par canal ────────────────────────────────────────────────────

    @Test
    @DisplayName("/{channelId} : le verifyToken du canal est exigé au handshake")
    void handshakeParCanal() {
        Channel c = channel();
        when(channelRepo.findByIdAndDeletedFalse(CHANNEL_ID)).thenReturn(Optional.of(c));

        assertEquals(HttpStatus.OK,
            instagram.verifyPerChannel(CHANNEL_ID, "subscribe", "uuid-du-canal", "77").getStatusCode());
        assertEquals(HttpStatus.FORBIDDEN,
            instagram.verifyPerChannel(CHANNEL_ID, "subscribe", "jeton-global-fb", "77").getStatusCode());
    }

    @Test
    @DisplayName("/{channelId} : canal sans verifyToken lisible → 503, pas de repli ouvert")
    void handshakeParCanalConfigIllisible() {
        Channel c = channel();
        c.setConfig("{ ceci n'est pas du JSON");
        when(channelRepo.findByIdAndDeletedFalse(CHANNEL_ID)).thenReturn(Optional.of(c));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE,
            instagram.verifyPerChannel(CHANNEL_ID, "subscribe", "anything", "77").getStatusCode());
    }

    @Test
    @DisplayName("/{channelId} : canal inconnu → 404")
    void parCanalInconnu() {
        when(channelRepo.findByIdAndDeletedFalse("inexistant")).thenReturn(Optional.empty());

        assertEquals(HttpStatus.NOT_FOUND,
            instagram.receivePerChannel("inexistant", null, "{}").getStatusCode());
        assertEquals(HttpStatus.NOT_FOUND,
            instagram.verifyPerChannel("inexistant", "subscribe", "t", "c").getStatusCode());
    }

    @Test
    @DisplayName("/{channelId} : payload signé → tâche pour le canal visé")
    void parCanalTraite() throws Exception {
        String payload = commentPayload(IG_USER_ID, "Question sur la livraison");
        Channel c = channel();
        when(channelRepo.findByIdAndDeletedFalse(CHANNEL_ID)).thenReturn(Optional.of(c));
        givenNothingSeenBefore();

        assertEquals(HttpStatus.OK,
            instagram.receivePerChannel(CHANNEL_ID, signature(payload), payload).getStatusCode());
        verify(taskService).createTask(eq(OWNER), any(), any());
    }

    @Test
    @DisplayName("/{channelId} : signature vérifiée avec l'app-secret, jamais avec le jeton du canal")
    void parCanalSignatureAppSecret() throws Exception {
        // X-Hub-Signature-256 est signé par l'application Meta, pas par le
        // compte. Vérifier avec le token de page rendrait tous les webhooks
        // refusés — et il n'a de toute façon pas à être publié ici.
        String payload = commentPayload(IG_USER_ID, "Bonjour");
        Channel c = channel();
        when(channelRepo.findByIdAndDeletedFalse(CHANNEL_ID)).thenReturn(Optional.of(c));
        givenNothingSeenBefore();

        assertEquals(HttpStatus.FORBIDDEN,
            instagram.receivePerChannel(CHANNEL_ID, signature(payload, "jeton-de-page-au-hasard"), payload)
                .getStatusCode());
        assertEquals(HttpStatus.OK,
            instagram.receivePerChannel(CHANNEL_ID, signature(payload), payload).getStatusCode());
    }

    private static String signature(String payload, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "sha256=" + HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    @DisplayName("/{channelId} : événement d'un AUTRE compte IG → ignoré, aucune tâche")
    void parCanalRefuseUnAutreCompte() throws Exception {
        // L'URL par canal est saisie à la main dans le dashboard Meta : si
        // l'opérateur colle l'URL du canal A alors que l'application reçoit les
        // événements du compte B, l'agent A répondrait publiquement sur le compte B.
        String payload = commentPayloadFor("999999999999", "180000002", "Bonjour du compte B");
        when(channelRepo.findByIdAndDeletedFalse(CHANNEL_ID)).thenReturn(Optional.of(channel()));
        givenNothingSeenBefore();

        assertEquals(HttpStatus.OK,
            instagram.receivePerChannel(CHANNEL_ID, signature(payload), payload).getStatusCode());
        verify(taskService, never()).createTask(anyString(), any(), any());
    }

    @Test
    @DisplayName("payload : le texte du commentaire est échappé dans le JSON de la tâche")
    void echappeLeTexteDuCommentaire() throws Exception {
        // Un guillemet ou une backslash dans le commentaire casserait un JSON
        // construit par concaténation, et la tâche entière serait perdue.
        String payload = commentPayload("180000001", "Il dit \"livrez\" \\ vite");
        givenConnectedChannel();
        givenNothingSeenBefore();

        assertEquals(HttpStatus.OK, instagram.receive(signature(payload), payload).getStatusCode());

        ArgumentCaptor<CreateTaskRequest> captor = ArgumentCaptor.forClass(CreateTaskRequest.class);
        verify(taskService).createTask(eq(OWNER), captor.capture(), any());
        // Doit rester du JSON valide malgré les caractères spéciaux du commentaire.
        new ObjectMapper().readTree(captor.getValue().payload());
        new ObjectMapper().readTree(captor.getValue().contacts());
        assertTrue(captor.getValue().description().contains("\"livrez\""));
    }
}