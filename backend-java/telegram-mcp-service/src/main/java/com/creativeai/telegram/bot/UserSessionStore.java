package com.creativeai.telegram.bot;

import com.creativeai.telegram.config.AppProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Registre des sessions Telegram, persisté dans Redis.
 *
 * Clé Redis : tg:session:<chatId>  — TTL 30 jours, remis à zéro à chaque accès.
 * Le JWT n'est pas stocké : il est régénéré à la volée depuis l'email (toujours frais).
 * Fallback en mémoire si Redis est temporairement indisponible.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserSessionStore {

    private static final String   PREFIX = "tg:session:";
    private static final Duration TTL    = Duration.ofDays(30);

    private final AppProperties       props;
    private final StringRedisTemplate redis;
    private final ObjectMapper        objectMapper;

    private final ConcurrentHashMap<Long, UserSession> fallback = new ConcurrentHashMap<>();

    // ── Lecture ───────────────────────────────────────────────────────────────

    public Optional<UserSession> find(long chatId) {
        try {
            String raw = redis.opsForValue().get(key(chatId));
            if (raw == null) return Optional.ofNullable(fallback.get(chatId));

            @SuppressWarnings("unchecked")
            Map<String, String> data = objectMapper.readValue(raw, Map.class);
            String email     = data.get("userId");
            String sessionId = data.get("sessionId");
            Instant linkedAt = Instant.parse(data.get("linkedAt"));

            redis.expire(key(chatId), TTL);
            return Optional.of(new UserSession(email, freshJwt(email), sessionId, linkedAt));
        } catch (Exception e) {
            log.warn("[SESSION] Redis unavailable, fallback mémoire: {}", e.getMessage());
            return Optional.ofNullable(fallback.get(chatId));
        }
    }

    // ── Écriture ──────────────────────────────────────────────────────────────

    public UserSession link(long chatId, String email) {
        String sessionId = UUID.randomUUID().toString();
        Instant now      = Instant.now();
        UserSession s    = new UserSession(email, freshJwt(email), sessionId, now);
        persist(chatId, s);
        log.info("[SESSION] Linked chatId={} → email={}", chatId, email);
        return s;
    }

    public void unlink(long chatId) {
        try { redis.delete(key(chatId)); } catch (Exception ignored) {}
        fallback.remove(chatId);
        log.info("[SESSION] Unlinked chatId={}", chatId);
    }

    public boolean isLinked(long chatId) {
        try {
            if (Boolean.TRUE.equals(redis.hasKey(key(chatId)))) return true;
        } catch (Exception ignored) {}
        return fallback.containsKey(chatId);
    }

    public UserSession resetSession(long chatId) {
        UserSession current = find(chatId)
            .orElseThrow(() -> new IllegalStateException("chatId not linked: " + chatId));
        UserSession fresh = current.withSession(UUID.randomUUID().toString());
        persist(chatId, fresh);
        return fresh;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void persist(long chatId, UserSession s) {
        try {
            String json = objectMapper.writeValueAsString(Map.of(
                "userId",    s.userId(),
                "sessionId", s.sessionId(),
                "linkedAt",  s.linkedAt().toString()
            ));
            redis.opsForValue().set(key(chatId), json, TTL);
        } catch (Exception e) {
            log.warn("[SESSION] Redis write failed, fallback mémoire: {}", e.getMessage());
        }
        fallback.put(chatId, s);
    }

    private String key(long chatId) { return PREFIX + chatId; }

    public String freshJwt(String userId) {
        byte[] key = props.jwtSecret().getBytes();
        return Jwts.builder()
            .subject(userId)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + 7L * 24 * 3600 * 1000))
            .signWith(Keys.hmacShaKeyFor(key))
            .compact();
    }
}
