package com.creativeai.agentteam.service;

import com.creativeai.agentteam.dto.request.CreateTaskRequest;
import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.model.enums.Priority;
import com.creativeai.agentteam.model.enums.TaskSource;
import com.creativeai.agentteam.model.enums.TaskType;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Polling des commentaires Facebook — alternative au webhook pour environnement local.
 *
 * Le scheduler tourne toutes les FACEBOOK_POLL_DELAY_MS (défaut 60s = tick minimum).
 * Chaque canal a son propre intervalle dans channel.config["pollIntervalMs"] (défaut 300000 = 5 min).
 * channel.lastSyncAt trace le dernier polling réel pour éviter les appels trop fréquents.
 *
 * Configurer l'intervalle par canal via :
 *   PUT /api/agents/{agentId}/channels/{channelId}
 *   { "config": "{\"pollIntervalMs\": 60000}" }
 *
 * Activation : FACEBOOK_POLLING_ENABLED=true
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "facebook.polling-enabled", havingValue = "true")
public class FacebookCommentPollerService {

    private static final String SEEN_PREFIX        = "fb:seen:";
    private static final Duration SEEN_TTL         = Duration.ofDays(7);
    private static final long DEFAULT_INTERVAL_MS  = 300_000L; // 5 min par défaut
    private static final int POSTS_LOOKBACK_HOURS  = 24;
    private static final int MAX_POSTS             = 10;
    private static final int MAX_COMMENTS          = 50;

    private final ChannelRepository             channelRepo;
    private final ChannelSenderService          channelSender;
    private final TaskService                   taskService;
    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper                  objectMapper;

    /** Déclenche immédiatement le poll pour tous les canaux Facebook connectés d'un agent (bypass intervalle). */
    @Transactional
    public int triggerNow(String agentId) {
        List<Channel> channels = channelRepo.findAll().stream()
                .filter(c -> !c.isDeleted()
                          && c.getType()         == ChannelType.SOCIAL_MEDIA
                          && c.getPlatformType() == PlatformType.FACEBOOK
                          && c.getStatus()       == ChannelStatus.CONNECTED
                          && c.getAgent() != null
                          && c.getAgent().getId().equals(agentId))
                .toList();
        int count = 0;
        for (Channel ch : channels) {
            String userId = ch.getAgent().getOwnerId();
            log.info("[FB_POLLER] Scan manuel demandé agent={}", agentId);
            pollChannel(agentId, userId);
            ch.setLastSyncAt(LocalDateTime.now());
            channelRepo.save(ch);
            count++;
        }
        return count;
    }

    /** Scanne les commentaires d'un post spécifique (pour les anciennes publications). */
    @Transactional
    public int scanPost(String agentId, String postId) {
        List<Channel> channels = channelRepo.findAll().stream()
                .filter(c -> !c.isDeleted()
                          && c.getType()         == ChannelType.SOCIAL_MEDIA
                          && c.getPlatformType() == PlatformType.FACEBOOK
                          && c.getStatus()       == ChannelStatus.CONNECTED
                          && c.getAgent() != null
                          && c.getAgent().getId().equals(agentId))
                .toList();
        if (channels.isEmpty()) return 0;
        Channel ch = channels.get(0);
        String userId = ch.getAgent().getOwnerId();
        log.info("[FB_POLLER] Scan post spécifique postId={} agent={}", postId, agentId);
        return pollSinglePost(agentId, userId, postId);
    }

    private int pollSinglePost(String agentId, String userId, String postId) {
        List<Map<String, Object>> comments;
        try {
            comments = channelSender.fetchFacebookComments(agentId, postId, MAX_COMMENTS);
        } catch (Exception e) {
            log.error("[FB_POLLER] Erreur commentaires postId={}: {}", postId, e.getMessage());
            return 0;
        }
        int newCount = 0;
        for (Map<String, Object> comment : comments) {
            String commentId   = (String) comment.get("id");
            String commentText = (String) comment.get("message");
            String authorName  = (String) comment.getOrDefault("author_name", "Inconnu");
            String authorId    = (String) comment.getOrDefault("author_id", "");
            if (commentId == null || commentText == null || commentText.isBlank()) continue;
            String seenKey = SEEN_PREFIX + commentId;
            if (Boolean.TRUE.equals(redisTemplate.hasKey(seenKey))) continue;
            redisTemplate.opsForValue().set(seenKey, "1", SEEN_TTL);
            log.info("[FB_POLLER] Nouveau commentaire (scan manuel) commentId={} from={}", commentId, authorName);
            createReplyTask(userId, agentId, postId, commentId, commentText, authorName, authorId);
            newCount++;
        }
        log.info("[FB_POLLER] Scan post {} → {} nouveau(x) commentaire(s)", postId, newCount);
        return newCount;
    }

