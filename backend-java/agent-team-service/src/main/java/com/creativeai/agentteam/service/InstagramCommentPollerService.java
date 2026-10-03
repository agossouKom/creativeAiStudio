package com.creativeai.agentteam.service;

import com.creativeai.agentteam.dto.request.CreateTaskRequest;
import com.creativeai.agentteam.model.Channel;
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
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Polling des commentaires Instagram — même mécanique que FacebookCommentPollerService.
 * Activation : instagram.polling-enabled=true
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "instagram.polling-enabled", havingValue = "true")
public class InstagramCommentPollerService {

    // Préfixe et TTL partagés avec le webhook Instagram : les deux chemins écrivent
    // le même marqueur, donc un commentaire vu par l'un n'est pas rejoué par l'autre.
    private static final String   SEEN_PREFIX       = WebhookEventDeduplicator.IG_SEEN_PREFIX;
    private static final Duration SEEN_TTL          = Duration.ofDays(7);
    private static final long     DEFAULT_INTERVAL  = 300_000L; // 5 min
    private static final int      MAX_MEDIA         = 10;
    private static final int      MAX_COMMENTS      = 50;

    private final ChannelRepository              channelRepo;
    private final InstagramService               instagramService;
    private final TaskService                    taskService;
    private final RedisTemplate<String, Object>  redisTemplate;
    private final ObjectMapper                   objectMapper;

    // ── Déclenchement manuel ────────────────────────────────────────────────────

    @Transactional
    public int triggerNow(String agentId) {
        Channel channel = instagramService.findChannel(agentId);
        if (channel == null) {
            log.warn("[IG_POLLER] Aucun canal Instagram pour agent={}", agentId);
            return 0;
        }
        String userId = channel.getAgent().getOwnerId();
        log.info("[IG_POLLER] Scan manuel agentId={}", agentId);
        int count = pollChannel(agentId, userId);
        channel.setLastSyncAt(LocalDateTime.now());
        channelRepo.save(channel);
        return count;
    }

    @Transactional
    public int scanMedia(String agentId, String mediaId) {
        Channel channel = instagramService.findChannel(agentId);
        if (channel == null) return 0;
        String userId = channel.getAgent().getOwnerId();
        return pollSingleMedia(agentId, userId, mediaId);
    }

    // ── Scheduler ───────────────────────────────────────────────────────────────

    @Scheduled(fixedDelayString = "${instagram.poll-fixed-delay-ms:60000}")
    @Transactional
    public void poll() {
        List<Channel> channels = instagramService.findAllConnectedChannels();
        if (channels.isEmpty()) {
            log.debug("[IG_POLLER] Aucun canal Instagram connecté");
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        for (Channel ch : channels) {
            long intervalMs = readPollIntervalMs(ch);
            if (ch.getLastSyncAt() != null) {
                long elapsedMs = Duration.between(ch.getLastSyncAt(), now).toMillis();
                if (elapsedMs < intervalMs) continue;
            }
            String agentId = ch.getAgent().getId();
            String userId  = ch.getAgent().getOwnerId();
            log.info("[IG_POLLER] Polling canal={} agent={}", ch.getId(), agentId);
            pollChannel(agentId, userId);
            ch.setLastSyncAt(now);
            channelRepo.save(ch);
        }
    }

    // ── Poll interne ────────────────────────────────────────────────────────────

    private int pollChannel(String agentId, String userId) {
        List<Map<String, Object>> mediaList;
        try {
            mediaList = instagramService.fetchRecentMedia(agentId, MAX_MEDIA);
        } catch (Exception e) {
            log.error("[IG_POLLER] Erreur fetch médias agent={}: {}", agentId, e.getMessage());
            return 0;
        }
        log.info("[IG_POLLER] agent={} → {} média(s)", agentId, mediaList.size());
        int newCount = 0;
        for (Map<String, Object> media : mediaList) {
            String mediaId = (String) media.get("id");
            if (mediaId == null) continue;
            newCount += pollSingleMedia(agentId, userId, mediaId);
        }
        return newCount;
    }

    private int pollSingleMedia(String agentId, String userId, String mediaId) {
        List<Map<String, Object>> comments;
        try {
            comments = instagramService.fetchComments(agentId, mediaId, MAX_COMMENTS);
        } catch (Exception e) {
            log.warn("[IG_POLLER] Erreur commentaires mediaId={}: {}", mediaId, e.getMessage());
            return 0;
        }
        int newCount = 0;
        for (Map<String, Object> comment : comments) {
            String commentId = (String) comment.get("id");
            String text      = (String) comment.get("text");
            String username  = (String) comment.getOrDefault("username", "Inconnu");
            if (commentId == null || text == null || text.isBlank()) continue;
            String seenKey = SEEN_PREFIX + commentId;
            if (Boolean.TRUE.equals(redisTemplate.hasKey(seenKey))) continue;
            redisTemplate.opsForValue().set(seenKey, "1", SEEN_TTL);
            log.info("[IG_POLLER] Nouveau commentaire commentId={} from=@{}", commentId, username);
            createReplyTask(userId, agentId, mediaId, commentId, text, username);
            newCount++;
        }
        return newCount;
    }

    // ── Création tâche de réponse ───────────────────────────────────────────────

    private void createReplyTask(String userId, String agentId,
                                  String mediaId, String commentId,
                                  String commentText, String username) {
        String description = """
            Un nouveau commentaire a été posté sur votre publication Instagram.

            Média ID    : %s
            Commentaire : @%s
            Message     : "%s"

            Réponds au commentaire de façon professionnelle et engageante.
            Utilise l'outil reply_instagram_comment avec commentId="%s".
            """.formatted(mediaId, username, commentText, commentId);

        CreateTaskRequest req = new CreateTaskRequest(
            "Répondre au commentaire de @" + username,
            description,
            TaskType.SOCIAL_REPLY,
            Priority.HIGH,
            TaskSource.SOCIAL_MEDIA,
            agentId,
            null, null,
            "{\"commentId\":\"" + commentId + "\",\"mediaId\":\"" + mediaId + "\",\"platform\":\"INSTAGRAM\"}",
            null, null,
            "[{\"name\":\"@" + username + "\",\"instagramUsername\":\"" + username + "\"}]",
            "Réponse publiée au commentaire Instagram",
            false,
            null, null, null, null, null
        );

        try {
            var task = taskService.createTask(userId, req, null);
            log.info("[IG_POLLER] Tâche créée id={} pour commentId={}", task.id(), commentId);
        } catch (Exception e) {
            log.error("[IG_POLLER] Échec création tâche commentId={}: {}", commentId, e.getMessage());
        }
    }

    private long readPollIntervalMs(Channel channel) {
        if (channel.getConfig() == null || channel.getConfig().isBlank()) return DEFAULT_INTERVAL;
        try {
            JsonNode node = objectMapper.readTree(channel.getConfig());
            JsonNode interval = node.get("pollIntervalMs");
            if (interval != null && interval.isNumber()) return Math.max(interval.asLong(), 30_000L);
        } catch (Exception e) {
            log.warn("[IG_POLLER] Impossible de lire pollIntervalMs du canal {}", channel.getId());
        }
        return DEFAULT_INTERVAL;
    }
}
