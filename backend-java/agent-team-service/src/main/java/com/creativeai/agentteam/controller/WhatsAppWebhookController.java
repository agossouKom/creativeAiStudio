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
 * Reçoit les messages WhatsApp via Meta Business API webhook.
 *
 * 1. Vérification du webhook (GET) — challenge Meta
 * 2. Réception des messages (POST) → création de tâche
 *
 * Configuration Meta :
 *   - URL webhook : https://your-domain/api/whatsapp/webhook/{userId}
 *   - Token de vérification : valeur de whatsapp.verify-token dans application.yml
 *   - Événements souscrits : messages
 */
@Slf4j
@RestController
@RequestMapping("/api/whatsapp/webhook")
@RequiredArgsConstructor
public class WhatsAppWebhookController {

    private final TaskService  taskService;
    private final ObjectMapper objectMapper;

    @Value("${whatsapp.verify-token:creativeai-whatsapp-verify}")
    private String verifyToken;

    // ── Vérification Meta (handshake) ─────────────────────────────────────────

    @GetMapping("/{userId}")
    public ResponseEntity<String> verify(
            @PathVariable String userId,
            @RequestParam("hub.mode") String mode,
            @RequestParam("hub.verify_token") String token,
            @RequestParam("hub.challenge") String challenge) {

        if ("subscribe".equals(mode) && verifyToken.equals(token)) {
            log.info("[WHATSAPP] Webhook vérifié pour userId={}", userId);
            return ResponseEntity.ok(challenge);
        }

        log.warn("[WHATSAPP] Vérification échouée — token invalide userId={}", userId);
        return ResponseEntity.status(403).body("Forbidden");
    }

    // ── Réception des messages ────────────────────────────────────────────────

    @PostMapping("/{userId}")
    public ResponseEntity<String> receive(
            @PathVariable String userId,
            @RequestBody String payload) {

        try {
            JsonNode root = objectMapper.readTree(payload);

            // Structure Meta Business API : entry[].changes[].value.messages[]
            JsonNode entries = root.path("entry");
            if (entries.isMissingNode() || !entries.isArray()) {
                return ResponseEntity.ok("ok");
            }

            for (JsonNode entry : entries) {
                for (JsonNode change : entry.path("changes")) {
                    JsonNode value    = change.path("value");
                    JsonNode messages = value.path("messages");

                    if (!messages.isArray()) continue;

                    for (JsonNode msg : messages) {
                        String type = msg.path("type").asText("text");
                        if (!"text".equals(type)) continue;

                        String text = msg.path("text").path("body").asText("").trim();
                        String from = msg.path("from").asText("whatsapp");

                        if (text.isBlank()) continue;

                        log.info("[WHATSAPP] Message de {} pour userId={}: {}",
                                 from, userId, text.substring(0, Math.min(text.length(), 80)));

                        MessagingTaskParser.ParsedTask parsed = MessagingTaskParser.parse(text);

                        CreateTaskRequest req = new CreateTaskRequest(
                            parsed.title(),
                            parsed.description(),
                            parsed.taskType() != TaskType.GENERAL ? parsed.taskType() : TaskType.WHATSAPP_TASK,
                            parsed.priority(),
                            TaskSource.WEBHOOK,
                            null, null, null, null,
                            parsed.dueDate(),
                            null,
                            mergeContacts(from, parsed.contacts()),
                            parsed.expectedResult(),
                            parsed.confidential(),
                            null, null, null, null, null  // promotion produit
                        );

                        var task = taskService.createTask(userId, req, null);
                        log.info("[WHATSAPP] Tâche créée id={} title='{}' depuis WhatsApp {}",
                                 task.id(), task.title(), from);
                    }
                }
            }

            return ResponseEntity.ok("{\"status\":\"received\"}");

        } catch (Exception e) {
            log.error("[WHATSAPP] Erreur traitement webhook: {}", e.getMessage(), e);
            // Toujours retourner 200 pour éviter les retrys Meta
            return ResponseEntity.ok("{\"status\":\"error\"}");
        }
    }

    private String mergeContacts(String senderPhone, String parsedContacts) {
        if (parsedContacts != null && !parsedContacts.isBlank()) {
            return parsedContacts;
        }
        return senderPhone;
    }
}
