package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.CreateTaskRequest;
import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.model.enums.Priority;
import com.creativeai.agentteam.model.enums.TaskSource;
import com.creativeai.agentteam.model.enums.TaskType;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.creativeai.agentteam.security.WebhookVerifier;
import com.creativeai.agentteam.service.TaskService;
import com.creativeai.agentteam.service.WebhookEventDeduplicator;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

/**
 * Reçoit les événements Instagram (Graph API, objet {@code instagram}).
 *
 * <p>Instagram n'a pas de webhook « à soi » : Meta poste sur l'URL déclarée dans
 * le produit <em>Webhooks</em> de l'application, avec l'objet {@code instagram}
 * comme {@code object} racine et l'identifiant du compte Instagram professionnel
 * comme {@code entry[].id}. Le contrôleur Facebook voisin ne peut donc pas les
 * traiter — il rejette explicitement tout {@code object != "page"}.
 *
 * <p>Configuration dans Meta App Dashboard → Webhooks :
 * <pre>
 *   Webhook URL   : {APP_PUBLIC_URL}/api/instagram/webhook
 *   Verify token  : INSTAGRAM_VERIFY_TOKEN (repli sur FACEBOOK_VERIFY_TOKEN)
 *   Subscriptions : Instagram Graph API → comments, live_comments
 * </pre>
 *
 * <p>URL par canal (multi-tenant) : {@code {APP_PUBLIC_URL}/api/instagram/webhook/{channelId}}
 * avec le {@code verifyToken} affiché dans Workspace → Canaux.
 *
 * <p><b>Champs volontairement ignorés</b> — ils exigent des permissions ou des
 * outils que l'agent n'a pas, et les traiter « à moitié » produirait des tâches
 * sans action possible :
 * <ul>
 *   <li>{@code mentions} : ne contient ni le texte ni l'auteur (Meta ne les
 *       transmet pas) ; les résoudre demande un appel Graph
 *       {@code /{ig-user-id}/mentioned_comment} et un outil de réponse dédié.</li>
 *   <li>{@code story_insights} : métriques agrégées d'une story expirée, sans
 *       action de publication possible.</li>
 *   <li>{@code entry[].messaging} (Messenger Platform) : messages privés, qui
 *       demandent {@code instagram_manage_messages}.</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/api/instagram/webhook")
@RequiredArgsConstructor
public class InstagramWebhookController {

    private final ChannelRepository        channelRepo;
    private final TaskService              taskService;
    private final ObjectMapper             objectMapper;
    private final WebhookVerifier          verifier;
    private final WebhookEventDeduplicator dedup;

    // ── Vérification Meta (handshake) ─────────────────────────────────────────

    @GetMapping
    public ResponseEntity<String> verify(
            @RequestParam("hub.mode")         String mode,
            @RequestParam("hub.verify_token") String token,
            @RequestParam("hub.challenge")    String challenge) {

        WebhookVerifier.Verdict verdict = verifier.checkInstagramToken(token);
        if (verdict == WebhookVerifier.Verdict.OK) {
            if (!"subscribe".equals(mode)) {
                log.warn("[INSTAGRAM_WEBHOOK] hub.mode inattendu : {}", mode);
                return ResponseEntity.status(403).body("Forbidden");
            }
            log.info("[INSTAGRAM_WEBHOOK] Webhook vérifié");
            return ResponseEntity.ok(challenge);
        }
        return verifier.refusalFor(verdict, "instagram/webhook");
    }

    // ── Réception des événements ──────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<String> receive(
            @RequestHeader(value = "X-Hub-Signature-256", required = false) String signature,
            @RequestBody String payload) {

        ResponseEntity<String> refusal = verifier.refusalFor(
            verifier.checkInstagramSignature(payload, signature), "instagram/webhook");
        if (refusal != null) {
            return refusal;
        }

        try {
            JsonNode root = objectMapper.readTree(payload);
            if (!"instagram".equals(root.path("object").asText())) {
                // Meta peut router plusieurs objets vers la même URL (une seule
                // application sert Facebook et Instagram) : ce qui n'est pas
                // Instagram appartient au contrôleur Facebook.
                return ResponseEntity.ok("{\"status\":\"ignored\"}");
            }

            for (JsonNode entry : root.path("entry")) {
                // entry.id = identifiant du compte Instagram professionnel.
                String igUserId = entry.path("id").asText();
                Channel channel = resolveChannelByIgAccount(igUserId);
                if (channel == null) {
                    log.warn("[INSTAGRAM_WEBHOOK] Aucun canal CONNECTED pour le compte IG {} — ignoré", igUserId);
                    continue;
                }
                handleChanges(entry, channel, igUserId);
            }

            // Toujours 200 une fois la signature validée : un 5xx ferait réémettre
            // l'événement par Meta en boucle.
            return ResponseEntity.ok("{\"status\":\"received\"}");

        } catch (Exception e) {
            log.error("[INSTAGRAM_WEBHOOK] Erreur traitement: {}", e.getMessage(), e);
            return ResponseEntity.ok("{\"status\":\"error\"}");
        }
    }

    // ── Webhook par canal (multi-tenant) ─────────────────────────────────────

    @GetMapping("/{channelId}")
    public ResponseEntity<String> verifyPerChannel(
            @PathVariable String channelId,
            @RequestParam("hub.mode")         String mode,
            @RequestParam("hub.verify_token") String token,
            @RequestParam("hub.challenge")    String challenge) {

        Optional<Channel> channelOpt = channelRepo.findByIdAndDeletedFalse(channelId);
        if (channelOpt.isEmpty()) {
            log.warn("[IG_WEBHOOK_CH] Canal introuvable : {}", channelId);
            return ResponseEntity.status(404).body("Channel not found");
        }

        WebhookVerifier.Verdict verdict =
            verifier.checkToken(token, extractVerifyToken(channelOpt.get().getConfig()));
        if (verdict == WebhookVerifier.Verdict.OK) {
            if (!"subscribe".equals(mode)) {
                log.warn("[IG_WEBHOOK_CH] hub.mode inattendu : {}", mode);
                return ResponseEntity.status(403).body("Forbidden");
            }
            log.info("[IG_WEBHOOK_CH] Webhook vérifié pour canal={}", channelId);
            return ResponseEntity.ok(challenge);
        }
        return verifier.refusalFor(verdict, "instagram/webhook/" + channelId);
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

        // Signature vérifiée avec l'APP-SECRET Meta, jamais avec le token du
        // canal : c'est Meta qui signe, avec les secrets de son application.
        ResponseEntity<String> refusal = verifier.refusalFor(
            verifier.checkMetaSignature(payload, signature, verifier.getInstagramAppSecret()),
            "instagram/webhook/" + channelId);
        if (refusal != null) {
            return refusal;
        }

        try {
            JsonNode root = objectMapper.readTree(payload);
            if (!"instagram".equals(root.path("object").asText())) {
                return ResponseEntity.ok("{\"status\":\"ignored\"}");
            }
            if (channel.getAgent() == null) {
                log.warn("[IG_WEBHOOK_CH] Canal {} sans agent — ignoré", channelId);
                return ResponseEntity.ok("{\"status\":\"no_agent\"}");
            }

            for (JsonNode entry : root.path("entry")) {
                String entryIgUserId = entry.path("id").asText();
                // Une URL par canal n'est qu'une URL déclarée à la main dans le
                // dashboard : si l'opérateur colle l'URL du canal A alors que
                // l'application reçoit les événements du compte B, on respondiórait
                // publiquement sur le mauvais compte. Le compte de l'événement
                // (entry.id) doit être celui du canal.
                if (!entryIgUserId.isBlank()
                        && channel.getAccountId() != null
                        && !entryIgUserId.equals(channel.getAccountId())) {
                    log.warn("[IG_WEBHOOK_CH] entry.id={} ≠ accountId={} du canal {} — ignoré",
                        entryIgUserId, channel.getAccountId(), channelId);
                    continue;
                }
                handleChanges(entry, channel, entryIgUserId);
            }
            return ResponseEntity.ok("{\"status\":\"received\"}");

        } catch (Exception e) {
            log.error("[IG_WEBHOOK_CH] Erreur traitement canal={}: {}", channelId, e.getMessage(), e);
            return ResponseEntity.ok("{\"status\":\"error\"}");
        }
    }

    // ── Traitement ───────────────────────────────────────────────────────────

    /**
     * Parcourt les {@code changes} d'une entrée et crée au plus une tâche
     * {@code SOCIAL_REPLY} par commentaire actionnable.
     */
    private void handleChanges(JsonNode entry, Channel channel, String igUserId) {
        for (JsonNode change : entry.path("changes")) {
            String field = change.path("field").asText();
            JsonNode value = change.path("value");

            // `comments` et `live_comments` partagent le même format de payload.
            if (!"comments".equals(field) && !"live_comments".equals(field)) {
                log.debug("[INSTAGRAM_WEBHOOK] Champ « {} » ignoré (non actionnable)", field);
                continue;
            }

            // Deux variantes coexistent selon le mode de login : la clé est
            // `id` (Facebook Login for Business / Instagram Login) ou
            // `comment_id` (envoi historique). On accepte les deux plutôt que
            // de rater silencieusement la moitié des Apps.
            String commentId = firstNonBlank(value.path("id").asText(null),
                                             value.path("comment_id").asText(null));
            String text      = value.path("text").asText("");
            String username  = value.path("from").path("username").asText("Inconnu");
            String authorId  = value.path("from").path("id").asText("");
            String mediaId   = value.path("media").path("id").asText("");

            if (commentId == null || text.isBlank()) {
                log.debug("[INSTAGRAM_WEBHOOK] Commentaire sans id ou sans texte — ignoré (media={})", mediaId);
                continue;
            }

            if (!dedup.firstTime(PlatformType.INSTAGRAM, commentId)) {
                log.info("[INSTAGRAM_WEBHOOK] Commentaire {} déjà traité — ignoré", commentId);
                continue;
            }

            log.info("[INSTAGRAM_WEBHOOK] Nouveau commentaire — igUserId={} mediaId={} commentId={} from=@{}",
                igUserId, mediaId, commentId, username);

            createReplyTask(channel, mediaId, commentId, text, username, authorId);
        }
    }

    private void createReplyTask(Channel channel, String mediaId, String commentId,
                                 String commentText, String username, String authorId) {

        String agentId = channel.getAgent() != null ? channel.getAgent().getId() : null;
        String userId  = channel.getAgent() != null ? channel.getAgent().getOwnerId() : null;
        if (agentId == null || userId == null) {
            log.warn("[INSTAGRAM_WEBHOOK] Canal {} sans agent/owner — tâche non créée", channel.getId());
            return;
        }

        String description = """
            Un nouveau commentaire a été posté sur votre publication Instagram.

            Média ID    : %s
            Commentaire : @%s
            Auteur (ID) : %s
            Message     : "%s"

            Réponds au commentaire de façon professionnelle, engageante et adaptée au ton de la marque.
            Utilise l'outil reply_instagram_comment avec commentId="%s".
            """.formatted(mediaId, username, authorId, commentText, commentId);

        // Construit via l'ObjectMapper plutôt qu'en concaténant : un pseudo ou un
        // id contenant un guillemet produirait du JSON invalide et ferait échouer
        // toute la création de tâche.
        ObjectNode payloadJson = objectMapper.createObjectNode();
        payloadJson.put("commentId", commentId);
        payloadJson.put("mediaId", mediaId);
        payloadJson.put("platform", "INSTAGRAM");

        ObjectNode contact = objectMapper.createObjectNode();
        contact.put("name", "@" + username);
        contact.put("instagramUsername", username);
        ArrayNode contacts = objectMapper.createArrayNode().add(contact);

        CreateTaskRequest req = new CreateTaskRequest(
            "Répondre au commentaire de @" + username,
            description,
            TaskType.SOCIAL_REPLY,
            Priority.HIGH,
            TaskSource.SOCIAL_MEDIA,
            agentId,
            null, null,
            payloadJson.toString(),
            null, null,
            contacts.toString(),
            "Réponse publiée au commentaire et archivée dans l'inbox",
            false,
            null, null, null, null, null
        );

        try {
            var task = taskService.createTask(userId, req, null);
            log.info("[INSTAGRAM_WEBHOOK] Tâche créée id={} agent={} pour commentId={}",
                task.id(), agentId, commentId);
        } catch (Exception e) {
            log.error("[INSTAGRAM_WEBHOOK] Échec création tâche commentId={}: {}", commentId, e.getMessage(), e);
        }
    }

    // ── Résolution du canal ──────────────────────────────────────────────────

    /**
     * Retrouve le canal Instagram professionnel correspondant au compte qui a
     * publié l'événement. L'OAuth enregistre l'id du compte IG dans
     * {@code accountId} (et non le pageId), ce qui est exactement la valeur de
     * {@code entry[].id}.
     */
    private Channel resolveChannelByIgAccount(String igUserId) {
        if (igUserId == null || igUserId.isBlank()) return null;
        return channelRepo.findFirstByAccountIdAndPlatformTypeAndStatusAndDeletedFalse(
            igUserId, PlatformType.INSTAGRAM, ChannelStatus.CONNECTED).orElse(null);
    }

    private String extractVerifyToken(String config) {
        if (config == null || config.isBlank()) return null;
        try {
            return objectMapper.readTree(config).path("verifyToken").asText(null);
        } catch (Exception e) {
            // Une config illisible rend le canal INDÉFINIMENT non vérifiable :
            // checkToken reçoit un null → NOT_CONFIGURED → endpoint désactivé.
            log.warn("[IG_WEBHOOK_CH] config de canal illisible, verifyToken indisponible : {}", e.getMessage());
            return null;
        }
    }

    private static String firstNonBlank(String... candidates) {
        for (String c : candidates) {
            if (c != null && !c.isBlank()) return c;
        }
        return null;
    }
}