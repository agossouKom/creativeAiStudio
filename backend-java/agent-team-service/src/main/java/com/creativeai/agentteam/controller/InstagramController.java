package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.service.InstagramCommentPollerService;
import com.creativeai.agentteam.service.InstagramService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Gestion des publications et commentaires Instagram.
 * Prérequis : canal SOCIAL_MEDIA / INSTAGRAM CONNECTED avec credentials {accessToken, igUserId}.
 */
@Slf4j
@Tag(name = "Instagram", description = "Publication et gestion des commentaires Instagram")
@RestController
@RequestMapping("/api/instagram")
@RequiredArgsConstructor
public class InstagramController {

    private final InstagramService                            instagramService;
    private final java.util.Optional<InstagramCommentPollerService> poller;

    // ── Médias récents ──────────────────────────────────────────────────────────

    @Operation(summary = "Médias récents du compte Instagram connecté")
    @GetMapping("/{agentId}/media")
    public ResponseEntity<Map<String, Object>> getMedia(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId,
            @RequestParam(defaultValue = "10") int limit) {

        log.info("[IG_API] GET media agentId={} limit={}", agentId, limit);
        List<Map<String, Object>> media = instagramService.fetchRecentMedia(agentId, limit);
        return ResponseEntity.ok(Map.of(
            "agentId", agentId,
            "count",   media.size(),
            "media",   media
        ));
    }

    // ── Commentaires ────────────────────────────────────────────────────────────

    @Operation(summary = "Commentaires d'un média Instagram")
    @GetMapping("/{agentId}/media/{mediaId}/comments")
    public ResponseEntity<Map<String, Object>> getComments(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId,
            @PathVariable String mediaId,
            @RequestParam(defaultValue = "25") int limit) {

        log.info("[IG_API] GET comments agentId={} mediaId={} limit={}", agentId, mediaId, limit);
        List<Map<String, Object>> comments = instagramService.fetchComments(agentId, mediaId, limit);
        return ResponseEntity.ok(Map.of(
            "agentId",  agentId,
            "mediaId",  mediaId,
            "count",    comments.size(),
            "comments", comments
        ));
    }

    // ── Répondre à un commentaire ───────────────────────────────────────────────

    @Operation(summary = "Répondre à un commentaire Instagram")
    @PostMapping("/{agentId}/comments/{commentId}/reply")
    public ResponseEntity<Map<String, Object>> reply(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId,
            @PathVariable String commentId,
            @RequestBody Map<String, String> body) {

        String message = body != null ? body.get("message") : null;
        if (message == null || message.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Le champ 'message' est obligatoire"));

        log.info("[IG_API] REPLY agentId={} commentId={}", agentId, commentId);
        try {
            String replyId = instagramService.replyToComment(agentId, commentId, message);
            return ResponseEntity.ok(Map.of("success", true, "replyId", replyId != null ? replyId : ""));
        } catch (Exception e) {
            log.error("[IG_API] Erreur reply: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    // ── Commenter un média ──────────────────────────────────────────────────────

    @Operation(summary = "Publier un commentaire sur un média Instagram")
    @PostMapping("/{agentId}/media/{mediaId}/comment")
    public ResponseEntity<Map<String, Object>> commentOnMedia(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId,
            @PathVariable String mediaId,
            @RequestBody Map<String, String> body) {

        String message = body != null ? body.get("message") : null;
        if (message == null || message.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Le champ 'message' est obligatoire"));

        log.info("[IG_API] COMMENT ON MEDIA agentId={} mediaId={}", agentId, mediaId);
        try {
            String commentId = instagramService.commentOnMedia(agentId, mediaId, message);
            return ResponseEntity.ok(Map.of("success", true, "commentId", commentId != null ? commentId : ""));
        } catch (Exception e) {
            log.error("[IG_API] Erreur comment: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    // ── Supprimer un média ──────────────────────────────────────────────────────

    @Operation(summary = "Supprimer une publication Instagram")
    @DeleteMapping("/{agentId}/media/{mediaId}")
    public ResponseEntity<Map<String, Object>> deleteMedia(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId,
            @PathVariable String mediaId) {

        log.info("[IG_API] DELETE media agentId={} mediaId={}", agentId, mediaId);
        try {
            boolean ok = instagramService.deleteMedia(agentId, mediaId);
            if (ok) return ResponseEntity.ok(Map.of("success", true, "mediaId", mediaId));
            return ResponseEntity.internalServerError().body(Map.of("success", false, "error", "Échec suppression Instagram"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    // ── Publier ─────────────────────────────────────────────────────────────────

    @Operation(summary = "Publier sur Instagram (image ou vidéo)")
    @PostMapping("/{agentId}/publish")
    public ResponseEntity<Map<String, Object>> publish(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId,
            @RequestBody Map<String, Object> body) {

        String caption = (String) body.getOrDefault("caption", "");
        @SuppressWarnings("unchecked")
        List<String> mediaUrls = body.get("mediaUrls") instanceof List<?> list
            ? (List<String>) list : List.of();

        log.info("[IG_API] PUBLISH agentId={} mediaUrls={}", agentId, mediaUrls.size());
        try {
            String mediaId = instagramService.publish(agentId, caption, mediaUrls);
            return ResponseEntity.ok(Map.of("success", true, "mediaId", mediaId != null ? mediaId : ""));
        } catch (Exception e) {
            log.error("[IG_API] Erreur publish: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    // ── Auto-fetch igUserId ──────────────────────────────────────────────────────

    @Operation(summary = "Récupérer l'igUserId depuis un Page ID + Access Token")
    @PostMapping("/fetch-ig-user-id")
    public ResponseEntity<Map<String, Object>> fetchIgUserId(
            @AuthenticationPrincipal String userId,
            @RequestBody Map<String, String> body) {

        String pageId      = body != null ? body.get("pageId")      : null;
        String accessToken = body != null ? body.get("accessToken") : null;

        if (pageId == null || pageId.isBlank() || accessToken == null || accessToken.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "pageId et accessToken sont obligatoires"));

        try {
            String igUserId = instagramService.fetchIgUserIdFromPage(pageId, accessToken);
            return ResponseEntity.ok(Map.of("igUserId", igUserId, "pageId", pageId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ── Scan manuel ─────────────────────────────────────────────────────────────

    @Operation(summary = "Déclencher le scan des commentaires Instagram (bypass intervalle)")
    @PostMapping("/{agentId}/scan")
    public ResponseEntity<Map<String, Object>> triggerScan(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId) {

        if (poller.isEmpty())
            return ResponseEntity.ok(Map.of("message", "Polling désactivé (instagram.polling-enabled=false)", "newTasks", 0));
        int newTasks = poller.get().triggerNow(agentId);
        return ResponseEntity.ok(Map.of("message", "Scan lancé", "newTasksCreated", newTasks));
    }

    @Operation(summary = "Scanner les commentaires d'un média spécifique")
    @PostMapping("/{agentId}/media/{mediaId}/scan")
    public ResponseEntity<Map<String, Object>> scanMedia(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId,
            @PathVariable String mediaId) {

        if (poller.isEmpty())
            return ResponseEntity.ok(Map.of("message", "Polling désactivé", "newTasks", 0));
        int newTasks = poller.get().scanMedia(agentId, mediaId);
        return ResponseEntity.ok(Map.of("mediaId", mediaId, "newTasksCreated", newTasks));
    }
}
