package com.creativeai.telegram.bot;

import com.creativeai.telegram.config.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

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
 * Sécurité : Telegram envoie X-Telegram-Bot-Api-Secret-Token, que le contrôleur
 *            exige. Sans TELEGRAM_WEBHOOK_SECRET configuré, l'endpoint refuse
 *            tout (fail-closed) et TelegramWebhookRegistrar n'enregistre pas de
 *            webhook — le service bascule alors en long-polling.
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

        // Avant : « vérifier le secret SI configuré ». Avec TELEGRAM_WEBHOOK_SECRET
        // vide — le cas sur le VPS — l'endpoint acceptait n'importe quelle POST, et
        // chaque update déclenchait un appel LLM et l'envoi d'un message Telegram
        // au nom du bot. Sans secret, l'endpoint est maintenant fermé (503) : une
        // signature qu'on ne peut pas vérifier ne vaut pas signature.
        String configuredSecret = props.telegram().webhookSecret();
        if (configuredSecret == null || configuredSecret.isBlank()) {
            log.error("[WEBHOOK] TELEGRAM_WEBHOOK_SECRET absent — webhook désactivé (fail-closed). "
                + "Reçu {} octets, NON traité.", body == null ? 0 : body.length());
            return ResponseEntity.status(503).build();
        }
        if (!MessageDigest.isEqual(
                configuredSecret.getBytes(StandardCharsets.UTF_8),
                secretToken == null ? new byte[0] : secretToken.getBytes(StandardCharsets.UTF_8))) {
            log.warn("[WEBHOOK] Requête rejetée — secret invalide");
            return ResponseEntity.status(403).build();
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
