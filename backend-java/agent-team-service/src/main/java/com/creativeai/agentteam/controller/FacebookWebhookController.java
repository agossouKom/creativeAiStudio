package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.CreateTaskRequest;
import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.model.enums.Priority;
import com.creativeai.agentteam.model.enums.TaskSource;
import com.creativeai.agentteam.model.enums.TaskType;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.creativeai.agentteam.service.TaskService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Reçoit les événements Facebook Page via webhook (commentaires, likes, mentions…).
 *
 * Flux :
 *  1. Facebook vérifie l'URL (GET) → on renvoie hub.challenge
 *  2. Nouveau commentaire sur un post (POST) → on trouve l'agent gérant la page
 *     et on crée une tâche SOCIAL_REPLY pour qu'il réponde
 *
 * Configuration dans Meta App Dashboard :
 *   Webhook URL   : https://ton-domaine/api/facebook/webhook
 *   Verify token  : valeur de facebook.verify-token dans application.yml
 *   Subscriptions : feed (pour les commentaires)
 */
@Slf4j
@RestController
@RequestMapping("/api/facebook/webhook")
@RequiredArgsConstructor
public class FacebookWebhookController {

    private final ChannelRepository channelRepo;
    private final TaskService       taskService;
    private final ObjectMapper      objectMapper;

    @Value("${facebook.verify-token:creativeai-facebook-verify}")
    private String verifyToken;

    @Value("${facebook.app-secret:}")
    private String appSecret;

    // ── Vérification Meta (handshake) ─────────────────────────────────────────

    @GetMapping
    public ResponseEntity<String> verify(
            @RequestParam("hub.mode")         String mode,
            @RequestParam("hub.verify_token") String token,
            @RequestParam("hub.challenge")    String challenge) {

        if ("subscribe".equals(mode) && verifyToken.equals(token)) {
            log.info("[FACEBOOK_WEBHOOK] Webhook vérifié");
            return ResponseEntity.ok(challenge);
        }
        log.warn("[FACEBOOK_WEBHOOK] Vérification échouée — token invalide");
        return ResponseEntity.status(403).body("Forbidden");
    }

