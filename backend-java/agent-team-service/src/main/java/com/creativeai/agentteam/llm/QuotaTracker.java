package com.creativeai.agentteam.llm;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * In-memory tracker for LLM provider daily quota (TPD).
 * Updated whenever a 429 TPD error is received — Groq error bodies contain
 * "Used X, Limit Y" which gives us the exact remaining tokens at that moment.
 */
@Component
public class QuotaTracker {

    public record QuotaState(
        String providerId, String providerType, String modelId,
        int used, int limit, Instant recordedAt
    ) {
        public int remaining() { return Math.max(0, limit - used); }

        /** Quota fully resets after 24h rolling window. */
        public boolean isStale() {
            return Duration.between(recordedAt, Instant.now()).toHours() >= 24;
        }
    }

    // Groq error: "Used 94615, Requested 5893. ... Limit 100000"
    private static final Pattern USED_LIMIT = Pattern.compile(
        "Used\\s+(\\d+)[^L]*Limit\\s+(\\d+)", Pattern.CASE_INSENSITIVE);

    // agentId → last known quota state
    private final ConcurrentHashMap<String, QuotaState> cache = new ConcurrentHashMap<>();

    // Rolling daily usage per agent (reset after 24h window)
    public record UsageWindow(int used, int limit, Instant windowStart) {
        public boolean isToday() { return Duration.between(windowStart, Instant.now()).toHours() < 24; }
        public int remaining()   { return Math.max(0, limit - used); }
    }
    private final ConcurrentHashMap<String, UsageWindow> usageWindows = new ConcurrentHashMap<>();

    /**
     * Tries to parse "Used X … Limit Y" from a TPD error body and caches the result.
     */
    public boolean tryRecord(String agentId, String providerId, String providerType,
                              String modelId, String errorBody) {
        if (errorBody == null) return false;
        Matcher m = USED_LIMIT.matcher(errorBody);
        if (!m.find()) return false;
        int used  = Integer.parseInt(m.group(1));
        int limit = Integer.parseInt(m.group(2));
        cache.put(agentId, new QuotaState(providerId, providerType, modelId, used, limit, Instant.now()));
        usageWindows.put(agentId, new UsageWindow(used, limit, Instant.now()));
        return true;
    }

    /**
     * Records actual token usage from a successful API response.
     * Accumulates within the current 24h window.
     *
     * @param inputTokens   prompt tokens charged at full rate
     * @param cachedTokens  prompt tokens served from cache (charged at ~10%)
     * @param outputTokens  completion tokens
     */
    public void addUsage(String agentId, String providerId, String providerType,
                          String modelId, int inputTokens, int cachedTokens, int outputTokens) {
        // Effective tokens = full-rate input + discounted cached + output
        int effectiveTokens = (inputTokens - cachedTokens) + (cachedTokens / 10) + outputTokens;
        if (effectiveTokens <= 0) return;

        usageWindows.compute(agentId, (k, w) -> {
            if (w == null || !w.isToday()) {
                return new UsageWindow(effectiveTokens, w != null ? w.limit() : 100_000, Instant.now());
            }
            return new UsageWindow(w.used() + effectiveTokens, w.limit(), w.windowStart());
        });

        UsageWindow uw = usageWindows.get(agentId);
        if (uw != null) {
            cache.put(agentId, new QuotaState(providerId, providerType, modelId,
                uw.used(), uw.limit(), Instant.now()));
        }
    }

    public Optional<QuotaState> getState(String agentId) {
        QuotaState s = cache.get(agentId);
        if (s == null || s.isStale()) return Optional.empty();
        return Optional.of(s);
    }
}
