package com.creativeai.agentteam.llm;

import com.creativeai.agentteam.model.LlmProvider;
import com.creativeai.agentteam.model.enums.LlmType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.anthropic.AnthropicChatModel;
import org.springframework.ai.anthropic.AnthropicChatOptions;
import org.springframework.ai.anthropic.api.AnthropicApi;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Construit un Spring AI {@link ChatModel} à la volée depuis un {@link LlmProvider} stocké en DB.
 *
 * Utilise le function calling natif du provider (JSON schema → tool call JSON)
 * plutôt que le parsing regex TOOL_CALL: home-made de l'ancien LlmGateway.
 *
 * Providers supportés :
 *  - OpenAI-compatible : Groq, Ollama, DeepSeek, Mistral, Gemini (via openai compat endpoint)
 *  - Anthropic         : claude-* via l'API native
 */
@Slf4j
@Component
public class ChatModelFactory {

    public ChatModel buildFor(LlmProvider provider, String decryptedApiKey) {
        return switch (provider.getType()) {
            case ANTHROPIC -> buildAnthropic(provider, decryptedApiKey);
            default        -> buildOpenAiCompat(provider, decryptedApiKey);
        };
    }

    // ── OpenAI-compatible ─────────────────────────────────────────────────────

    private ChatModel buildOpenAiCompat(LlmProvider p, String apiKey) {
        String baseUrl = resolveBaseUrl(p);
        log.debug("[CHAT_MODEL] OpenAI-compat provider={} model={} baseUrl={}",
            p.getType(), p.getModelId(), baseUrl);

        // Apache HTTP Client 5 has broader TLS cipher-suite support than
        // Java's built-in HttpURLConnection and fixes handshake failures with
        // providers like DeepSeek.
        RestClient.Builder rcb = RestClient.builder()
            .requestFactory(new HttpComponentsClientHttpRequestFactory());

        OpenAiApi api = OpenAiApi.builder()
            .apiKey(apiKey != null ? apiKey : "")
            .baseUrl(baseUrl)
            .restClientBuilder(rcb)
            .build();

        return OpenAiChatModel.builder()
            .openAiApi(api)
            .defaultOptions(OpenAiChatOptions.builder()
                .model(p.getModelId())
                .temperature(p.getTemperature())
                .maxTokens(p.getMaxTokens())
                .build())
            .build();
    }

    // ── Anthropic ─────────────────────────────────────────────────────────────

    private ChatModel buildAnthropic(LlmProvider p, String apiKey) {
        log.debug("[CHAT_MODEL] Anthropic provider model={}", p.getModelId());

        AnthropicApi api = AnthropicApi.builder()
            .apiKey(apiKey != null ? apiKey : "")
            .build();

        return AnthropicChatModel.builder()
            .anthropicApi(api)
            .defaultOptions(AnthropicChatOptions.builder()
                .model(p.getModelId())
                .maxTokens(p.getMaxTokens())
                .temperature(p.getTemperature())
                .build())
            .build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String resolveBaseUrl(LlmProvider p) {
        if (p.getBaseUrl() != null && !p.getBaseUrl().isBlank()) {
            // Spring AI's OpenAiApi internally appends /v1/chat/completions,
            // so strip trailing /v1 that may have been stored for WebClient usage.
            String url = p.getBaseUrl().trim();
            if (url.endsWith("/v1")) url = url.substring(0, url.length() - 3);
            return url;
        }
        return switch (p.getType()) {
            case GROQ      -> "https://api.groq.com/openai";
            case OPENAI    -> "https://api.openai.com";
            case OLLAMA    -> "http://localhost:11434";
            case MISTRAL   -> "https://api.mistral.ai";
            case GEMINI    -> "https://generativelanguage.googleapis.com/v1beta/openai";
            case DEEPSEEK  -> "https://api.deepseek.com";
            default        -> "https://api.openai.com";
        };
    }
}
