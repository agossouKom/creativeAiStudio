package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.CreateTaskRequest;
import com.creativeai.agentteam.model.enums.TaskSource;
import com.creativeai.agentteam.model.enums.TaskType;
import com.creativeai.agentteam.service.TaskService;
import com.creativeai.agentteam.util.MessagingTaskParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Reçoit les mises à jour Telegram via webhook.
 * URL à enregistrer : POST /api/telegram/webhook/{userId}
 *
 * Configuration Telegram :
 *   POST https://api.telegram.org/bot{BOT_TOKEN}/setWebhook
 *   Body: { "url": "https://your-domain/api/telegram/webhook/{userId}" }
 */
@Slf4j
@RestController
@RequestMapping("/api/telegram/webhook")
@RequiredArgsConstructor
public class TelegramWebhookController {

    private final TaskService   taskService;
    private final ObjectMapper  objectMapper;

    @Value("${telegram.webhook-secret:}")
    private String webhookSecret;

    @PostMapping("/{userId}")
    public ResponseEntity<String> receive(
            @PathVariable String userId,
            @RequestHeader(value = "X-Telegram-Bot-Api-Secret-Token", required = false) String secret,
            @RequestBody String payload) {

        // Vérification optionnelle du secret
        if (!webhookSecret.isBlank() && !webhookSecret.equals(secret)) {
            log.warn("[TELEGRAM] Secret token invalide pour userId={}", userId);
            return ResponseEntity.status(403).body("Forbidden");
        }

        try {
            JsonNode root    = objectMapper.readTree(payload);
            JsonNode message = root.path("message");
            if (message.isMissingNode()) message = root.path("edited_message");
            if (message.isMissingNode()) {
                return ResponseEntity.ok("ok"); // callback_query ou autre — ignorer
            }

            String text = message.path("text").asText("").trim();
            if (text.isBlank()) {
                return ResponseEntity.ok("ok");
            }

            long chatId = message.path("chat").path("id").asLong();
            String from = message.path("from").path("username").asText(
                          message.path("from").path("first_name").asText("telegram"));

            log.info("[TELEGRAM] Message de @{} (chat={}) pour userId={}: {}",
                     from, chatId, userId, text.substring(0, Math.min(text.length(), 80)));

            MessagingTaskParser.ParsedTask parsed = MessagingTaskParser.parse(text);

            CreateTaskRequest req = new CreateTaskRequest(
                parsed.title(),
                parsed.description(),
                parsed.taskType() != TaskType.GENERAL ? parsed.taskType() : TaskType.TELEGRAM_TASK,
                parsed.priority(),
                TaskSource.WEBHOOK,
                null, null, null, null,
                parsed.dueDate(),
                null,
                parsed.contacts(),
                parsed.expectedResult(),
                parsed.confidential(),
                null, null, null, null, null  // promotion produit
            );

            var task = taskService.createTask(userId, req, null);

            log.info("[TELEGRAM] Tâche créée id={} title='{}' depuis Telegram chat={}",
                     task.id(), task.title(), chatId);

            return ResponseEntity.ok("{\"ok\":true,\"taskId\":\"" + task.id() + "\"}");

        } catch (Exception e) {
            log.error("[TELEGRAM] Erreur traitement webhook: {}", e.getMessage(), e);
            // Toujours retourner 200 pour que Telegram ne retente pas
            return ResponseEntity.ok("{\"ok\":false,\"error\":\"internal\"}");
        }
    }
}
