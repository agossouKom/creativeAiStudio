package com.creativeai.telegram.bot;

import com.creativeai.telegram.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Enregistre ou supprime le webhook Telegram au démarrage de l'application.
 *
 * Logique :
 *  - Si TELEGRAM_WEBHOOK_URL est défini  → setWebhook (mode webhook, pas de polling)
 *  - Si TELEGRAM_WEBHOOK_URL est vide    → deleteWebhook (libère Telegram pour le polling)
 *
 * Le TelegramPollingService vérifie lui-même si le webhook est actif
 * pour ne pas démarrer le polling en double.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TelegramWebhookRegistrar {

    private final AppProperties props;

    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build();

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        String token = props.telegram().botToken();
        if (token == null || token.isBlank()) {
            log.info("[WEBHOOK] TELEGRAM_BOT_TOKEN non défini — webhook ignoré");
            return;
        }

        String webhookUrl = props.telegram().webhookUrl();
        if (webhookUrl != null && !webhookUrl.isBlank()) {
            registerWebhook(token, webhookUrl);
        } else {
            deleteWebhook(token);
        }
    }

    private void registerWebhook(String token, String webhookUrl) {
        try {
            String secret = props.telegram().webhookSecret();
            String bodyJson = buildSetWebhookBody(webhookUrl, secret);

            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("https://api.telegram.org/bot" + token + "/setWebhook"))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(bodyJson))
                .build();

            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            log.info("[WEBHOOK] setWebhook → {} — {}", resp.statusCode(), resp.body());
        } catch (Exception e) {
            log.error("[WEBHOOK] setWebhook failed: {}", e.getMessage(), e);
        }
    }

    private void deleteWebhook(String token) {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("https://api.telegram.org/bot" + token + "/deleteWebhook"))
                .timeout(Duration.ofSeconds(10))
                .GET()
                .build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            log.info("[WEBHOOK] deleteWebhook → {} — mode long-polling activé", resp.statusCode());
        } catch (Exception e) {
            log.warn("[WEBHOOK] deleteWebhook failed: {} — le polling continuera quand même", e.getMessage());
        }
    }

    private String buildSetWebhookBody(String webhookUrl, String secret) {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"url\":\"").append(webhookUrl).append("\"");
        sb.append(",\"allowed_updates\":[\"message\",\"edited_message\",\"callback_query\"]");
        sb.append(",\"max_connections\":40");
        if (secret != null && !secret.isBlank()) {
            sb.append(",\"secret_token\":\"").append(secret).append("\"");
        }
        sb.append("}");
        return sb.toString();
    }
}
