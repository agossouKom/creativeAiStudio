package com.creativeai.telegram.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.HashMap;
import java.util.Map;

/**
 * Client REST vers agent-team-service.
 * Toutes les réponses sont retournées en JSON string brut — le LLM les interprète.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AgentTeamClient {

    private final WebClient    agentTeamWebClient;
    private final WebClient    authServiceWebClient;
    private final ObjectMapper objectMapper;

    // ── Tasks ─────────────────────────────────────────────────────────────────

    public String createTask(String userId, String jwt,
                             String title, String description, String type,
                             String priority, String assignedAgentId, String expectedResult,
                             String contacts, String products, String dueDate, String scheduledAt,
                             Boolean confidential) {
        Map<String, Object> body = new HashMap<>();
        body.put("title",       title);
        body.put("description", description);
        body.put("type",        type);
        body.put("priority",    priority);
        body.put("source",      "API");
        if (assignedAgentId != null && !assignedAgentId.isBlank()) body.put("assignedAgentId", assignedAgentId);
        if (expectedResult  != null && !expectedResult.isBlank())  body.put("expectedResult",  expectedResult);
        if (contacts        != null && !contacts.isBlank())        body.put("contacts",         contacts);
        if (products        != null && !products.isBlank())        body.put("products",         products);
        if (dueDate         != null && !dueDate.isBlank())         body.put("dueDate",          dueDate);
        if (scheduledAt     != null && !scheduledAt.isBlank())     body.put("scheduledAt",      scheduledAt);
        if (confidential    != null)                               body.put("confidential",     confidential);

        return post("/api/tasks", jwt, body);
    }

    public boolean checkEmailExists(String email) {
        try {
            String json = executeGet(authServiceWebClient.get()
                .uri(u -> u.path("/check-email").queryParam("email", email).build()));
            log.info("[CLIENT:checkEmail] email={} response={}", email, json);
            com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(json);
            return node.path("exists").asBoolean(false);
        } catch (Exception e) {
            log.warn("[CLIENT:checkEmail] error: {}", e.getMessage());
            return false;
        }
    }

    public String updateTaskStatus(String taskId, String status, String jwt) {
        try {
            return agentTeamWebClient.patch()
                .uri(u -> u.path("/api/tasks/" + taskId + "/status").queryParam("status", status).build())
                .header("Authorization", "Bearer " + jwt)
                .retrieve()
                .bodyToMono(String.class)
                .block();
        } catch (Exception e) {
            log.error("[CLIENT:patchStatus] taskId={} status={}: {}", taskId, status, e.getMessage());
            return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
        }
    }

    /** Returns agentId of the best agent for the given task type, or null if none found. */
    public String findAgentForTaskType(String taskType, String jwt) {
        try {
            String json = listAgents("", jwt, 0, 50);
            com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(json);
            com.fasterxml.jackson.databind.JsonNode arr =
                root.isArray() ? root : root.path("content");
            if (!arr.isArray()) return null;

            String targetType = TASK_TO_AGENT_TYPE.getOrDefault(taskType, "");

            // Priority 1: exact type match
            for (com.fasterxml.jackson.databind.JsonNode a : arr) {
                if ("ACTIVE".equals(a.path("status").asText()) &&
                    targetType.equals(a.path("type").asText())) {
                    log.info("[CLIENT:findAgent] taskType={} → agent={} ({})",
                        taskType, a.path("name").asText(), a.path("id").asText());
                    return a.path("id").asText();
                }
            }
            // Priority 2: SCRUM_MASTER fallback
            for (com.fasterxml.jackson.databind.JsonNode a : arr) {
                if ("ACTIVE".equals(a.path("status").asText()) &&
                    "SCRUM_MASTER".equals(a.path("type").asText())) {
                    log.info("[CLIENT:findAgent] taskType={} → SCRUM_MASTER fallback agent={}",
                        taskType, a.path("id").asText());
                    return a.path("id").asText();
                }
            }
            // Priority 3: any active agent
            for (com.fasterxml.jackson.databind.JsonNode a : arr) {
                if ("ACTIVE".equals(a.path("status").asText())) {
                    return a.path("id").asText();
                }
            }
        } catch (Exception e) {
            log.error("[CLIENT:findAgent] {}", e.getMessage());
        }
        return null;
    }

    private static final java.util.Map<String, String> TASK_TO_AGENT_TYPE = java.util.Map.ofEntries(
        java.util.Map.entry("EMAIL_RESPONSE",      "EMAIL_MANAGER"),
        java.util.Map.entry("EMAIL_CLASSIFICATION","EMAIL_MANAGER"),
        java.util.Map.entry("PROSPECTION",         "PROSPECTION"),
        java.util.Map.entry("PROSPECT_SEARCH",     "PROSPECTION"),
        java.util.Map.entry("PROSPECT_QUALIFY",    "PROSPECTION"),
        java.util.Map.entry("PROSPECT_OUTREACH",   "PROSPECTION"),
        java.util.Map.entry("CAMPAIGN_CREATE",     "MARKETING"),
        java.util.Map.entry("MARKETING",           "MARKETING"),
        java.util.Map.entry("SOCIAL_CONTENT",      "SOCIAL_MEDIA"),
        java.util.Map.entry("SOCIAL_POST",         "SOCIAL_MEDIA"),
        java.util.Map.entry("IMAGE_CREATE",        "CREATIVE"),
        java.util.Map.entry("VIDEO_CREATE",        "CREATIVE"),
        java.util.Map.entry("FLYER_CREATE",        "CREATIVE"),
        java.util.Map.entry("REPORT_GENERATE",     "ANALYST"),
        java.util.Map.entry("DOCUMENT_SUMMARIZE",  "ANALYST"),
        java.util.Map.entry("PRESENTATION_CREATE", "ANALYST"),
        java.util.Map.entry("CUSTOMER_SUPPORT",    "SUPPORT"),
        java.util.Map.entry("SECURITY_AUDIT",      "SECURITY"),
        java.util.Map.entry("ACCOUNTING",          "ACCOUNTING"),
        java.util.Map.entry("ACCOUNTING_REPORT",   "ACCOUNTING"),
        java.util.Map.entry("SCRUM",               "SCRUM_MASTER")
    );

    public String fetchClients(String jwt) {
        return executeGet(authServiceWebClient.get()
            .uri("/api/user/clients")
            .header("Authorization", "Bearer " + jwt));
    }

    public String fetchProducts(String jwt) {
        return executeGet(authServiceWebClient.get()
            .uri("/api/user/products")
            .header("Authorization", "Bearer " + jwt));
    }

    public String listTasks(String userId, String jwt, String status, int limit) {
        WebClient.RequestHeadersSpec<?> req = agentTeamWebClient.get()
            .uri(u -> {
                var b = u.path("/api/tasks")
                         .queryParam("page", 0)
                         .queryParam("size", limit)
                         .queryParam("sort", "createdAt,desc");
                if (status != null && !status.isBlank()) b.queryParam("status", status);
                return b.build();
            })
            .header("Authorization", "Bearer " + jwt);

        return executeGet(req);
    }

    public String getTask(String userId, String jwt, String taskId) {
        return get("/api/tasks/" + taskId, jwt);
    }

    public String getTaskByCode(String userId, String jwt, String code) {
        return get("/api/tasks/by-code/" + code, jwt);
    }

    // ── Agents ────────────────────────────────────────────────────────────────

    public String listAgents(String userId, String jwt, int page, int size) {
        return executeGet(
            agentTeamWebClient.get()
                .uri(u -> u.path("/api/agents")
                           .queryParam("page", page)
                           .queryParam("size", size)
                           .build())
                .header("Authorization", "Bearer " + jwt)
        );
    }

    public String getAgent(String userId, String jwt, String agentId) {
        return get("/api/agents/" + agentId, jwt);
    }

    public String getAgentByCode(String userId, String jwt, String code) {
        return get("/api/agents/by-code/" + code, jwt);
    }

    // ── Chat (collecte SSE → réponse complète) ────────────────────────────────

    private static final java.util.regex.Pattern SESSION_PATTERN =
        java.util.regex.Pattern.compile("^\\[SESSION:[a-f0-9\\-]+\\]$");
    private static final java.util.regex.Pattern CONTENT_JSON_PATTERN =
        java.util.regex.Pattern.compile("\\{\"content\"\\s*:\\s*\"(.*)\"}$", java.util.regex.Pattern.DOTALL);

    public String chatWithAgent(String userId, String jwt, String agentId, String message, String context) {
        Map<String, Object> body = new HashMap<>();
        body.put("message", message);
        if (context != null && !context.isBlank()) body.put("context", context);

        try {
            // Collect only the last {"content":"..."} JSON chunk; ignore SSE noise
            java.util.concurrent.atomic.AtomicReference<String> lastContent =
                new java.util.concurrent.atomic.AtomicReference<>("");

            agentTeamWebClient.post()
                .uri("/api/agents/" + agentId + "/chat/stream")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToFlux(String.class)
                .filter(chunk -> !chunk.equals("[DONE]"))
                .filter(chunk -> !chunk.equals("[PING]"))
                .filter(chunk -> !SESSION_PATTERN.matcher(chunk).matches())
                .filter(chunk -> !chunk.startsWith("🔧"))
                .doOnNext(chunk -> {
                    // If it's a {"content":"..."} JSON, update the final content
                    try {
                        com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(chunk);
                        String c = node.path("content").asText("");
                        if (!c.isBlank()) { lastContent.set(c); return; }
                    } catch (Exception ignored) {}
                    // Otherwise append raw text (plain token stream)
                    if (!chunk.isBlank()) lastContent.updateAndGet(prev -> prev + chunk);
                })
                .blockLast();

            String result = lastContent.get().trim();
            return result.isBlank() ? "{\"response\":\"(réponse vide de l'agent)\"}"
                                    : "{\"response\":\"" + escapeJson(result) + "\"}";

        } catch (WebClientResponseException e) {
            log.error("[CLIENT:chat] agentId={} status={}: {}", agentId, e.getStatusCode(), e.getResponseBodyAsString());
            return "{\"error\":\"" + e.getStatusCode() + " — " + escapeJson(e.getMessage()) + "\"}";
        } catch (Exception e) {
            log.error("[CLIENT:chat] agentId={}: {}", agentId, e.getMessage(), e);
            return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String post(String path, String jwt, Object body) {
        try {
            return agentTeamWebClient.post()
                .uri(path)
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(String.class)
                .block();
        } catch (WebClientResponseException e) {
            log.error("[CLIENT:post] {} status={}: {}", path, e.getStatusCode(), e.getResponseBodyAsString());
            return "{\"error\":\"" + e.getStatusCode() + "\",\"message\":\"" + escapeJson(e.getResponseBodyAsString()) + "\"}";
        } catch (Exception e) {
            log.error("[CLIENT:post] {}: {}", path, e.getMessage(), e);
            return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
        }
    }

    private String get(String path, String jwt) {
        return executeGet(
            agentTeamWebClient.get()
                .uri(path)
                .header("Authorization", "Bearer " + jwt)
        );
    }

    private String executeGet(WebClient.RequestHeadersSpec<?> req) {
        try {
            return req.retrieve().bodyToMono(String.class).block();
        } catch (WebClientResponseException e) {
            log.error("[CLIENT:get] status={}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return "{\"error\":\"" + e.getStatusCode() + "\",\"message\":\"" + escapeJson(e.getResponseBodyAsString()) + "\"}";
        } catch (Exception e) {
            log.error("[CLIENT:get] {}", e.getMessage(), e);
            return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
        }
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
    }
}
