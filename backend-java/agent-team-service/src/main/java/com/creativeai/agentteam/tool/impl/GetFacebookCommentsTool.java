package com.creativeai.agentteam.tool.impl;

import com.creativeai.agentteam.service.ChannelSenderService;
import com.creativeai.agentteam.tool.AgentTool;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class GetFacebookCommentsTool implements AgentTool {

    private final ChannelSenderService channelSender;
    private final ObjectMapper         objectMapper;

    @Override public String getName() { return "get_facebook_comments"; }

    @Override
    public String getDescription() {
        return "Récupère les commentaires d'un post Facebook de la page connectée. "
             + "Retourne la liste des commentaires avec id, auteur, message et date. "
             + "L'id du commentaire est nécessaire pour répondre avec reply_facebook_comment.";
    }

    @Override
    public String getParametersSchema() {
        return """
            {
              "postId": "string (obligatoire) — ID du post Facebook (ex: '123456789_987654321')",
              "limit":  "integer (optionnel, défaut 25, max 100) — nombre max de commentaires"
            }
            """;
    }

    @Override
    public String execute(String agentId, String userId, Map<String, Object> params) {
        String postId = (String) params.get("postId");
        if (postId == null || postId.isBlank()) return "{\"error\":\"Paramètre 'postId' obligatoire\"}";

        int limit = params.get("limit") instanceof Number n ? n.intValue() : 25;
        limit = Math.min(limit, 100);

        log.info("[GET_FB_COMMENTS] agent={} postId={} limit={}", agentId, postId, limit);

        try {
            List<Map<String, Object>> comments = channelSender.fetchFacebookComments(agentId, postId, limit);
            return objectMapper.writeValueAsString(Map.of(
                "postId",   postId,
                "count",    comments.size(),
                "comments", comments
            ));
        } catch (Exception e) {
            log.error("[GET_FB_COMMENTS] error: {}", e.getMessage(), e);
            return "{\"error\":\"" + e.getMessage().replace("\"", "'") + "\"}";
        }
    }
}
