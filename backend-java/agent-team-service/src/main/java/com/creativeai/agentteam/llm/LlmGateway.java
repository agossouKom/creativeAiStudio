package com.creativeai.agentteam.llm;

import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.LlmProvider;
import com.creativeai.agentteam.model.enums.LlmType;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.LlmProviderRepository;
import com.creativeai.agentteam.service.EncryptionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class LlmGateway {

    private final LlmProviderRepository llmRepo;
    private final AgentRepository       agentRepo;
    private final EncryptionService     encryptionService;
    private final WebClient.Builder     webClientBuilder;
    private final ObjectMapper          objectMapper;
    private final QuotaTracker          quotaTracker;

    @Value("${agent.groq-base-url}")   private String groqBaseUrl;
    @Value("${agent.openai-base-url}") private String openAiBaseUrl;
    @Value("${agent.ollama-base-url}") private String ollamaBaseUrl;
    @Value("${agent.default-model}")   private String defaultModel;
    @Value("${agent.admin-user-id:}")  private String adminUserId;
    @Value("${GROQ_API_KEY:}")         private String groqApiKey;

    private static final Pattern RETRY_AFTER_PATTERN =
        Pattern.compile("(?:try again|Please retry) in ([\\d.]+)s", Pattern.CASE_INSENSITIVE);
    // Quota journalier épuisé → pas la peine de réessayer, on échoue vite
    private static final Pattern DAILY_QUOTA_PATTERN =
        Pattern.compile("PerDay|per_day|per day|\\bTPD\\b|tokens per day|RESOURCE_EXHAUSTED.*quota|quota.*exceeded", Pattern.CASE_INSENSITIVE);
    private static final int MAX_RETRIES = 3;

    private static boolean isTransientNetworkError(String msg) {
        return msg != null && (
            msg.contains("handshake timed out") ||
            msg.contains("Connection timed out") ||
            msg.contains("connection timed out") ||
            msg.contains("Connection refused") ||
            msg.contains("ConnectTimeoutException") ||
            msg.contains("ReadTimeoutException") ||
            msg.contains("SocketException")
        );
    }

    // ── Non-streaming (agentic loop — détection de tool call textuel) ─────────

    public String chat(String agentId, List<ChatMessage> messages) {
        LlmProvider provider    = resolveProvider(agentId);
        boolean     isAnthropic = provider.getType() == LlmType.ANTHROPIC;

        for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                return isAnthropic
                    ? chatAnthropic(provider, messages, agentId)
                    : chatOpenAiCompat(provider, messages, agentId);
            } catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage() : "";
                if (msg.contains("429") && attempt < MAX_RETRIES
                        && !DAILY_QUOTA_PATTERN.matcher(msg).find()) {
                    long waitMs = parseRetryAfterMs(msg) + 1000;
                    log.warn("[LLM] Rate limit 429 (RPM) — attente {}ms avant retry {}/{}", waitMs, attempt + 1, MAX_RETRIES);
                    try { Thread.sleep(waitMs); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                    provider = resolveProvider(agentId);
                } else if (isTransientNetworkError(msg) && attempt < MAX_RETRIES) {
                    log.warn("[LLM] Erreur réseau transitoire ({}) — retry {}/{}", msg, attempt + 1, MAX_RETRIES);
                    try { Thread.sleep(3000L * (attempt + 1)); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                    provider = resolveProvider(agentId);
                } else {
                    if (msg.contains("429")) {
                        log.warn("[LLM] Quota épuisé (journalier ou définitif) pour agentId={}", agentId);
                        if (DAILY_QUOTA_PATTERN.matcher(msg).find()) {
                            quotaTracker.tryRecord(agentId, provider.getId(),
                                provider.getType().name(), provider.getModelId(), msg);
                        }
                    } else {
                        log.error("LLM chat error for agentId={}: {}", agentId, msg);
                    }
                    return friendlyError(msg);
                }
            }
        }
        return friendlyError("429");
    }

    // ── Streaming (réponse finale temps-réel) ─────────────────────────────────

    /**
     * Appel streaming pour la réponse finale à l'utilisateur.
     * Émet les tokens au fil de l'eau via SSE.
     */
    public Flux<String> streamChat(String agentId, List<ChatMessage> messages) {
        LlmProvider provider = resolveProvider(agentId);

        if (provider.getType() == LlmType.ANTHROPIC) {
            return streamChatAnthropic(provider, messages, agentId);
        }
        return streamChatOpenAiCompatWithRetry(provider, messages, agentId, MAX_RETRIES);
    }

    // ── OpenAI-compatible (Groq, Ollama, Mistral, Gemini…) ───────────────────

    private String chatOpenAiCompat(LlmProvider p, List<ChatMessage> messages, String agentId) throws Exception {
        String reqBody  = buildOpenAiBody(messages, p, false);
        log.debug("[LLM] chat request body: {}", reqBody);
        String response = buildClient(p, false)
            .post().uri("/chat/completions")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + decryptKey(p))
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(reqBody)
            .retrieve()
            .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                resp -> resp.bodyToMono(String.class).map(errBody -> {
                    log.error("[LLM] OpenAI-compat error {} — body: {}", resp.statusCode().value(), errBody);
                    return new RuntimeException("Groq " + resp.statusCode().value() + ": " + errBody);
                }))
            .bodyToMono(String.class)
            .block();

        JsonNode root = objectMapper.readTree(response);
        recordOpenAiUsage(agentId, p, root);
        return root.path("choices").path(0).path("message").path("content").asText("");
    }

    private void recordOpenAiUsage(String agentId, LlmProvider p, JsonNode root) {
        try {
            JsonNode usage = root.path("usage");
            if (usage.isMissingNode()) return;
            int input   = usage.path("prompt_tokens").asInt(0);
            int output  = usage.path("completion_tokens").asInt(0);
            int cached  = usage.path("prompt_tokens_details").path("cached_tokens").asInt(0);
            if (cached == 0) cached = usage.path("prompt_cache_hit_tokens").asInt(0); // Groq field name
            if (input + output > 0) {
                quotaTracker.addUsage(agentId, p.getId(), p.getType().name(), p.getModelId(),
                    input, cached, output);
                if (cached > 0) {
                    log.info("[LLM][CACHE] {} — input={} cached={} output={} (économie ~{}%)",
                        p.getModelId(), input, cached, output,
                        (int)(100.0 * cached / Math.max(1, input)));
                }
            }
        } catch (Exception ignored) {}
    }

    private Flux<String> streamChatOpenAiCompat(LlmProvider p, List<ChatMessage> messages, String agentId) {
        String body = buildOpenAiBody(messages, p, true);

        return buildClient(p, false)
            .post().uri("/chat/completions")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + decryptKey(p))
            .contentType(MediaType.APPLICATION_JSON)
            .accept(MediaType.TEXT_EVENT_STREAM)
            .bodyValue(body)
            .retrieve()
            .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                resp -> resp.bodyToMono(String.class).map(errBody -> {
                    log.error("[LLM] OpenAI-compat stream error {} — body: {}", resp.statusCode().value(), errBody);
                    return new RuntimeException("Groq " + resp.statusCode().value() + ": " + errBody);
                }))
            // bodyToFlux(String.class) with text/event-stream uses ServerSentEventHttpMessageReader:
            // each emitted String is already the raw "data:" field value (no "data:" prefix).
            .bodyToFlux(String.class)
            .flatMap(data -> {
                if (data == null || data.isBlank() || "[DONE]".equals(data.trim())) return Flux.empty();
                String json = data.startsWith("data:") ? data.substring(5).trim() : data.trim();
                if ("[DONE]".equals(json)) return Flux.empty();
                try {
                    JsonNode node  = objectMapper.readTree(json);
                    String   delta = node.path("choices").path(0)
                                         .path("delta").path("content").asText("");
                    // Le dernier chunk du stream contient les stats d'usage (stream_options)
                    if (!node.path("usage").isMissingNode()) recordOpenAiUsage(agentId, p, node);
                    return delta.isEmpty() ? Flux.empty() : Flux.just(delta);
                } catch (Exception ignored) {
                    return Flux.empty();
                }
            })
            .onErrorResume(e -> {
                log.error("[LLM] stream error: {}", e.getMessage());
                return Flux.just(friendlyError(e.getMessage()));
            });
    }

    private Flux<String> streamChatOpenAiCompatWithRetry(LlmProvider p, List<ChatMessage> messages,
                                                          String agentId, int retriesLeft) {
        return streamChatOpenAiCompat(p, messages, agentId)
            .onErrorResume(e -> {
                String msg = e.getMessage() != null ? e.getMessage() : "";
                boolean isRpm = msg.contains("429") && !DAILY_QUOTA_PATTERN.matcher(msg).find();
                if (isRpm && retriesLeft > 0) {
                    long waitMs = parseRetryAfterMs(msg) + 1000;
                    log.warn("[LLM] Stream rate limit 429 (RPM) — attente {}ms avant retry ({} left)", waitMs, retriesLeft);
                    try { Thread.sleep(waitMs); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                    LlmProvider fresh = resolveProvider(agentId);
                    LlmProvider fresh1 = resolveProvider(agentId);
                    return streamChatOpenAiCompatWithRetry(fresh1, messages, agentId, retriesLeft - 1);
                }
                if (isTransientNetworkError(msg) && retriesLeft > 0) {
                    long waitMs = 3000L * (MAX_RETRIES - retriesLeft + 1);
                    log.warn("[LLM] Stream erreur réseau transitoire ({}) — attente {}ms avant retry ({} left)", msg, waitMs, retriesLeft);
                    try { Thread.sleep(waitMs); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                    LlmProvider fresh2 = resolveProvider(agentId);
                    return streamChatOpenAiCompatWithRetry(fresh2, messages, agentId, retriesLeft - 1);
                }
                if (msg.contains("429")) {
                    log.warn("[LLM] Stream quota épuisé pour agentId={}", agentId);
                    if (DAILY_QUOTA_PATTERN.matcher(msg).find()) {
                        quotaTracker.tryRecord(agentId, p.getId(),
                            p.getType().name(), p.getModelId(), msg);
                    }
                } else {
                    log.error("[LLM] stream error final: {}", msg);
                }
                return Flux.just(friendlyError(msg));
            });
    }

    private String friendlyError(String msg) {
        if (msg == null) return "⚠️ Le service IA est temporairement indisponible. Veuillez réessayer.";
        if (msg.contains("402") || msg.toLowerCase().contains("insufficient balance") || msg.toLowerCase().contains("insufficient_balance")) {
            return "⚠️ Solde insuffisant sur votre compte provider. Rechargez votre crédit sur la plateforme (ex : platform.deepseek.com) puis réessayez.";
        }
        if (msg.contains("401") || msg.toLowerCase().contains("invalid api key") || msg.toLowerCase().contains("unauthorized")) {
            return "⚠️ Clé API invalide ou expirée. Vérifiez votre clé dans l'onglet Clés API et assurez-vous qu'elle est active sur la plateforme du provider.";
        }
        if (msg.contains("429")) {
            if (DAILY_QUOTA_PATTERN.matcher(msg).find()) {
                long retryMin = parseRetryAfterMs(msg) / 60_000;
                String delay = retryMin > 0 ? " (dans ~" + retryMin + " min)" : " (demain ou après minuit)";
                return "⚠️ Quota de tokens épuisé pour aujourd'hui" + delay
                     + ". Veuillez patienter ou passer sur un plan supérieur.";
            }
            return "⚠️ Limite de requêtes atteinte. L'agent va réessayer automatiquement dans quelques secondes.";
        }
        if (isTransientNetworkError(msg)) {
            return "⚠️ Connexion au service IA perdue. Vérifiez votre réseau et réessayez.";
        }
        return "⚠️ Le service IA a rencontré une erreur. Veuillez réessayer.";
    }

    private long parseRetryAfterMs(String errorBody) {
        try {
            Matcher m = RETRY_AFTER_PATTERN.matcher(errorBody);
            if (m.find()) return (long)(Double.parseDouble(m.group(1)) * 1000) + 500;
        } catch (Exception ignored) {}
        return 15000; // 15s par défaut
    }

    // ── Anthropic (/v1/messages — format différent) ───────────────────────────

    private String chatAnthropic(LlmProvider p, List<ChatMessage> messages, String agentId) throws Exception {
        String body     = buildAnthropicBody(messages, p, false);
        String response = buildClient(p, true)
            .post().uri("/messages")
            .header("x-api-key",           decryptKey(p))
            .header("anthropic-version",   "2023-06-01")
            .header("anthropic-beta",      "prompt-caching-2024-07-31")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(body)
            .retrieve()
            .bodyToMono(String.class)
            .block();

        JsonNode root = objectMapper.readTree(response);
        recordAnthropicUsage(agentId, p, root);
        return root.path("content").path(0).path("text").asText("");
    }

    private Flux<String> streamChatAnthropic(LlmProvider p, List<ChatMessage> messages, String agentId) {
        String body = buildAnthropicBody(messages, p, true);

        return buildClient(p, true)
            .post().uri("/messages")
            .header("x-api-key",           decryptKey(p))
            .header("anthropic-version",   "2023-06-01")
            .header("anthropic-beta",      "prompt-caching-2024-07-31")
            .contentType(MediaType.APPLICATION_JSON)
            .accept(MediaType.TEXT_EVENT_STREAM)
            .bodyValue(body)
            .retrieve()
            .bodyToFlux(String.class)
            .flatMap(data -> {
                if (data == null || data.isBlank()) return Flux.empty();
                String json = data.startsWith("data:") ? data.substring(5).trim() : data.trim();
                try {
                    JsonNode node = objectMapper.readTree(json);
                    String type = node.path("type").asText();
                    // message_start : tokens d'entrée (input + cache)
                    if ("message_start".equals(type)) {
                        recordAnthropicUsage(agentId, p, node.path("message"));
                    }
                    // message_delta : tokens de sortie
                    if ("message_delta".equals(type)) {
                        recordAnthropicUsage(agentId, p, node);
                    }
                    if ("content_block_delta".equals(type)) {
                        String text = node.path("delta").path("text").asText("");
                        return text.isEmpty() ? Flux.empty() : Flux.just(text);
                    }
                } catch (Exception ignored) {}
                return Flux.empty();
            })
            .onErrorResume(e -> {
                log.error("Anthropic stream error: {}", e.getMessage());
                return Flux.just("⚠️ Erreur Anthropic : " + e.getMessage());
            });
    }

    private void recordAnthropicUsage(String agentId, LlmProvider p, JsonNode root) {
        try {
            JsonNode usage = root.path("usage");
            if (usage.isMissingNode()) return;
            int input          = usage.path("input_tokens").asInt(0);
            int output         = usage.path("output_tokens").asInt(0);
            int cacheRead      = usage.path("cache_read_input_tokens").asInt(0);
            int cacheCreation  = usage.path("cache_creation_input_tokens").asInt(0);
            if (input + output + cacheRead > 0) {
                quotaTracker.addUsage(agentId, p.getId(), p.getType().name(), p.getModelId(),
                    input + cacheCreation, cacheRead, output);
                if (cacheRead > 0) {
                    log.info("[LLM][CACHE] Anthropic {} — input={} cache_read={} cache_write={} output={}",
                        p.getModelId(), input, cacheRead, cacheCreation, output);
                }
            }
        } catch (Exception ignored) {}
    }

    // ── Body builders ─────────────────────────────────────────────────────────

    private String buildOpenAiBody(List<ChatMessage> messages, LlmProvider p, boolean stream) {
        try {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("model",       p.getModelId() != null ? p.getModelId() : defaultModel);
            body.put("temperature", p.getTemperature());
            body.put("max_tokens",  p.getMaxTokens());
            body.put("stream",      stream);

            // Demande les stats d'usage dans le stream (dernier chunk)
            if (stream) {
                body.putObject("stream_options").put("include_usage", true);
            }

            ArrayNode msgs = body.putArray("messages");
            for (ChatMessage m : messages) {
                ObjectNode msg = msgs.addObject();
                // Groq/OpenAI ne supportent que system/user/assistant — tool → user
                String role = "tool".equals(m.role()) ? "user" : m.role();
                msg.put("role",    role);
                msg.put("content", m.content() != null ? m.content() : "");
                // Note : OpenAI/Groq/DeepSeek cachent automatiquement les préfixes stables
                // (OpenAI ≥ 1024 tokens, Groq ≥ 1024 tokens, DeepSeek KV cache auto)
                // Pas besoin de cache_control explicite — il suffit de structurer les messages
                // avec le system prompt en premier, toujours identique, pour que le cache s'active.
            }
            return objectMapper.writeValueAsString(body);
        } catch (Exception e) {
            throw new RuntimeException("Failed to build OpenAI request body", e);
        }
    }

    private String buildAnthropicBody(List<ChatMessage> messages, LlmProvider p, boolean stream) {
        try {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("model",      p.getModelId() != null ? p.getModelId() : defaultModel);
            body.put("max_tokens", p.getMaxTokens());
            body.put("stream",     stream);

            // Anthropic : system prompt = array avec cache_control pour activer le prompt caching
            String systemContent = messages.stream()
                .filter(m -> "system".equals(m.role()))
                .map(ChatMessage::content)
                .findFirst().orElse("");

            if (!systemContent.isBlank()) {
                ArrayNode systemArray  = body.putArray("system");
                ObjectNode systemBlock = systemArray.addObject();
                systemBlock.put("type", "text");
                systemBlock.put("text", systemContent);
                // Cache le system prompt (fixe par agent) → économie 90% sur tokens d'entrée
                systemBlock.putObject("cache_control").put("type", "ephemeral");
            }

            ArrayNode msgs = body.putArray("messages");
            for (ChatMessage m : messages) {
                if ("system".equals(m.role())) continue;
                ObjectNode msg = msgs.addObject();
                // Anthropic n'accepte que "user" et "assistant"
                msg.put("role",    "tool".equals(m.role()) ? "user" : m.role());
                msg.put("content", m.content() != null ? m.content() : "");
            }
            return objectMapper.writeValueAsString(body);
        } catch (Exception e) {
            throw new RuntimeException("Failed to build Anthropic request body", e);
        }
    }

    // ── Quota ─────────────────────────────────────────────────────────────────

    public record QuotaStatus(
        String provider, String model, int maxTokens,
        boolean hasData, Integer dailyLimit, Integer dailyUsed, Integer dailyRemaining
    ) {}

    public QuotaStatus getQuotaStatus(String agentId) {
        LlmProvider p = resolveProvider(agentId);
        return quotaTracker.getState(agentId)
            .map(s -> new QuotaStatus(
                p.getType().name(), p.getModelId(), p.getMaxTokens(),
                true, s.limit(), s.used(), s.remaining()))
            .orElseGet(() -> new QuotaStatus(
                p.getType().name(), p.getModelId(), p.getMaxTokens(),
                false, null, null, null));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Résout le provider LLM utilisé pour un agent.
     * Ordre de résolution :
     *   1. Providers rattachés à l'agent (primary puis backups)
     *   2. Providers du compte de l'agent (ownerId = email JWT)
     *   3. Providers du compte admin → provider par défaut pour tous les comptes
     *   4. Fallback : GROQ_API_KEY de l'environnement
     */
    public LlmProvider resolveProvider(String agentId) {
        String ownerId = agentRepo.findByIdAndDeletedFalse(agentId)
            .map(Agent::getOwnerId).orElse(null);
        return resolveProvider(agentId, ownerId);
    }

    public LlmProvider resolveProvider(String agentId, String ownerId) {
        // 1. Providers de l'agent
        LlmProvider p = llmRepo.findByAgentIdAndPrimaryTrueAndDeletedFalse(agentId)
            .stream().findFirst()
            .orElseGet(() -> llmRepo.findByAgentIdAndDeletedFalseOrderByPrimaryDesc(agentId)
                .stream().findFirst().orElse(null));
        if (p != null) return p;

        // 2. Providers du compte utilisateur (agent.ownerId)
        if (ownerId != null && !ownerId.isBlank()) {
            p = llmRepo.findByUserIdAndPrimaryTrueAndDeletedFalse(ownerId)
                .stream().findFirst()
                .orElseGet(() -> llmRepo.findByUserIdAndDeletedFalseOrderByPrimaryDesc(ownerId)
                    .stream().findFirst().orElse(null));
            if (p != null) return p;
        }

        // 3. Providers du compte admin → provider par défaut pour tous les comptes
        if (adminUserId != null && !adminUserId.isBlank() && !adminUserId.equals(ownerId)) {
            p = llmRepo.findByUserIdAndPrimaryTrueAndDeletedFalse(adminUserId)
                .stream().findFirst()
                .orElseGet(() -> llmRepo.findByUserIdAndDeletedFalseOrderByPrimaryDesc(adminUserId)
                    .stream().findFirst().orElse(null));
            if (p != null) {
                log.info("[LLM] Utilisation du provider par défaut (admin) pour agentId={}", agentId);
                return p;
            }
        }

        // 4. Fallback GROQ env
        return buildGroqFallback(agentId);
    }

    private LlmProvider buildGroqFallback(String agentId) {
        if (groqApiKey == null || groqApiKey.isBlank()) {
            throw new IllegalStateException("Aucun LLM provider configuré pour l'agent: " + agentId);
        }
        log.info("[LLM] Aucun provider DB pour agentId={}, utilisation du GROQ_API_KEY env", agentId);
        LlmProvider p = new LlmProvider();
        p.setType(LlmType.GROQ);
        p.setModelId(defaultModel);
        p.setBaseUrl(groqBaseUrl);
        p.setEncryptedApiKey(encryptionService.encrypt(groqApiKey));
        p.setTemperature(0.7);
        p.setMaxTokens(1024);
        p.setStreamingEnabled(true);
        p.setRequestTimeoutSeconds(60);
        p.setPrimary(true);
        p.setActive(true);
        return p;
    }

    private String decryptKey(LlmProvider p) {
        if (p.getEncryptedApiKey() == null || p.getEncryptedApiKey().isBlank()) {
            return (p.getType() == LlmType.GROQ && groqApiKey != null) ? groqApiKey : "";
        }
        return encryptionService.decrypt(p.getEncryptedApiKey());
    }

    /**
     * Construit le WebClient avec la bonne base URL.
     * @param forAnthropic true → utilise la base URL Anthropic directe
     */
    private WebClient buildClient(LlmProvider p, boolean forAnthropic) {
        String baseUrl = p.getBaseUrl() != null ? p.getBaseUrl() : resolveDefaultBaseUrl(p.getType());
        return webClientBuilder
            .baseUrl(baseUrl)
            .codecs(conf -> conf.defaultCodecs().maxInMemorySize(4 * 1024 * 1024)) // 4 MB
            .build();
    }

    private String resolveDefaultBaseUrl(LlmType type) {
        return switch (type) {
            case GROQ      -> groqBaseUrl;
            case OPENAI    -> openAiBaseUrl;
            case OLLAMA    -> ollamaBaseUrl;
            case ANTHROPIC -> "https://api.anthropic.com/v1";
            case MISTRAL   -> "https://api.mistral.ai/v1";
            case GEMINI    -> "https://generativelanguage.googleapis.com/v1beta/openai";
            default        -> openAiBaseUrl;
        };
    }
}
