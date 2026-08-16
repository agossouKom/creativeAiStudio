package com.creativeai.agentteam.tool.impl;

import com.creativeai.agentteam.service.InstagramService;
import com.creativeai.agentteam.tool.AgentTool;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class ReplyInstagramCommentTool implements AgentTool {

    private final InstagramService instagramService;
    private final ObjectMapper     objectMapper;

    @Override public String getName() { return "reply_instagram_comment"; }

    @Override
    public String getDescription() {
        return "Répond à un commentaire Instagram au nom du compte connecté. "
             + "Utiliser get_instagram_comments pour obtenir les IDs des commentaires. "
             + "Paramètres : commentId (ID du commentaire), message (texte de la réponse).";
    }

    @Override
    public String getParametersSchema() {
        return """
            {
              "commentId": "string (obligatoire) — ID du commentaire Instagram auquel répondre",
              "message":   "string (obligatoire) — texte de la réponse"
            }
            """;
    }

    @Override
    public String execute(String agentId, String userId, Map<String, Object> params) {
        String commentId = (String) params.get("commentId");
        String message   = (String) params.get("message");

        if (commentId == null || commentId.isBlank()) return "{\"error\":\"Paramètre 'commentId' obligatoire\"}";
        if (message   == null || message.isBlank())   return "{\"error\":\"Paramètre 'message' obligatoire\"}";

        log.info("[REPLY_IG_COMMENT] agent={} commentId={}", agentId, commentId);

        try {
            String replyId = instagramService.replyToComment(agentId, commentId, message);
            return objectMapper.writeValueAsString(Map.of(
                "success",   true,
                "replyId",   replyId != null ? replyId : "",
                "commentId", commentId,
                "message",   "Réponse publiée sur Instagram."
            ));
        } catch (Exception e) {
            log.error("[REPLY_IG_COMMENT] Erreur: {}", e.getMessage());
            try {
                return objectMapper.writeValueAsString(Map.of("success", false, "error", e.getMessage()));
            } catch (Exception ex) {
                return "{\"success\":false,\"error\":\"" + e.getMessage().replace("\"", "'") + "\"}";
            }
        }
    }
}
