package com.creativeai.telegram.bot;

import com.creativeai.telegram.config.AppProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Tests de sécurité du webhook Telegram du service MCP.
 *
 * <p>Le service n'avait aucun Spring Security et le contrôle était
 * « vérifier le secret SI configuré ». Sur le VPS {@code TELEGRAM_WEBHOOK_SECRET}
 * est vide : toute POST non authentifiée déclenchait un appel LLM coûteux.
 */
class TelegramWebhookControllerTest {

    private UpdateDispatcher dispatcher;
    private TelegramWebhookController controller;

    private static final String BON_UPDATE = "{\"update_id\":42,\"message\":{\"text\":\"/start\"}}";

    private TelegramWebhookController avecSecret(String secret) {
        return new TelegramWebhookController(dispatcher, new ObjectMapper(),
            new AppProperties(null, null, null,
            new AppProperties.Telegram("bot-token", null, null, secret)));
    }

    @BeforeEach
    void setUp() {
        dispatcher = mock(UpdateDispatcher.class);
        controller = avecSecret("s3cr3t-telegram");
    }

    @Test
    @DisplayName("secret non configuré → 503, l'update n'est pas traitée")
    void secretAbsentFermeLEndpoint() {
        TelegramWebhookController nonConfigure = avecSecret("");

        ResponseEntity<Void> r = nonConfigure.receiveUpdate(BON_UPDATE, null);

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, r.getStatusCode());
        verifyNoInteractions(dispatcher);
    }

    @Test
    @DisplayName("secret null → 503")
    void secretNullFermeLEndpoint() {
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, avecSecret(null).receiveUpdate(BON_UPDATE, "x").getStatusCode());
        verifyNoInteractions(dispatcher);
    }

    @Test
    @DisplayName("en-tête absent alors que le secret est configuré → 403")
    void enTeteAbsentRefuse() {
        ResponseEntity<Void> r = controller.receiveUpdate(BON_UPDATE, null);

        assertEquals(HttpStatus.FORBIDDEN, r.getStatusCode());
        verifyNoInteractions(dispatcher);
    }

    @Test
    @DisplayName("secret erroné → 403")
    void secretErroneRefuse() {
        assertEquals(HttpStatus.FORBIDDEN, controller.receiveUpdate(BON_UPDATE, "mauvais").getStatusCode());
        assertEquals(HttpStatus.FORBIDDEN, controller.receiveUpdate(BON_UPDATE, "s3cr3t-telegram ").getStatusCode(),
            "pas d'espace final toléré");
        assertEquals(HttpStatus.FORBIDDEN, controller.receiveUpdate(BON_UPDATE, "S3CR3T-TELEGRAM").getStatusCode(),
            "comparaison sensible à la casse, comme le secret de Telegram");
        verifyNoInteractions(dispatcher);
    }

    @Test
    @DisplayName("préfixe du secret → 403 (pas de comparaison par suffixe)")
    void prefixeDuSecretRefuse() {
        assertEquals(HttpStatus.FORBIDDEN, controller.receiveUpdate(BON_UPDATE, "s3cr3t").getStatusCode());
        verifyNoInteractions(dispatcher);
    }

    @Test
    @DisplayName("secret valide → 200 et dispatch")
    void secretValideAccepte() throws Exception {
        ResponseEntity<Void> r = controller.receiveUpdate(BON_UPDATE, "s3cr3t-telegram");

        assertEquals(HttpStatus.OK, r.getStatusCode());
        assertNull(r.getBody());

        // Le dispatch part sur un thread virtuel : on l'attend au lieu de
        // rendre le test instable.
        long deadline = System.currentTimeMillis() + 3000;
        while (System.currentTimeMillis() < deadline) {
            try {
                verify(dispatcher).dispatch(any());
                return;
            } catch (AssertionError retry) {
                Thread.sleep(20);
            }
        }
        verify(dispatcher).dispatch(any());
    }

    @Test
    @DisplayName("corps illisible avec un secret valide → 400, pas de dispatch")
    void corpsIllisibleRefuse() {
        ResponseEntity<Void> r = controller.receiveUpdate("{pas-du-json", "s3cr3t-telegram");

        assertEquals(HttpStatus.BAD_REQUEST, r.getStatusCode());
        verify(dispatcher, never()).dispatch(any());
    }
}
