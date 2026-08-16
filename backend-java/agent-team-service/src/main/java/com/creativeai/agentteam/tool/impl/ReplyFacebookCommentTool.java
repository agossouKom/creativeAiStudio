package com.creativeai.agentteam.tool.impl;

import com.creativeai.agentteam.service.ChannelSenderService;
import com.creativeai.agentteam.tool.AgentTool;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class ReplyFacebookCommentTool implements AgentTool {

    private final ChannelSenderService channelSender;
    private final ObjectMapper         objectMapper;

    @Override public String getName() { return "reply_facebook_comment"; }

    @Override
    public String getDescription() {
        return "Répond à un commentaire Facebook au nom de la page connectée. "
             + "Utiliser get_facebook_comments pour obtenir les IDs des commentaires. "
             + "Archive automatiquement la réponse dans l'inbox.";
    }

    @Override
    public String getParametersSchema() {
        return """
            {
              "commentId": "string (obligatoire) — ID du commentaire auquel répondre",
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

        log.info("[REPLY_FB_COMMENT] agent={} commentId={}", agentId, commentId);

        ChannelSenderService.SendResult result =
                channelSender.replyToFacebookComment(userId, agentId, commentId, message);

        try {
            if (result.success()) {
                return objectMapper.writeValueAsString(Map.of(
                    "success",   true,
                    "replyId",   result.messageId() != null ? result.messageId() : "",
                    "commentId", commentId,
                    "message",   "Réponse publiée sur Facebook et archivée dans l'inbox."
                ));
            } else {
                return objectMapper.writeValueAsString(Map.of(
                    "success", false,
                    "error",   result.error() != null ? result.error() : "Erreur inconnue"
                ));
            }
        } catch (Exception e) {
            return "{\"success\":false,\"error\":\"" + e.getMessage().replace("\"", "'") + "\"}";
        }
    }
}
