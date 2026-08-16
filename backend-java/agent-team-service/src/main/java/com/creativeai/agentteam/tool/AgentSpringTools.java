package com.creativeai.agentteam.tool;

import com.creativeai.agentteam.service.MediaSecurityService;
import com.creativeai.agentteam.service.MinioService;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Pont entre Spring AI function calling et les AgentTool existants.
 *
 * Chaque méthode @Tool :
 *  - déclare des paramètres typés → Spring AI génère le JSON Schema pour le LLM
 *  - récupère agentId/userId via AgentContext (ThreadLocal posé par l'orchestrateur)
 *  - délègue l'exécution au ToolRegistry (implémentation existante inchangée)
 *
 * Pour ajouter un nouvel outil : implémenter AgentTool + ajouter une méthode @Tool ici.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AgentSpringTools {

    private final ToolRegistry         toolRegistry;
    private final MinioService         minioService;
    private final MediaSecurityService mediaSecurity;

    // ── Input records (Spring AI génère le JSON Schema depuis les champs) ──────

    record SendEmailInput(
        @JsonPropertyDescription("Adresse email du destinataire (une seule adresse par appel)")
        String to,
        @JsonPropertyDescription("Objet de l'email")
        String subject,
        @JsonPropertyDescription("Corps de l'email (texte brut ou Markdown)")
        String body,
        @JsonPropertyDescription("ID de conversation pour regrouper les échanges (optionnel)")
        String conversationId
    ) {}

    record CreateTaskInput(
        @JsonPropertyDescription("Titre court et descriptif de la tâche")
        String title,
        @JsonPropertyDescription("Description détaillée de la tâche")
        String description,
        @JsonPropertyDescription("Priorité : LOW | MEDIUM | HIGH | CRITICAL")
        String priority,
        @JsonPropertyDescription("ID de l'agent destinataire (optionnel — auto si absent)")
        String assignedAgentId
    ) {}

    record DelegateToAgentInput(
        @JsonPropertyDescription("ID de l'agent à qui déléguer la tâche")
        String targetAgentId,
        @JsonPropertyDescription("Instruction complète à transmettre à l'agent")
        String message,
        @JsonPropertyDescription("Titre descriptif de la tâche (optionnel)")
        String taskTitle,
        @JsonPropertyDescription("ID de la tâche patron associée (optionnel)")
        String parentTaskId
    ) {}

    record DeliverResultInput(
        @JsonPropertyDescription("ID de la tâche à clôturer (optionnel)")
        String taskId,
        @JsonPropertyDescription("Titre / objet du rapport de clôture")
        String title,
        @JsonPropertyDescription("Résumé du résultat exécuté")
        String result,
        @JsonPropertyDescription("Statut final : DONE | FAILED")
        String status
    ) {}

    record PostSocialInput(
        @JsonPropertyDescription("Plateforme cible : INSTAGRAM | LINKEDIN | TWITTER_X | FACEBOOK | TIKTOK | SLACK | TELEGRAM")
        String platform,
        @JsonPropertyDescription("Texte du post (hashtags et emojis autorisés)")
        String content,
        @JsonPropertyDescription("URLs des médias à joindre (optionnel, peut être null ou liste vide)")
        List<String> mediaUrls
    ) {}

    record SearchTasksInput(
        @JsonPropertyDescription("Filtrer par statut : PENDING | IN_PROGRESS | DONE | FAILED (optionnel)")
        String status,
        @JsonPropertyDescription("Nombre maximum de résultats (défaut : 10)")
        Integer limit
    ) {}

    record SelectAgentInput(
        @JsonPropertyDescription("Type d'agent requis : EMAIL_MANAGER | COMMUNITY_MANAGER | MARKETING | CUSTOMER_SUPPORT | PROSPECTION | CREATIVE_LEAD | RAG_DOCUMENT | SCRUM_MASTER (optionnel)")
        String agentType,
        @JsonPropertyDescription("Description de la tâche pour affiner la sélection (optionnel)")
        String taskDescription,
        @JsonPropertyDescription("ID d'équipe pour restreindre la recherche (optionnel)")
        String teamId
    ) {}

    record UpdateTaskStatusInput(
        @JsonPropertyDescription("UUID de la tâche à mettre à jour")
        String taskId,
        @JsonPropertyDescription("Nouveau statut : IN_PROGRESS | DONE | FAILED | CANCELLED")
        String status,
        @JsonPropertyDescription("Message d'erreur si status=FAILED (optionnel)")
        String errorMessage
    ) {}

    record SendWhatsappInput(
        @JsonPropertyDescription("Numéro de téléphone international (ex: +33612345678)")
        String to,
        @JsonPropertyDescription("Texte du message (max 4096 caractères)")
        String body,
        @JsonPropertyDescription("ID de conversation pour regrouper les échanges (optionnel)")
        String conversationId
    ) {}

    record CreateAgentInput(
        @JsonPropertyDescription("Type d'agent : SCRUM_MASTER | EMAIL_MANAGER | COMMUNITY_MANAGER | CUSTOMER_SUPPORT | PROSPECTION | MARKETING | CV_CREATOR | CV_EDITOR | IMAGE_CREATOR | VIDEO_CREATOR | RAG_DOCUMENT | SECURITY_AUDIT | CREATIVE_LEAD | ONLY_OFFICE | ANIMATION | AD_SPOT")
        @JsonAlias("type")
        String agentType,
        @JsonPropertyDescription("Nom personnalisé (optionnel, nom par défaut sinon)")
        String name
    ) {}

    record CreateTeamInput(
        @JsonPropertyDescription("Nom de l'équipe")
        String name,
        @JsonPropertyDescription("Description de l'équipe (optionnel)")
        String description,
        @JsonPropertyDescription("ID de l'agent lead (SCRUM_MASTER recommandé)")
        String leadAgentId
    ) {}

    // ── Outils @Tool (Spring AI function calling) ─────────────────────────────

    @Tool(description = "Envoie un email via SMTP à UN destinataire. " +
        "Pour plusieurs destinataires, appeler cet outil une fois par adresse. " +
        "Archive automatiquement dans l'inbox. Retourne success=true et messageId si réussi.")
    public String sendEmail(SendEmailInput input) {
        var ctx = AgentContext.require();
        log.info("[TOOL:send_email] agent={} to={}", ctx.agentId(), input.to());
        return toolRegistry.executeFor(ctx.agentId(), ctx.userId(), "send_email",
            Map.of("to", nvl(input.to()), "subject", nvl(input.subject()),
                   "body", nvl(input.body()), "conversationId", nvl(input.conversationId())),
            null);
    }

    @Tool(description = "Crée une tâche pour un agent ou un utilisateur.")
    public String createTask(CreateTaskInput input) {
        var ctx = AgentContext.require();
        log.info("[TOOL:create_task] agent={} title={}", ctx.agentId(), input.title());
        return toolRegistry.executeFor(ctx.agentId(), ctx.userId(), "create_task",
            Map.of("title", nvl(input.title()), "description", nvl(input.description()),
                   "priority", nvl(input.priority(), "MEDIUM"),
                   "assignedAgentId", nvl(input.assignedAgentId())),
            null);
    }

    @Tool(description = "Délègue une tâche à un agent spécialisé et déclenche son exécution. " +
        "Utiliser select_agent d'abord si l'ID de l'agent cible est inconnu.")
    public String delegateToAgent(DelegateToAgentInput input) {
        if (AgentContext.isSubAgent()) return "{\"error\":\"Outil réservé aux agents orchestrateurs\"}";
        var ctx = AgentContext.require();
        log.info("[TOOL:delegate_to_agent] from={} to={}", ctx.agentId(), input.targetAgentId());
        return toolRegistry.executeFor(ctx.agentId(), ctx.userId(), "delegate_to_agent",
            Map.of("targetAgentId", nvl(input.targetAgentId()),
                   "message", nvl(input.message()),
                   "taskTitle", nvl(input.taskTitle()),
                   "parentTaskId", nvl(input.parentTaskId())),
            null);
    }

    @Tool(description = "Crée un rapport de clôture dans l'inbox et ferme la tâche. " +
        "À utiliser dès que l'agent a terminé son exécution.")
    public String deliverResult(DeliverResultInput input) {
        var ctx = AgentContext.require();
        log.info("[TOOL:deliver_result] agent={} taskId={}", ctx.agentId(), input.taskId());
        return toolRegistry.executeFor(ctx.agentId(), ctx.userId(), "deliver_result",
            Map.of("taskId", nvl(input.taskId()), "title", nvl(input.title()),
                   "result", nvl(input.result()), "status", nvl(input.status(), "DONE")),
            null);
    }

    @Tool(description = "Retourne la date et l'heure courante au format ISO.")
    public String getCurrentDate() {
        var ctx = AgentContext.require();
        return toolRegistry.executeFor(ctx.agentId(), ctx.userId(), "get_current_date", Map.of(), null);
    }

    @Tool(description = "Publie un post sur un réseau social via le canal configuré pour cet agent. " +
        "Plateformes : INSTAGRAM, LINKEDIN, TWITTER_X, FACEBOOK, TIKTOK, SLACK, TELEGRAM.")
    public String postSocial(PostSocialInput input) {
        var ctx = AgentContext.require();
        log.info("[TOOL:post_social] agent={} platform={}", ctx.agentId(), input.platform());
        List<String> media = input.mediaUrls() != null ? input.mediaUrls() : List.of();
        return toolRegistry.executeFor(ctx.agentId(), ctx.userId(), "post_social",
            Map.of("platform", nvl(input.platform()), "content", nvl(input.content()),
                   "mediaUrls", media),
            null);
    }

    @Tool(description = "Recherche les tâches de l'utilisateur, avec filtre optionnel par statut.")
    public String searchTasks(SearchTasksInput input) {
        var ctx = AgentContext.require();
        log.info("[TOOL:search_tasks] agent={} status={}", ctx.agentId(), input.status());
        return toolRegistry.executeFor(ctx.agentId(), ctx.userId(), "search_tasks",
            Map.of("status", nvl(input.status()), "limit", input.limit() != null ? input.limit() : 10),
            null);
    }

    @Tool(description = "Sélectionne l'agent le plus adapté pour une tâche selon son type et ses compétences. " +
        "Retourne l'agentId. À utiliser AVANT delegate_to_agent.")
    public String selectAgent(SelectAgentInput input) {
        if (AgentContext.isSubAgent()) return "{\"error\":\"Outil réservé aux agents orchestrateurs\"}";
        var ctx = AgentContext.require();
        return toolRegistry.executeFor(ctx.agentId(), ctx.userId(), "select_agent",
            Map.of("agentType", nvl(input.agentType()), "taskDescription", nvl(input.taskDescription()),
                   "teamId", nvl(input.teamId())),
            null);
    }

    @Tool(description = "Met à jour le statut d'une tâche existante. " +
        "Statuts : IN_PROGRESS (début) → DONE (terminé) | FAILED | CANCELLED.")
    public String updateTaskStatus(UpdateTaskStatusInput input) {
        var ctx = AgentContext.require();
        log.info("[TOOL:update_task_status] taskId={} status={}", input.taskId(), input.status());
        return toolRegistry.executeFor(ctx.agentId(), ctx.userId(), "update_task_status",
            Map.of("taskId", nvl(input.taskId()), "status", nvl(input.status()),
                   "errorMessage", nvl(input.errorMessage())),
            null);
    }

    @Tool(description = "Envoie un message WhatsApp via le canal WhatsApp Business configuré pour cet agent.")
    public String sendWhatsapp(SendWhatsappInput input) {
        var ctx = AgentContext.require();
        log.info("[TOOL:send_whatsapp] agent={} to={}", ctx.agentId(), input.to());
        return toolRegistry.executeFor(ctx.agentId(), ctx.userId(), "send_whatsapp",
            Map.of("to", nvl(input.to()), "body", nvl(input.body()),
                   "conversationId", nvl(input.conversationId())),
            null);
    }

    @Tool(description = "Crée un nouvel agent IA spécialisé à partir d'un type prédéfini. " +
        "L'agent est immédiatement opérationnel. Réservé aux agents orchestrateurs (SCRUM_MASTER).")
    public String createAgent(CreateAgentInput input) {
        if (AgentContext.isSubAgent()) return "{\"error\":\"Outil réservé aux agents orchestrateurs\"}";
        var ctx = AgentContext.require();
        log.info("[TOOL:create_agent] type={} name={}", input.agentType(), input.name());
        return toolRegistry.executeFor(ctx.agentId(), ctx.userId(), "create_agent",
            Map.of("type", nvl(input.agentType()), "name", nvl(input.name())),
            null);
    }

    @Tool(description = "Crée une équipe d'agents IA avec un agent lead et des membres spécialisés. " +
        "Réservé aux agents orchestrateurs (SCRUM_MASTER).")
    public String createTeam(CreateTeamInput input) {
        if (AgentContext.isSubAgent()) return "{\"error\":\"Outil réservé aux agents orchestrateurs\"}";
        var ctx = AgentContext.require();
        log.info("[TOOL:create_team] name={}", input.name());
        return toolRegistry.executeFor(ctx.agentId(), ctx.userId(), "create_team",
            Map.of("name", nvl(input.name()), "description", nvl(input.description()),
                   "leadAgentId", nvl(input.leadAgentId())),
            null);
    }

    record GetFacebookCommentsInput(
        @JsonPropertyDescription("ID du post Facebook (ex: '123456789_987654321')")
        String postId,
        @JsonPropertyDescription("Nombre max de commentaires à récupérer (défaut: 25, max: 100)")
        Integer limit
    ) {}

    record ReplyInstagramCommentInput(
        @JsonPropertyDescription("ID du commentaire Instagram auquel répondre (fourni dans la description de la tâche)")
        String commentId,
        @JsonPropertyDescription("Texte de la réponse au commentaire Instagram")
        String message
    ) {}

    @Tool(description = "Répond à un commentaire Instagram au nom du compte connecté. "
        + "Utilise le commentId fourni dans la description de la tâche. "
        + "Archive automatiquement la réponse dans l'inbox.")
    public String replyInstagramComment(ReplyInstagramCommentInput input) {
        var ctx = AgentContext.require();
        log.info("[TOOL:reply_instagram_comment] agent={} commentId={}", ctx.agentId(), input.commentId());
        return toolRegistry.executeFor(ctx.agentId(), ctx.userId(), "reply_instagram_comment",
            Map.of("commentId", nvl(input.commentId()), "message", nvl(input.message())),
            null);
    }

    record ReplyFacebookCommentInput(
        @JsonPropertyDescription("ID du commentaire auquel répondre (obtenu via get_facebook_comments)")
        String commentId,
        @JsonPropertyDescription("Texte de la réponse au commentaire")
        String message
    ) {}

    @Tool(description = "Récupère les commentaires d'un post Facebook de la page connectée. "
        + "Retourne id, auteur, message et date de chaque commentaire. "
        + "Utiliser l'id renvoyé pour répondre avec reply_facebook_comment.")
    public String getFacebookComments(GetFacebookCommentsInput input) {
        var ctx = AgentContext.require();
        log.info("[TOOL:get_facebook_comments] agent={} postId={}", ctx.agentId(), input.postId());
        return toolRegistry.executeFor(ctx.agentId(), ctx.userId(), "get_facebook_comments",
            Map.of("postId", nvl(input.postId()),
                   "limit", input.limit() != null ? input.limit() : 25),
            null);
    }

    @Tool(description = "Répond à un commentaire Facebook au nom de la page connectée. "
        + "Appeler get_facebook_comments d'abord pour obtenir l'ID du commentaire. "
        + "Archive automatiquement la réponse dans l'inbox.")
    public String replyFacebookComment(ReplyFacebookCommentInput input) {
        var ctx = AgentContext.require();
        log.info("[TOOL:reply_facebook_comment] agent={} commentId={}", ctx.agentId(), input.commentId());
        return toolRegistry.executeFor(ctx.agentId(), ctx.userId(), "reply_facebook_comment",
            Map.of("commentId", nvl(input.commentId()), "message", nvl(input.message())),
            null);
    }

    record ListMediaInput(
        @JsonPropertyDescription("Préfixe/dossier à lister (ex: 'products/labibpro', 'uploads'). Laisser vide pour tout lister.")
        String prefix,
        @JsonPropertyDescription("Nombre maximum de résultats (défaut: 20, max: 50)")
        Integer limit
    ) {}

    @Tool(description = "Liste les médias (images, vidéos) disponibles dans le stockage MinIO. "
        + "Retourne les chemins à utiliser dans post_social sous la forme minio://chemin/fichier.jpg. "
        + "Utilise prefix pour filtrer par dossier produit.")
    public String listMedia(ListMediaInput input) {
        var ctx = AgentContext.require();
        log.info("[TOOL:list_media] agent={} prefix={}", ctx.agentId(), input.prefix());

        int limit = (input.limit() != null && input.limit() > 0)
                ? Math.min(input.limit(), 50) : 20;
        String prefix = (input.prefix() != null && !input.prefix().isBlank()) ? input.prefix() : "";

        try {
            List<String> keys = minioService.listObjects(prefix, limit);
            if (keys.isEmpty()) {
                return "{\"media\":[], \"message\":\"Aucun média trouvé pour le préfixe: " + prefix + "\"}";
            }
            // Retourne les chemins avec le préfixe minio:// pour post_social
            List<Map<String, String>> items = keys.stream()
                .filter(k -> {
                    try { mediaSecurity.validateObjectKey(k); return true; }
                    catch (SecurityException e) { return false; }
                })
                .map(k -> Map.of(
                    "key",   k,
                    "minio", "minio://" + k,
                    "name",  k.contains("/") ? k.substring(k.lastIndexOf('/') + 1) : k
                ))
                .toList();
            return new com.fasterxml.jackson.databind.ObjectMapper()
                .writeValueAsString(Map.of("media", items, "count", items.size()));
        } catch (Exception e) {
            log.error("[TOOL:list_media] error: {}", e.getMessage());
            return "{\"error\":\"" + e.getMessage() + "\"}";
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static String nvl(String value) { return value != null ? value : ""; }
    private static String nvl(String value, String defaultValue) {
        return (value != null && !value.isBlank()) ? value : defaultValue;
    }
    private static Object nvl(Object value) { return value != null ? value : ""; }
}
