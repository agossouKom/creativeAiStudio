package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.response.ChannelResponse;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.service.ChannelSenderService;
import com.creativeai.agentteam.service.ChannelService;
import com.creativeai.agentteam.service.FacebookCommentPollerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Gestion directe des commentaires Facebook — consultation et réponse sans passer par un agent IA.
 *
 * Prérequis : un canal SOCIAL_MEDIA / FACEBOOK CONNECTED doit exister pour l'agent ciblé.
 * Les credentials (Page Access Token) sont récupérées depuis le canal chiffré.
 *
 * <p><b>Contrôle d'accès.</b> Chaque endpoint commence par
 * {@link ChannelService#requireOwnedAgent} : les services sous-jacents
 * ({@code ChannelSenderService}, le poller) résolvent le canal par
 * {@code agentId} seul, donc sans ce garde-fou un utilisateur authentifié
 * pouvait lire, modifier, supprimer les publications — et réécrire le token de
 * la Page — d'un agent appartenant à quelqu'un d'autre, en devinant son
 * identifiant. Le refus est un 404 indistinguable d'un agent inexistant.
 */
@Slf4j
@Tag(name = "Facebook Comments", description = "Lecture et réponse aux commentaires d'une page Facebook")
@RestController
@RequestMapping("/api/facebook")
@RequiredArgsConstructor
public class FacebookCommentsController {

    private final ChannelSenderService channelSender;
    private final ChannelService        channelService;
    private final java.util.Optional<FacebookCommentPollerService> poller;

    /**
     * Vérifie que l'agent est bien celui de l'appelant. À appeler avant toute
     * délégation à un service qui résout le canal par agentId.
     */
    private void requireOwnership(String userId, String agentId) {
        channelService.requireOwnedAgent(userId, agentId);
    }

    /** Aucun canal Facebook CONNECTED pour cet agent (404 — même si l'agent existe). */
    private static final String FACEBOOK_CHANNEL_MISSING =
        "Aucun canal Facebook CONNECTED pour cet agent : connectez le compte avant d'agir sur ses commentaires.";

    /**
     * Refus propre quand l'agent n'a pas de canal Facebook CONNECTED.
     * Un 404, pas un 500 : l'absence de canal est un état du compte, pas une panne.
     */
    private boolean hasFacebookChannel(String userId, String agentId) {
        return channelService.listChannels(userId, agentId).stream()
            .anyMatch(channel -> channel.platformType() == PlatformType.FACEBOOK
                               && channel.status() == ChannelStatus.CONNECTED);
    }

    private ResponseEntity<Map<String, Object>> facebookChannelMissing() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
            "success", false, "error", FACEBOOK_CHANNEL_MISSING));
    }

    @Operation(
        summary = "Posts récents d'une page Facebook",
        description = "Retourne les posts publiés sur la page Facebook connectée à l'agent dans les dernières 24h (configurable via `sinceHours`)."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Liste de posts"),
        @ApiResponse(responseCode = "400", description = "Paramètre invalide"),
        @ApiResponse(responseCode = "404", description = "Aucun canal Facebook CONNECTED pour cet agent")
    })
    @GetMapping("/{agentId}/posts")
    public ResponseEntity<Map<String, Object>> getPosts(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent propriétaire du canal Facebook") @PathVariable String agentId,
            @Parameter(description = "Nombre d'heures en arrière (défaut 24, max 168 = 7 jours)", example = "24")
            @RequestParam(defaultValue = "24") int sinceHours,
            @Parameter(description = "Nombre max de posts (défaut 10, max 50)", example = "10")
            @RequestParam(defaultValue = "10") int limit) {

        requireOwnership(userId, agentId);

        sinceHours = Math.min(sinceHours, 168);
        limit      = Math.min(limit, 50);

        long sinceUnix = Instant.now().minusSeconds((long) sinceHours * 3600).getEpochSecond();

        log.info("[FB_COMMENTS_API] GET posts agentId={} sinceHours={} limit={}", agentId, sinceHours, limit);

        List<Map<String, Object>> posts = channelSender.fetchRecentFacebookPosts(agentId, sinceUnix, limit);
        return ResponseEntity.ok(Map.of(
            "agentId", agentId,
            "sinceHours", sinceHours,
            "count", posts.size(),
            "posts", posts
        ));
    }

    @Operation(
        summary = "Commentaires d'un post Facebook",
        description = "Retourne les commentaires d'un post donné via la Page Access Token du canal connecté."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Liste de commentaires"),
        @ApiResponse(responseCode = "404", description = "Aucun canal Facebook CONNECTED pour cet agent")
    })
    @GetMapping("/{agentId}/posts/{postId}/comments")
    public ResponseEntity<Map<String, Object>> getComments(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent") @PathVariable String agentId,
            @Parameter(description = "ID du post Facebook (format pageId_postId)", example = "1181996944992363_123456789")
            @PathVariable String postId,
            @Parameter(description = "Nombre max de commentaires (défaut 25, max 100)", example = "25")
            @RequestParam(defaultValue = "25") int limit) {

        requireOwnership(userId, agentId);

        limit = Math.min(limit, 100);

        log.info("[FB_COMMENTS_API] GET comments agentId={} postId={} limit={}", agentId, postId, limit);

        List<Map<String, Object>> comments = channelSender.fetchFacebookComments(agentId, postId, limit);
        return ResponseEntity.ok(Map.of(
            "agentId", agentId,
            "postId",  postId,
            "count",   comments.size(),
            "comments", comments
        ));
    }

    @Operation(summary = "Déclencher le scan des commentaires maintenant (bypass intervalle)")
    @PostMapping("/{agentId}/scan")
    public ResponseEntity<Map<String, Object>> triggerScan(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId) {
        requireOwnership(userId, agentId);
        if (poller.isEmpty())
            return ResponseEntity.ok(Map.of("message", "Polling désactivé (FACEBOOK_POLLING_ENABLED=false)", "newTasks", 0));
        if (!hasFacebookChannel(userId, agentId))
            return facebookChannelMissing();
        int channels = poller.get().triggerNow(agentId);
        if (channels == 0)
            return facebookChannelMissing();
        return ResponseEntity.ok(Map.of("message", "Scan lancé", "channelsScanned", channels));
    }

    @Operation(summary = "Scanner les commentaires d'un post spécifique (anciennes publications)")
    @PostMapping("/{agentId}/posts/{postId}/scan")
    public ResponseEntity<Map<String, Object>> scanPost(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId,
            @PathVariable String postId) {
        requireOwnership(userId, agentId);
        if (poller.isEmpty())
            return ResponseEntity.ok(Map.of("message", "Polling désactivé", "newTasks", 0));
        if (!hasFacebookChannel(userId, agentId))
            return facebookChannelMissing();
        int newTasks = poller.get().scanPost(agentId, postId);
        return ResponseEntity.ok(Map.of("postId", postId, "newTasksCreated", newTasks));
    }

    @Operation(
        summary = "Commenter un post Facebook",
        description = "Publie un commentaire sur un post (récent ou ancien) via son ID."
    )
    @PostMapping("/{agentId}/posts/{postId}/comment")
    public ResponseEntity<Map<String, Object>> commentOnPost(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId,
            @PathVariable String postId,
            @RequestBody Map<String, String> body) {

        requireOwnership(userId, agentId);

        String message = body != null ? body.get("message") : null;
        if (message == null || message.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Le champ 'message' est obligatoire"));
        if (!hasFacebookChannel(userId, agentId))
            return facebookChannelMissing();

        log.info("[FB_COMMENTS_API] COMMENT ON POST agentId={} postId={}", agentId, postId);

        ChannelSenderService.SendResult result =
                channelSender.commentOnFacebookPost(userId, agentId, postId, message);

        if (result.success())
            return ResponseEntity.ok(Map.of("success", true, "commentId", result.messageId() != null ? result.messageId() : ""));
        else
            return ResponseEntity.internalServerError()
                .body(Map.of("success", false, "error", result.error() != null ? result.error() : "Erreur inconnue"));
    }

    @Operation(summary = "Supprimer un post Facebook")
    @DeleteMapping("/{agentId}/posts/{postId}")
    public ResponseEntity<Map<String, Object>> deletePost(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId,
            @PathVariable String postId) {

        requireOwnership(userId, agentId);

        if (!hasFacebookChannel(userId, agentId))
            return facebookChannelMissing();

        log.info("[FB_COMMENTS_API] DELETE post agentId={} postId={}", agentId, postId);
        ChannelSenderService.SendResult result = channelSender.deleteFacebookPost(agentId, postId);
        if (result.success())
            return ResponseEntity.ok(Map.of("success", true, "postId", postId));
        return ResponseEntity.internalServerError()
            .body(Map.of("success", false, "error", result.error() != null ? result.error() : "Erreur inconnue"));
    }

    @Operation(summary = "Modifier le texte d'un post Facebook")
    @PatchMapping("/{agentId}/posts/{postId}")
    public ResponseEntity<Map<String, Object>> editPost(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId,
            @PathVariable String postId,
            @RequestBody Map<String, String> body) {

        requireOwnership(userId, agentId);

        String message = body != null ? body.get("message") : null;
        if (message == null || message.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Le champ 'message' est obligatoire"));
        if (!hasFacebookChannel(userId, agentId))
            return facebookChannelMissing();

        log.info("[FB_COMMENTS_API] EDIT post agentId={} postId={}", agentId, postId);
        ChannelSenderService.SendResult result = channelSender.editFacebookPost(agentId, postId, message);
        if (result.success())
            return ResponseEntity.ok(Map.of("success", true, "postId", postId));
        return ResponseEntity.internalServerError()
            .body(Map.of("success", false, "error", result.error() != null ? result.error() : "Erreur inconnue"));
    }

    @Operation(summary = "Renouveler le token Facebook (court → long durée → page token)")
    @PostMapping("/{agentId}/renew-token")
    public ResponseEntity<Map<String, Object>> renewToken(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId,
            @RequestBody Map<String, String> body) {

        requireOwnership(userId, agentId);

        String appId      = body != null ? body.get("appId")      : null;
        String appSecret  = body != null ? body.get("appSecret")  : null;
        String shortToken = body != null ? body.get("shortToken") : null;

        if (appId == null || appId.isBlank() || appSecret == null || appSecret.isBlank() || shortToken == null || shortToken.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "appId, appSecret et shortToken sont obligatoires"));

        log.info("[FB_RENEW] Demande renouvellement token agent={}", agentId);
        try {
            Map<String, Object> result = channelSender.renewFacebookToken(agentId, appId, appSecret, shortToken);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("[FB_RENEW] Échec renouvellement agent={}: {}", agentId, e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @Operation(
        summary = "Répondre à un commentaire Facebook",
        description = "Publie une réponse au nom de la page et archive dans l'inbox."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Réponse publiée"),
        @ApiResponse(responseCode = "400", description = "Paramètre manquant"),
        @ApiResponse(responseCode = "404", description = "Aucun canal Facebook CONNECTED")
    })
    @PostMapping("/{agentId}/comments/{commentId}/reply")
    public ResponseEntity<Map<String, Object>> reply(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent") @PathVariable String agentId,
            @Parameter(description = "ID du commentaire Facebook") @PathVariable String commentId,
            @RequestBody Map<String, String> body) {

        requireOwnership(userId, agentId);

        String message = body != null ? body.get("message") : null;
        if (message == null || message.isBlank()) {
            return ResponseEntity.badRequest()
                .body(Map.of("error", "Le champ 'message' est obligatoire"));
        }
        if (!hasFacebookChannel(userId, agentId)) {
            return facebookChannelMissing();
        }

        log.info("[FB_COMMENTS_API] REPLY agentId={} commentId={}", agentId, commentId);

        ChannelSenderService.SendResult result =
                channelSender.replyToFacebookComment(userId, agentId, commentId, message);

        if (result.success()) {
            return ResponseEntity.ok(Map.of(
                "success",   true,
                "replyId",   result.messageId() != null ? result.messageId() : "",
                "commentId", commentId
            ));
        } else {
            return ResponseEntity.internalServerError()
                .body(Map.of("success", false, "error", result.error() != null ? result.error() : "Erreur inconnue"));
        }
    }
}
