package com.creativeai.telegram.bot;

import com.creativeai.telegram.config.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Endpoint Telegram Webhook — reçoit les updates via POST HTTPS.
 *
 * Avantages vs long-polling :
 *  - Latence quasi-nulle (push immédiat de Telegram)
 *  - Aucune connexion persistante → moins de charge réseau/CPU
 *  - Compatible avec les proxies et CDN
 *
 * Activation : définir TELEGRAM_WEBHOOK_URL dans .env.
 *              Laisser vide → TelegramPollingService prend le relai automatiquement.
 *
 * Sécurité : Telegram envoie X-Telegram-Bot-Api-Secret-Token si configuré.
 *            Le contrôleur vérifie ce token avant de dispatcher l'update.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/telegram/webhook")
public class TelegramWebhookController {

    private final UpdateDispatcher dispatcher;
    private final ObjectMapper     objectMapper;
    private final AppProperties    props;

    @PostMapping
    public ResponseEntity<Void> receiveUpdate(
            @RequestBody String body,
            @RequestHeader(value = "X-Telegram-Bot-Api-Secret-Token", required = false) String secretToken) {

        // Vérification du secret si configuré
        String configuredSecret = props.telegram().webhookSecret();
        if (configuredSecret != null && !configuredSecret.isBlank()) {
            if (!configuredSecret.equals(secretToken)) {
                log.warn("[WEBHOOK] Requête rejetée — secret invalide");
                return ResponseEntity.status(403).build();
            }
        }

        try {
            JsonNode update = objectMapper.readTree(body);
            long updateId = update.path("update_id").asLong(-1);
            log.debug("[WEBHOOK] Update reçu update_id={}", updateId);

            // Dispatch sur thread virtuel — libère le thread HTTP immédiatement
            // Telegram attend un 200 OK sous 10s, sinon il réessaie
            Thread.ofVirtual()
                .name("tg-webhook-" + updateId)
                .start(() -> {
                    try {
                        dispatcher.dispatch(update);
                    } catch (Exception e) {
                        log.error("[WEBHOOK] Dispatch error update_id={}: {}", updateId, e.getMessage(), e);
                    }
                });

            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("[WEBHOOK] Parse error: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }
}
