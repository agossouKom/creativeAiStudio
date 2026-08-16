package com.creativeai.telegram.bot;

import com.creativeai.telegram.config.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Long-polling Telegram via java.net.HttpClient (synchrone, aucune dépendance Reactor).
 * Démarre sur un virtual thread Java 21 — SmartLifecycle pour démarrage/arrêt propre.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TelegramPollingService implements SmartLifecycle {

    private static final int POLLING_TIMEOUT_SEC = 30;

    private final AppProperties    props;
    private final UpdateDispatcher dispatcher;
    private final ObjectMapper     objectMapper;

    private final AtomicBoolean running   = new AtomicBoolean(false);
    private final AtomicLong    offset    = new AtomicLong(0);
    private final AtomicLong    pollCount = new AtomicLong(0);
    private Thread              pollingThread;

    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build();

    @Override
    public void start() {
        // Webhook actif → pas de polling (deux modes sont exclusifs)
        String webhookUrl = props.telegram().webhookUrl();
        if (webhookUrl != null && !webhookUrl.isBlank()) {
            log.info("[POLLING] Webhook configuré ({}) — long-polling désactivé", webhookUrl);
            return;
        }
        running.set(true);
        registerCommands();
        pollingThread = Thread.ofVirtual().name("telegram-polling").start(this::pollingLoop);
        log.info("[POLLING] Telegram long-polling démarré (bot=@{})", props.telegram().botName());
    }

    private void registerCommands() {
        try {
            String base = "https://api.telegram.org/bot" + props.telegram().botToken();
            String body = """
                {
                  "commands": [
                    {"command":"start",   "description":"👋 Message de bienvenue"},
                    {"command":"link",    "description":"🔗 Lier votre compte CreativeAI Studio"},
                    {"command":"unlink",  "description":"🔓 Délier votre compte"},
                    {"command":"newtask", "description":"📋 Créer une nouvelle tâche (formulaire guidé)"},
                    {"command":"tasks",   "description":"📄 Lister vos tâches (ex: /tasks pending)"},
                    {"command":"task",    "description":"🔍 Détail d'une tâche par code 6 chiffres"},
                    {"command":"agents",  "description":"🤖 Lister vos agents IA"},
                    {"command":"agent",   "description":"🔍 Détail d'un agent par code 6 chiffres"},
                    {"command":"chat",    "description":"💬 Discuter avec un agent (/chat <code> <msg>)"},
                    {"command":"clear",   "description":"🔄 Effacer l'historique de conversation"},
                    {"command":"menu",    "description":"📌 Afficher toutes les commandes disponibles"},
                    {"command":"annuler", "description":"❌ Annuler l'opération en cours"}
                  ]
                }
                """;
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(base + "/setMyCommands"))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            log.info("[POLLING] setMyCommands → {}", resp.body());
        } catch (Exception e) {
            log.warn("[POLLING] setMyCommands failed: {}", e.getMessage());
        }
    }

    @Override
    public void stop() {
        running.set(false);
        if (pollingThread != null) pollingThread.interrupt();
        log.info("[POLLING] Telegram long-polling arrêté");
    }

    @Override
    public boolean isRunning() { return running.get(); }

    // ── Boucle principale ─────────────────────────────────────────────────────

    private void pollingLoop() {
        String base = "https://api.telegram.org/bot" + props.telegram().botToken();
        log.info("[POLLING] Base URL: {}/getUpdates", base);

        while (running.get() && !Thread.currentThread().isInterrupted()) {
            try {
                String url = base + "/getUpdates?offset=" + offset.get()
                           + "&timeout=" + POLLING_TIMEOUT_SEC
                           + "&allowed_updates=%5B%22message%22%2C%22edited_message%22%2C%22callback_query%22%5D";

                HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(POLLING_TIMEOUT_SEC + 10))
                    .GET()
                    .build();

                HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());

                if (resp.statusCode() != 200) {
                    log.warn("[POLLING] HTTP {} — body: {}", resp.statusCode(),
                             resp.body().substring(0, Math.min(resp.body().length(), 200)));
                    sleep(3_000);
                    continue;
                }

                JsonNode root    = objectMapper.readTree(resp.body());
                JsonNode updates = root.path("result");

                if (!updates.isArray()) continue;

                int count = updates.size();
                long n = pollCount.incrementAndGet();
                if (count > 0) {
                    log.info("[POLLING] poll#{} offset={} — {} update(s) reçu(s)", n, offset.get(), count);
                } else if (n % 5 == 0) {
                    log.info("[POLLING] poll#{} offset={} — en attente de messages…", n, offset.get());
                }

                for (JsonNode update : updates) {
                    long updateId = update.path("update_id").asLong();
                    offset.set(updateId + 1);

                    Thread.ofVirtual()
                        .name("tg-dispatch-" + updateId)
                        .start(() -> {
                            try {
                                dispatcher.dispatch(update);
                            } catch (Exception e) {
                                log.error("[POLLING] Dispatch error {}: {}", updateId, e.getMessage(), e);
                            }
                        });
                }

            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                if (running.get()) {
                    log.warn("[POLLING] Erreur, retry dans 5s: {}", e.getMessage());
                    sleep(5_000);
                }
            }
        }
    }

    @SuppressWarnings("java:S2142")
    private void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }
}
