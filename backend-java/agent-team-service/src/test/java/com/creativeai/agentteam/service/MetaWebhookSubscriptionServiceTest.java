package com.creativeai.agentteam.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.http.codec.FormHttpMessageWriter;
import org.springframework.http.codec.HttpMessageWriter;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.mock.http.client.reactive.MockClientHttpRequest;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserter;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

/**
 * L'étape « subscribed_apps » est celle que l'on oublie le plus souvent, et
 * son oubli est invisible : Meta continue d'afficher le webhook comme actif et ne
 * livre aucun événement. Ce test verrouille les deux propriétés qui la rendent
 * fiable — on appelle bien les DEUX objets, et un échec ne fait jamais échouer
 * une connexion OAuth déjà réussie.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MetaWebhookSubscriptionServiceTest {

    private static final String PAGE_ID  = "1181996944992363";
    private static final String IG_ID    = "17841405726653026";
    private static final String PAGE_TOK = "EAA-jeton-de-page";

    @Mock private SocialPlatformConfigService platformConfig;

    /** URLs réellement demandées à Meta, dans l'ordre. */
    private List<URI> calls;
    /** Corps des appels, pour vérifier ce que Meta reçoit réellement. */
    private List<MultiValueMap<String, String>> forms;
    private MetaWebhookSubscriptionService service;

    @BeforeEach
    void setUp() {
        calls = new ArrayList<>();
        forms = new ArrayList<>();
        when(platformConfig.graphBaseUrl("FACEBOOK")).thenReturn("https://graph.facebook.com/v24.0");
        service = new MetaWebhookSubscriptionService(graphAlwaysReturning(), platformConfig);
    }

    /** WebClient réel dont l'échange est intercepté : aucune URL n'est vraiment appelée. */
    private WebClient.Builder graphAlwaysReturning() {
        return graphReturning(HttpStatus.OK, "{\"success\":true}");
    }

    private WebClient.Builder graphReturning(HttpStatus status, String body) {
        return WebClient.builder().exchangeFunction(request -> {
            calls.add(request.url());
            forms.add(captureForm(request));
            return Mono.just(ClientResponse.create(status)
                .header("Content-Type", "application/json")
                .body(body)
                .build());
        });
    }

    /** Relit le formulaire envoyé dans le corps de la requête. */
    private MultiValueMap<String, String> captureForm(
            org.springframework.web.reactive.function.client.ClientRequest request) {
        MockClientHttpRequest captured =
            new MockClientHttpRequest(org.springframework.http.HttpMethod.POST, URI.create("/"));
        captured.getHeaders().addAll(request.headers());
        request.body().insert(captured, new BodyInserter.Context() {
            @Override public List<HttpMessageWriter<?>> messageWriters() {
                return List.of(new FormHttpMessageWriter());
            }
            @Override public Optional<ServerHttpRequest> serverRequest() { return Optional.empty(); }
            @Override public Map<String, Object> hints() { return Collections.emptyMap(); }
        }).block();
        String raw = captured.getBodyAsString().block();
        MultiValueMap<String, String> form = new org.springframework.util.LinkedMultiValueMap<>();
        for (String pair : raw.split("&")) {
            int eq = pair.indexOf('=');
            String key = eq < 0 ? pair : pair.substring(0, eq);
            String val = eq < 0 ? "" : pair.substring(eq + 1);
            form.add(java.net.URLDecoder.decode(key, StandardCharsets.UTF_8),
                java.net.URLDecoder.decode(val, StandardCharsets.UTF_8));
        }
        return form;
    }

    private void assertSubscribed(String objectId) {
        assertTrue(calls.stream().anyMatch(uri ->
                uri.getPath().equals("/v24.0/" + objectId + "/subscribed_apps")),
            "aucun appel subscribed_apps sur " + objectId + " (appels: " + calls + ")");
    }

    private void assertNotSubscribed(String objectId) {
        assertFalse(calls.stream().anyMatch(uri ->
                uri.getPath().equals("/v24.0/" + objectId + "/subscribed_apps")),
            "appel subscribed_apps inattendu sur " + objectId + " (appels: " + calls + ")");
    }

    // ── Ce qui doit être appelé ─────────────────────────────────────────────

    @Test
    @DisplayName("les champs demandés sont acceptés par Meta, et comments n'en fait pas partie")
    void champsDemandesValides() {
        service.subscribe(PAGE_ID, PAGE_TOK, IG_ID);

        // Meta rejette TOUT l'appel si un seul champ est inconnu (#100), et pour
        // une Page « comments » n'existe pas : les commentaires sur les posts
        // arrivent par « feed ». Vu en prod le 2026-10-03, l'abonnement était
        // refusé en silence et aucun événement n'arrivait.
        assertEquals("feed,mention", forms.get(0).getFirst("subscribed_fields"));
        assertEquals("comments,live_comments,mentions", forms.get(1).getFirst("subscribed_fields"));
        assertFalse(String.valueOf(forms.get(0).getFirst("subscribed_fields")).contains("comments"),
            "« comments » n'est pas un subscribed_field valide pour une Page");
    }

    @Test
    @DisplayName("la Page ET le compte Instagram sont abonnés")
    void abonneLesDeuxObjets() {
        assertTrue(service.subscribe(PAGE_ID, PAGE_TOK, IG_ID));

        // Sans l'appel sur l'IG, la moitié des notifications n'arriverait jamais :
        // c'est pourtant celui que l'endpoint /api/instagram/webhook attend.
        assertEquals(2, calls.size());
        assertSubscribed(PAGE_ID);
        assertSubscribed(IG_ID);
    }

    @Test
    @DisplayName("la Page est abonnée avant le compte IG")
    void ordreDesAppels() {
        service.subscribe(PAGE_ID, PAGE_TOK, IG_ID);

        assertEquals("/v24.0/" + PAGE_ID + "/subscribed_apps", calls.get(0).getPath());
        assertEquals("/v24.0/" + IG_ID + "/subscribed_apps", calls.get(1).getPath());
    }

    @Test
    @DisplayName("pas de compte IG rattaché → seul l'appel Page est fait")
    void abonneSeulementLaPage() {
        assertTrue(service.subscribe(PAGE_ID, PAGE_TOK, null));

        assertEquals(1, calls.size());
        assertNotSubscribed(IG_ID);
    }

    @Test
    @DisplayName("le jeton de l'APPLICATION ne remplace jamais le jeton de page")
    void utiliseLeJetonDePage() {
        service.subscribe(PAGE_ID, PAGE_TOK, IG_ID);

        // subscribed_apps est public et ne porte que le jeton du compte : c'est
        // ce qui permet de réabonner sans dupliquer de jeton dans notre base.
        for (URI uri : calls) {
            assertEquals("access_token=" + PAGE_TOK, uri.getQuery());
        }
    }

    // ── Échecs ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("jeton de page vide → aucun appel, échec signalé")
    void jetonVide() {
        assertFalse(service.subscribe(PAGE_ID, null, IG_ID));
        assertFalse(service.subscribe("", PAGE_TOK, IG_ID));

        assertTrue(calls.isEmpty(), "aucun appel ne doit partir sans jeton de page");
    }

    @Test
    @DisplayName("refus de Meta sur la Page → échec signalé, l'appel IG n'est pas tenté")
    void refusMeta() {
        service = new MetaWebhookSubscriptionService(
            graphReturning(HttpStatus.FORBIDDEN, "{\"error\":{\"message\":\"Unsupported get request.\"}}"),
            platformConfig);

        assertFalse(service.subscribe(PAGE_ID, PAGE_TOK, IG_ID));

        assertNotSubscribed(IG_ID);
    }

    @Test
    @DisplayName("Page OK mais IG refusée → échec signalé (l'agent ne répondrait pas sur Instagram)")
    void refusInstagramSeul() {
        int[] callCount = { 0 };
        WebClient.Builder builder = WebClient.builder().exchangeFunction(request -> {
            calls.add(request.url());
            // La Page passe, le compte IG est refusé.
            return callCount[0]++ == 0
                ? Mono.just(ClientResponse.create(HttpStatus.OK).body("{\"success\":true}").build())
                : Mono.just(ClientResponse.create(HttpStatus.FORBIDDEN)
                    .body("{\"error\":{\"message\":\"(#10)\"}}").build());
        });
        service = new MetaWebhookSubscriptionService(builder, platformConfig);

        assertFalse(service.subscribe(PAGE_ID, PAGE_TOK, IG_ID));
    }

    @Test
    @DisplayName("subscribeQuietly ne propage jamais une panne à l'appelant")
    void quietNeLevePas() {
        service = new MetaWebhookSubscriptionService(
            graphReturning(HttpStatus.INTERNAL_SERVER_ERROR, "oups"), platformConfig);

        // Doit rester silencieuse : l'utilisateur vient de connecter son compte,
        // faire échouer la connexion sur l'abonnement serait une régression.
        service.subscribeQuietly("INSTAGRAM", Map.of(
            "pageId", PAGE_ID, "accessToken", PAGE_TOK, "igUserId", IG_ID));

        // Un seul appel : la Page échoue, donc l'appel IG n'est même pas tenté.
        assertEquals(1, calls.size());
    }

    @Test
    @DisplayName("subscribeQuietly tolère des credentials absents ou vides")
    void quietTolereCredentialsVides() {
        service.subscribeQuietly("INSTAGRAM", Map.of());
        service.subscribeQuietly("INSTAGRAM", null);

        assertTrue(calls.isEmpty());
    }
}