package com.creativeai.telegram.bot;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Envoie des messages vers l'API Telegram.
 * Utilise le WebClient dédié au bot (baseUrl déjà configurée avec le token).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TelegramSender {

    private final WebClient telegramWebClient;

    public void sendMessage(long chatId, String text) {
        sendMessage(chatId, text, "Markdown");
    }

    public void sendMessage(long chatId, String text, String parseMode) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("chat_id", chatId);
            payload.put("text",    truncate(text));
            if (parseMode != null && !parseMode.isBlank()) {
                payload.put("parse_mode", parseMode);
            }
            telegramWebClient.post()
                .uri("/sendMessage")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(String.class)
                .doOnError(e -> log.error("[TELEGRAM] sendMessage failed chatId={}: {}", chatId, e.getMessage()))
                .subscribe(r -> log.debug("[TELEGRAM] sendMessage ok chatId={}", chatId));
        } catch (Exception e) {
            log.error("[TELEGRAM] sendMessage error chatId={}: {}", chatId, e.getMessage());
        }
    }

    /**
     * Envoie un message avec un clavier inline (boutons cliquables).
     * rows : liste de lignes, chaque ligne est une liste de boutons { text, callback_data }.
     */
    public void sendWithKeyboard(long chatId, String text, List<List<Map<String, String>>> rows) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("chat_id",    chatId);
            payload.put("text",       truncate(text));
            payload.put("parse_mode", "Markdown");
            payload.put("reply_markup", Map.of("inline_keyboard", rows));

            telegramWebClient.post()
                .uri("/sendMessage")
                .bodyValue(payload)
                .exchangeToMono(response -> response.bodyToMono(String.class).defaultIfEmpty(""))
                .doOnNext(body -> {
                    if (body.contains("\"ok\":false")) {
                        log.error("[TELEGRAM] sendWithKeyboard 400 chatId={} body={}", chatId, body);
                        // Fallback : renvoyer sans clavier
                        sendMessage(chatId, text);
                    } else {
                        log.debug("[TELEGRAM] sendWithKeyboard ok chatId={}", chatId);
                    }
                })
                .onErrorResume(e -> {
                    log.error("[TELEGRAM] sendWithKeyboard error chatId={}: {}", chatId, e.getMessage());
                    sendMessage(chatId, text);
                    return reactor.core.publisher.Mono.empty();
                })
                .subscribe();
        } catch (Exception e) {
            log.error("[TELEGRAM] sendWithKeyboard error chatId={}: {}", chatId, e.getMessage());
        }
    }

    /** Répond à un callback_query pour supprimer le spinner de chargement. */
    public void answerCallback(String callbackId) {
        try {
            telegramWebClient.post()
                .uri("/answerCallbackQuery")
                .bodyValue(Map.of("callback_query_id", callbackId))
                .retrieve()
                .bodyToMono(String.class)
                .onErrorResume(e -> reactor.core.publisher.Mono.empty())
                .subscribe();
        } catch (Exception ignored) {}
    }

    public void sendTyping(long chatId) {
        try {
            telegramWebClient.post()
                .uri("/sendChatAction")
                .bodyValue(Map.of("chat_id", chatId, "action", "typing"))
                .retrieve()
                .bodyToMono(String.class)
                .subscribe();
        } catch (Exception ignored) {}
    }

    private String truncate(String text) {
        if (text == null) return "(réponse vide)";
        return text.length() > 4000 ? text.substring(0, 3997) + "…" : text;
    }
}
