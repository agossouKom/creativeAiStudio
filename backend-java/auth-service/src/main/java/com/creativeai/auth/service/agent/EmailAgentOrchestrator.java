package com.creativeai.auth.service.agent;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Core agentic loop:
 *   1. Build context messages (system prompt + memory + user message)
 *   2. Call LLM (non-streaming) to detect tool calls
 *   3. Execute tool if needed, save result, loop (max 5 iterations)
 *   4. Stream final answer to client
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailAgentOrchestrator {

    private final GroqLlmService      llmService;
    private final AgentMemoryService  memoryService;
    private final ToolRegistry        toolRegistry;
    private final ObjectMapper        objectMapper;

    private static final int MAX_ITERATIONS = 5;
    private static final Pattern TOOL_CALL_PATTERN =
        Pattern.compile("TOOL_CALL:(\\w+):(.+?)(?:\\n|$)", Pattern.DOTALL);

    public Flux<String> chat(String userId, String userMessage) {
        return Flux.create(sink -> {
            try {
                // 1. Persist user message
                memoryService.saveUser(userId, userMessage);

                // 2. Build context with system prompt
                List<ChatMessage> ctx = buildContext(userId);

                // 3. Agentic loop — resolve tool calls first (non-streaming)
                int iterations = 0;
                String finalAnswer = null;

                while (iterations < MAX_ITERATIONS) {
                    iterations++;
                    String llmResponse = llmService.chat(userId, ctx);
                    log.debug("[AGENT] iteration={} response_start={}", iterations,
                              llmResponse.substring(0, Math.min(80, llmResponse.length())));

                    // Check for tool call
                    ToolCallRequest toolCall = extractToolCall(llmResponse);
                    if (toolCall == null) {
                        // No more tool calls → this is the final answer
                        finalAnswer = llmResponse.startsWith("TOOL_CALL:")
                            ? "Désolé, je n'ai pas pu exécuter cette action."
                            : llmResponse;
                        break;
                    }

                    // 4. Notify client about tool execution
                    sink.next("🔧 *Utilisation de l'outil* `" + toolCall.name() + "`...\n\n");

                    // 5. Execute tool
                    String toolResult = toolRegistry.execute(userId, toolCall.name(), toolCall.params());
                    memoryService.saveToolResult(userId, toolCall.name(), toolResult);

                    // 6. Add tool result to context and loop
                    ctx = buildContext(userId);
                }

                if (finalAnswer == null) {
                    finalAnswer = "J'ai atteint la limite de traitement. Veuillez reformuler votre demande.";
                }

                // 7. Stream final answer chunk by chunk
                memoryService.saveAssistant(userId, finalAnswer);
                final String answer = finalAnswer;
                llmService.streamChat(userId, buildContextWithAnswer(userId, answer))
                    .subscribe(
                        sink::next,
                        err -> {
                            // Fallback: send the pre-computed answer directly
                            sink.next(answer);
                            sink.next("[DONE]");
                            sink.complete();
                        },
                        () -> {
                            sink.next("[DONE]");
                            sink.complete();
                        }
                    );

            } catch (IllegalStateException e) {
                // No API key configured
                log.warn("[AGENT] No credential for userId={}: {}", userId, e.getMessage());
                sink.next("⚠️ " + e.getMessage() + "\n\nRendez-vous dans **Paramètres > Clés API** pour configurer votre clé Groq.");
                sink.next("[DONE]");
                sink.complete();
            } catch (Exception e) {
                log.error("[AGENT] Error for userId={}: {}", userId, e.getMessage(), e);
                sink.next("⚠️ Erreur : " + e.getMessage());
                sink.next("[DONE]");
                sink.complete();
            }
        });
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private List<ChatMessage> buildContext(String userId) {
        List<ChatMessage> ctx = new ArrayList<>();
        ctx.add(ChatMessage.system(toolRegistry.buildSystemPrompt()));
        ctx.addAll(memoryService.buildContextMessages(userId));
        return ctx;
    }

    private List<ChatMessage> buildContextWithAnswer(String userId, String answer) {
        // For re-streaming, just stream the answer as a single assistant message
        return List.of(
            ChatMessage.system("Reformule cette réponse de façon naturelle et fluide:\n\n" + answer)
        );
    }

    private ToolCallRequest extractToolCall(String response) {
        if (response == null || !response.contains("TOOL_CALL:")) return null;

        // Handle format from non-streaming: "TOOL_CALL:tool_name:..."
        if (response.startsWith("TOOL_CALL:")) {
            String[] parts = response.substring("TOOL_CALL:".length()).split(":", 2);
            if (parts.length < 2) return null;
            String toolName = parts[0].trim();
            String argsJson = parts[1].trim();
            return parseToolCall(toolName, argsJson);
        }

        Matcher m = TOOL_CALL_PATTERN.matcher(response);
        if (m.find()) {
            return parseToolCall(m.group(1).trim(), m.group(2).trim());
        }
        return null;
    }

    private ToolCallRequest parseToolCall(String name, String argsJson) {
        try {
            Map<String, Object> params = objectMapper.readValue(
                argsJson, new TypeReference<>() {});
            return new ToolCallRequest(name, params);
        } catch (Exception e) {
            log.warn("Could not parse tool args '{}': {}", argsJson, e.getMessage());
            return new ToolCallRequest(name, Map.of());
        }
    }

    public record ToolCallRequest(String name, Map<String, Object> params) {}
}