    // Tick minimum — chaque canal décide lui-même s'il est l'heure de poller
    @Scheduled(fixedDelayString = "${facebook.poll-fixed-delay-ms:60000}")
    @Transactional
    public void poll() {
        List<Channel> facebookChannels = channelRepo.findAll().stream()
                .filter(c -> !c.isDeleted()
                          && c.getType()         == ChannelType.SOCIAL_MEDIA
                          && c.getPlatformType() == PlatformType.FACEBOOK
                          && c.getStatus()       == ChannelStatus.CONNECTED)
                .toList();

        if (facebookChannels.isEmpty()) {
            log.debug("[FB_POLLER] Aucun canal Facebook connecté");
            return;
        }

        LocalDateTime now = LocalDateTime.now();

        for (Channel channel : facebookChannels) {
            long intervalMs = readPollIntervalMs(channel);

            // Vérifier si l'intervalle propre au canal est écoulé
            if (channel.getLastSyncAt() != null) {
                long elapsedMs = Duration.between(channel.getLastSyncAt(), now).toMillis();
                if (elapsedMs < intervalMs) {
                    log.debug("[FB_POLLER] Canal {} — prochain poll dans {}s",
                              channel.getId(), (intervalMs - elapsedMs) / 1000);
                    continue;
                }
            }

            String agentId = channel.getAgent().getId();
            String userId  = channel.getAgent().getOwnerId();

            log.info("[FB_POLLER] Polling canal={} agent={} (intervalle={}s)",
                     channel.getId(), agentId, intervalMs / 1000);

            pollChannel(agentId, userId);

            // Marquer le canal comme synchronisé maintenant
            channel.setLastSyncAt(now);
            channelRepo.save(channel);
        }
    }

    private void pollChannel(String agentId, String userId) {
        long sinceUnix = Instant.now().minusSeconds(POSTS_LOOKBACK_HOURS * 3600L).getEpochSecond();

        List<Map<String, Object>> posts;
        try {
            posts = channelSender.fetchRecentFacebookPosts(agentId, sinceUnix, MAX_POSTS);
        } catch (Exception e) {
            log.error("[FB_POLLER] Erreur récupération posts agent={}: {}", agentId, e.getMessage());
            return;
        }

        log.info("[FB_POLLER] agent={} → {} post(s)", agentId, posts.size());

        for (Map<String, Object> post : posts) {
            String postId = (String) post.get("id");
            if (postId == null) continue;

            List<Map<String, Object>> comments;
            try {
                comments = channelSender.fetchFacebookComments(agentId, postId, MAX_COMMENTS);
            } catch (Exception e) {
                log.warn("[FB_POLLER] Erreur commentaires postId={}: {}", postId, e.getMessage());
                continue;
            }

            for (Map<String, Object> comment : comments) {
                String commentId   = (String) comment.get("id");
                String commentText = (String) comment.get("message");
                String authorName  = (String) comment.getOrDefault("author_name", "Inconnu");
                String authorId    = (String) comment.getOrDefault("author_id", "");

                if (commentId == null || commentText == null || commentText.isBlank()) continue;

                String seenKey = SEEN_PREFIX + commentId;
                if (Boolean.TRUE.equals(redisTemplate.hasKey(seenKey))) continue;

                redisTemplate.opsForValue().set(seenKey, "1", SEEN_TTL);

                log.info("[FB_POLLER] Nouveau commentaire commentId={} from={}", commentId, authorName);
                createReplyTask(userId, agentId, postId, commentId, commentText, authorName, authorId);
            }
        }
    }

    private void createReplyTask(String userId, String agentId,
                                  String postId, String commentId,
                                  String commentText, String authorName, String authorId) {
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
            "[{\"name\":\"" + authorName + "\",\"facebookId\":\"" + authorId + "\"}]",
            "Réponse publiée au commentaire et archivée dans l'inbox",
            false,
            null, null, null, null, null
        );

        try {
            var task = taskService.createTask(userId, req, null);
            log.info("[FB_POLLER] Tâche créée id={} pour commentId={}", task.id(), commentId);
        } catch (Exception e) {
            log.error("[FB_POLLER] Échec création tâche commentId={}: {}", commentId, e.getMessage());
        }
    }

    // Lit pollIntervalMs depuis channel.config JSON — défaut 300 000 ms (5 min)
    private long readPollIntervalMs(Channel channel) {
        if (channel.getConfig() == null || channel.getConfig().isBlank()) return DEFAULT_INTERVAL_MS;
        try {
            JsonNode node = objectMapper.readTree(channel.getConfig());
            JsonNode interval = node.get("pollIntervalMs");
            if (interval != null && interval.isNumber()) {
                long val = interval.asLong();
                return Math.max(val, 30_000L); // minimum 30s pour ne pas spammer l'API
            }
        } catch (Exception e) {
            log.warn("[FB_POLLER] Impossible de lire pollIntervalMs depuis config du canal {}", channel.getId());
        }
        return DEFAULT_INTERVAL_MS;
    }
}
