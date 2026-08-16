package com.creativeai.agentteam.tool.impl;

import com.creativeai.agentteam.repository.AgentTaskRepository;
import com.creativeai.agentteam.service.ChannelSenderService;
import com.creativeai.agentteam.tool.AgentContext;
import com.creativeai.agentteam.tool.AgentTool;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class PostSocialTool implements AgentTool {

    private final ChannelSenderService channelSender;
    private final ObjectMapper         objectMapper;
    private final AgentTaskRepository  taskRepository;

    @Override public String getName() { return "post_social"; }

    @Override
    public String getDescription() {
        return "Publie un post sur un réseau social via le canal configuré pour cet agent. "
             + "Plateformes supportées : INSTAGRAM, LINKEDIN, TWITTER_X, FACEBOOK, TIKTOK, SLACK, TELEGRAM. "
             + "Archive automatiquement la publication dans l'inbox.";
    }

    @Override
    public String getParametersSchema() {
        return """
            {
              "platform":  "string (obligatoire) — plateforme cible: INSTAGRAM, LINKEDIN, TWITTER_X, FACEBOOK, TIKTOK, SLACK, TELEGRAM",
              "content":   "string (obligatoire) — texte du post (hashtags, emojis autorisés)",
              "mediaUrls": "array<string> (optionnel) — URLs des médias à joindre (images, vidéos)"
            }
            """;
    }

    @Override
    public String execute(String agentId, String userId, Map<String, Object> params) {
        String platform = (String) params.get("platform");
        String content  = (String) params.get("content");

        if (platform == null || platform.isBlank()) return "{\"error\":\"Paramètre 'platform' obligatoire\"}";
        if (content  == null || content.isBlank())  return "{\"error\":\"Paramètre 'content' obligatoire\"}";

        Object rawMedia = params.get("mediaUrls");
        List<String> mediaUrls;
        if (rawMedia instanceof List<?> list) {
            mediaUrls = list.stream().map(Object::toString).toList();
        } else if (rawMedia instanceof String s && !s.isBlank()) {
            mediaUrls = List.of(s.split(",\\s*"));
        } else {
            mediaUrls = List.of();
        }

        log.info("[POST_SOCIAL] agent={} platform={} content-length={}", agentId, platform, content.length());

        ChannelSenderService.SendResult result =
                channelSender.postSocial(userId, agentId, platform, content, mediaUrls);

        if (result.success()) {
            // Stocker l'ID du post sur la tâche courante pour permettre la suppression en cascade
            storeSocialPostId(platform, result.messageId());

            try {
                return objectMapper.writeValueAsString(Map.of(
                    "success",   true,
                    "messageId", result.messageId(),
                    "platform",  platform,
                    "message",   "Post publié sur " + platform + " et archivé dans l'inbox."
                ));
            } catch (Exception e) {
                return "{\"success\":true,\"platform\":\"" + platform + "\"}";
            }
        } else {
            try {
                return objectMapper.writeValueAsString(Map.of(
                    "success", false,
                    "error",   result.error() != null ? result.error()
                                                      : "Canal " + platform + " non configuré pour cet agent"
                ));
            } catch (Exception e) {
                return "{\"success\":false,\"error\":\"" + e.getMessage() + "\"}";
            }
        }
    }

    private void storeSocialPostId(String platform, String postId) {
        if (postId == null || postId.isBlank()) return;
        try {
            AgentContext.ExecutionContext ctx = AgentContext.require();
            if (ctx.taskId() == null) return;

            taskRepository.findById(ctx.taskId()).ifPresent(task -> {
                try {
                    String existing = task.getSocialPostIds();
                    Map<String, String> map = existing != null
                        ? new HashMap<>(objectMapper.readValue(existing, new com.fasterxml.jackson.core.type.TypeReference<Map<String, String>>() {}))
                        : new HashMap<>();
                    map.put(platform.toUpperCase(), postId);
                    task.setSocialPostIds(objectMapper.writeValueAsString(map));
                    taskRepository.save(task);
                    log.info("[POST_SOCIAL] Stored socialPostId task={} platform={} postId={}", ctx.taskId(), platform, postId);
                } catch (Exception e) {
                    log.warn("[POST_SOCIAL] Could not store socialPostId: {}", e.getMessage());
                }
            });
        } catch (Exception e) {
            log.warn("[POST_SOCIAL] storeSocialPostId failed: {}", e.getMessage());
        }
    }
}
