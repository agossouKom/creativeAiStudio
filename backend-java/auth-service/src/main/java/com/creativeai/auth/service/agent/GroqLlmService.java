package com.creativeai.auth.service.agent;

import com.creativeai.auth.model.UserApiCredential;
import com.creativeai.auth.repository.UserApiCredentialRepository;
import com.creativeai.auth.security.EncryptionService;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class GroqLlmService {

    private final UserApiCredentialRepository credentialRepo;
    private final EncryptionService            encryptionService;
    private final WebClient.Builder            webClientBuilder;
    private final ObjectMapper                 objectMapper;

    @Value("${agent.groq-base-url}")  private String groqBaseUrl;
    @Value("${agent.default-model}") private String defaultModel;

    // ── Streaming chat ─────────────────────────────────────────────────────

    public Flux<String> streamChat(String userId, List<ChatMessage> messages) {
        String apiKey = resolveApiKey(userId);

        String requestBody = buildRequestBody(messages, true);

        return webClientBuilder.build()
            .post()
            .uri(groqBaseUrl + "/chat/completions")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(requestBody)
            .retrieve()
            .bodyToFlux(String.class)
            .flatMap(line -> {
                if (line.startsWith("data: ")) {
                    String json = line.substring(6).trim();
                    if ("[DONE]".equals(json)) return Flux.empty();
                    try {
                        JsonNode node = objectMapper.readTree(json);
                        String delta = node.path("choices").path(0)
                                           .path("delta").path("content").asText("");
                        if (!delta.isEmpty()) return Flux.just(delta);
                    } catch (Exception ignored) {}
                }
                return Flux.empty();
            })
            .onErrorResume(e -> {
                log.error("Groq streaming error: {}", e.getMessage());
                return Flux.just("⚠️ Erreur LLM : " + e.getMessage());
            });
    }

    // ── Non-streaming call (for tool-call resolution) ─────────────────────

    public String chat(String userId, List<ChatMessage> messages) {
        String apiKey = resolveApiKey(userId);
        String requestBody = buildRequestBody(messages, false);

        try {
            String response = webClientBuilder.build()
                .post()
                .uri(groqBaseUrl + "/chat/completions")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .block();

            JsonNode root    = objectMapper.readTree(response);
            JsonNode message = root.path("choices").path(0).path("message");

            // Check for tool call
            JsonNode toolCalls = message.path("tool_calls");
            if (!toolCalls.isMissingNode() && toolCalls.isArray() && toolCalls.size() > 0) {
                JsonNode tc       = toolCalls.get(0);
                String toolName   = tc.path("function").path("name").asText();
                String toolArgs   = tc.path("function").path("arguments").asText("{}");
                return "TOOL_CALL:" + toolName + ":" + toolArgs;
            }

            return message.path("content").asText("");
        } catch (Exception e) {
            log.error("Groq chat error: {}", e.getMessage());
            return "⚠️ Erreur LLM : " + e.getMessage();
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private String resolveApiKey(String userId) {
        Optional<UserApiCredential> cred = credentialRepo
            .findByUserIdAndProviderAndActiveTrue(userId, "groq");

        if (cred.isPresent()) {
            UserApiCredential c = cred.get();
            c.setLastUsedAt(LocalDateTime.now());
            credentialRepo.save(c);
            return encryptionService.decrypt(c.getEncryptedApiKey());
        }

        throw new IllegalStateException(
            "Aucune clé Groq configurée. Rendez-vous dans Paramètres > Clés API.");
    }

    private String buildRequestBody(List<ChatMessage> messages, boolean stream) {
        try {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("model",       defaultModel);
            body.put("temperature", 0.7);
            body.put("max_tokens",  2048);
            body.put("stream",      stream);

            ArrayNode msgs = body.putArray("messages");
            for (ChatMessage m : messages) {
                ObjectNode msg = msgs.addObject();
                msg.put("role",    m.role());
                msg.put("content", m.content() != null ? m.content() : "");
            }
            return objectMapper.writeValueAsString(body);
        } catch (Exception e) {
            throw new RuntimeException("Failed to build request body", e);
        }
    }
}