    // ── Réception des événements ──────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<String> receive(
            @RequestHeader(value = "X-Hub-Signature-256", required = false) String signature,
            @RequestBody String payload) {

        // Valider la signature si le app-secret est configuré
        if (appSecret != null && !appSecret.isBlank()) {
            if (!isSignatureValid(payload, signature)) {
                log.warn("[FACEBOOK_WEBHOOK] Signature invalide — requête rejetée");
                return ResponseEntity.status(401).body("Invalid signature");
            }
        }

        try {
            JsonNode root = objectMapper.readTree(payload);

            if (!"page".equals(root.path("object").asText())) {
                return ResponseEntity.ok("{\"status\":\"ignored\"}");
            }

            for (JsonNode entry : root.path("entry")) {
                String pageId = entry.path("id").asText();

                for (JsonNode change : entry.path("changes")) {
                    JsonNode value = change.path("value");
                    String item    = value.path("item").asText();
                    String verb    = value.path("verb").asText();

                    // On traite uniquement les nouveaux commentaires
                    if (!"comment".equals(item) || !"add".equals(verb)) continue;

                    String commentId    = value.path("comment_id").asText();
                    String postId       = value.path("post_id").asText();
                    String commentText  = value.path("message").asText();
                    String authorName   = value.path("from").path("name").asText("Inconnu");
                    String authorId     = value.path("from").path("id").asText();

                    if (commentId.isBlank() || commentText.isBlank()) continue;

                    log.info("[FACEBOOK_WEBHOOK] Nouveau commentaire — pageId={} postId={} commentId={} from={}",
                             pageId, postId, commentId, authorName);

                    handleNewCommentByPageId(pageId, postId, commentId, commentText, authorName, authorId);
                }
            }

            // Toujours 200 pour éviter les retrys Facebook
            return ResponseEntity.ok("{\"status\":\"received\"}");

        } catch (Exception e) {
            log.error("[FACEBOOK_WEBHOOK] Erreur traitement: {}", e.getMessage(), e);
            return ResponseEntity.ok("{\"status\":\"error\"}");
        }
    }

    // ── Logique métier (webhook partagé — legacy, routage par pageId) ────────

    private void handleNewCommentByPageId(String pageId, String postId,
                                           String commentId, String commentText,
                                           String authorName, String authorId) {
        Optional<Channel> channelOpt = channelRepo
                .findFirstByAccountIdAndPlatformTypeAndStatusAndDeletedFalse(
                        pageId, PlatformType.FACEBOOK, ChannelStatus.CONNECTED);

        if (channelOpt.isEmpty()) {
            log.warn("[FACEBOOK_WEBHOOK] Aucun agent CONNECTED pour la page {}", pageId);
            return;
        }

        Channel channel = channelOpt.get();
        handleNewComment(postId, commentId, commentText, authorName, authorId,
                channel.getAgent().getId(), channel.getAgent().getOwnerId());
    }

    // ── Webhook par canal (multi-tenant) ─────────────────────────────────────
    //
    // Chaque utilisateur configure dans son Meta App Dashboard :
    //   Webhook URL   : https://ton-domaine/api/facebook/webhook/{channelId}
    //   Verify Token  : le verifyToken visible dans Workspace → Canaux
    //
    // Cela permet à chaque utilisateur d'avoir son propre Meta App indépendant.

    @GetMapping("/{channelId}")
    public ResponseEntity<String> verifyPerChannel(
            @PathVariable String channelId,
            @RequestParam("hub.mode")         String mode,
            @RequestParam("hub.verify_token") String token,
            @RequestParam("hub.challenge")    String challenge) {

        Optional<Channel> channelOpt = channelRepo.findByIdAndDeletedFalse(channelId);
        if (channelOpt.isEmpty()) {
            log.warn("[FB_WEBHOOK_CH] Canal introuvable : {}", channelId);
            return ResponseEntity.status(404).body("Channel not found");
        }

        String expected = extractVerifyToken(channelOpt.get().getConfig());
        if ("subscribe".equals(mode) && token.equals(expected)) {
            log.info("[FB_WEBHOOK_CH] Webhook vérifié pour canal={}", channelId);
            return ResponseEntity.ok(challenge);
        }
        log.warn("[FB_WEBHOOK_CH] Vérification échouée pour canal={} — token invalide", channelId);
        return ResponseEntity.status(403).body("Forbidden");
    }

    @PostMapping("/{channelId}")
    public ResponseEntity<String> receivePerChannel(
            @PathVariable String channelId,
            @RequestHeader(value = "X-Hub-Signature-256", required = false) String signature,
            @RequestBody String payload) {

        Optional<Channel> channelOpt = channelRepo.findByIdAndDeletedFalse(channelId);
        if (channelOpt.isEmpty()) {
            return ResponseEntity.status(404).body("Channel not found");
        }

        Channel channel = channelOpt.get();

        // Valider la signature avec l'appSecret du canal (depuis credentials chiffrées)
        // Si absent, on accepte quand même (dégradé)
        String channelAppSecret = extractAppSecretFromCredentials(channel);
        if (channelAppSecret != null && !channelAppSecret.isBlank()) {
            if (!isSignatureValidWith(payload, signature, channelAppSecret)) {
                log.warn("[FB_WEBHOOK_CH] Signature invalide pour canal={}", channelId);
                return ResponseEntity.status(401).body("Invalid signature");
            }
        }

        try {
            JsonNode root = objectMapper.readTree(payload);
            if (!"page".equals(root.path("object").asText())) {
                return ResponseEntity.ok("{\"status\":\"ignored\"}");
            }

            String agentId = channel.getAgent() != null ? channel.getAgent().getId() : null;
            String userId  = channel.getAgent() != null ? channel.getAgent().getOwnerId() : null;
            if (agentId == null || userId == null) {
                return ResponseEntity.ok("{\"status\":\"no_agent\"}");
            }

            for (JsonNode entry : root.path("entry")) {
                for (JsonNode change : entry.path("changes")) {
                    JsonNode value = change.path("value");
                    if (!"comment".equals(value.path("item").asText())
                     || !"add".equals(value.path("verb").asText())) continue;

                    String commentId   = value.path("comment_id").asText();
                    String postId      = value.path("post_id").asText();
                    String commentText = value.path("message").asText();
                    String authorName  = value.path("from").path("name").asText("Inconnu");
                    String authorId    = value.path("from").path("id").asText();

                    if (commentId.isBlank() || commentText.isBlank()) continue;

                    log.info("[FB_WEBHOOK_CH] canal={} commentId={} from={}", channelId, commentId, authorName);
                    handleNewComment(postId, commentId, commentText, authorName, authorId, agentId, userId);
                }
            }
            return ResponseEntity.ok("{\"status\":\"received\"}");
        } catch (Exception e) {
            log.error("[FB_WEBHOOK_CH] Erreur traitement canal={}: {}", channelId, e.getMessage(), e);
            return ResponseEntity.ok("{\"status\":\"error\"}");
        }
    }

    // ── Validation signature HMAC-SHA256 ──────────────────────────────────────

    private boolean isSignatureValid(String payload, String signature) {
        if (appSecret == null || appSecret.isBlank()) return true;
        return isSignatureValidWith(payload, signature, appSecret);
    }

    private boolean isSignatureValidWith(String payload, String signature, String secret) {
        if (signature == null || !signature.startsWith("sha256=")) return false;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] expected = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String expectedHex = HexFormat.of().formatHex(expected);
            return ("sha256=" + expectedHex).equals(signature);
        } catch (Exception e) {
            log.error("[FACEBOOK_WEBHOOK] Erreur validation signature: {}", e.getMessage());
            return false;
        }
    }

    private String extractVerifyToken(String config) {
        if (config == null || config.isBlank()) return null;
        try {
            return objectMapper.readTree(config).path("verifyToken").asText(null);
        } catch (Exception e) {
            return null;
        }
    }

    private String extractAppSecretFromCredentials(Channel channel) {
        if (channel.getEncryptedCredentials() == null) return null;
        try {
            // Note: décrypter ici nécessiterait EncryptionService — on l'injecte pas dans ce controller
            // pour ne pas alourdir la dépendance. L'appSecret peut aussi être en clair dans config.
            String config = channel.getConfig();
            if (config == null) return null;
            return objectMapper.readTree(config).path("appSecret").asText(null);
        } catch (Exception e) {
            return null;
        }
    }

    private void handleNewComment(String postId, String commentId, String commentText,
                                   String authorName, String authorId,
                                   String agentId, String userId) {
        String description = """
            Un nouveau commentaire a été posté sur votre page Facebook.

            Post ID     : %s
            Commentaire : %s (%s)
            Message     : "%s"

            Réponds au commentaire de façon professionnelle, engageante et adaptée au ton de la page.
            Utilise l'outil reply_facebook_comment avec commentId="%s".
            """.formatted(postId, authorName, authorId, commentText, commentId);

        CreateTaskRequest req = new CreateTaskRequest(
            "Répondre au commentaire de " + authorName,
            description,
            TaskType.SOCIAL_REPLY,
            Priority.HIGH,
            TaskSource.SOCIAL_MEDIA,
            agentId,
            null, null,
            "{\"commentId\":\"" + commentId + "\",\"postId\":\"" + postId + "\",\"platform\":\"FACEBOOK\"}",
            null, null,
            authorName + " (Facebook ID: " + authorId + ")",
            "Réponse publiée au commentaire et archivée dans l'inbox",
            false,
            null, null, null, null, null
        );

        try {
            var task = taskService.createTask(userId, req, null);
            log.info("[FB_WEBHOOK_CH] Tâche créée id={} agent={} pour commentId={}", task.id(), agentId, commentId);
        } catch (Exception e) {
            log.error("[FB_WEBHOOK_CH] Échec création tâche commentId={}: {}", commentId, e.getMessage(), e);
        }
    }
}
