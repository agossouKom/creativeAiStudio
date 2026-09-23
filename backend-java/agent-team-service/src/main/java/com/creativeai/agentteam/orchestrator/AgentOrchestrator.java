package com.creativeai.agentteam.orchestrator;

import com.creativeai.agentteam.llm.ChatModelFactory;
import com.creativeai.agentteam.llm.LlmGateway;
import com.creativeai.agentteam.model.AgentMemory;
import com.creativeai.agentteam.model.LlmProvider;
import com.creativeai.agentteam.model.enums.PromptType;
import com.creativeai.agentteam.model.enums.TaskStatus;
import com.creativeai.agentteam.repository.AgentConfigRepository;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.AgentTaskRepository;
import com.creativeai.agentteam.service.AuditService;
import com.creativeai.agentteam.service.EncryptionService;
import com.creativeai.agentteam.service.ExecutionHistoryService;
import com.creativeai.agentteam.service.MemoryService;
import com.creativeai.agentteam.service.PromptService;
import com.creativeai.agentteam.service.ResourceNotFoundException;
import com.creativeai.agentteam.tool.AgentContext;
import com.creativeai.agentteam.tool.AgentSpringTools;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.support.ToolCallbacks;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Orchestre le loop agentique via Spring AI function calling natif.
 *
 * Avant : parsing regex TOOL_CALL:<nom>:<json> — fragile, coûteux en tokens,
 *         boucle manuelle, pas de gestion d'état.
 *
 * Maintenant : ChatClient.tools(AgentSpringTools) → le provider (Groq, Anthropic…)
 *              gère nativement les tool calls JSON. Spring AI dispatche les appels
 *              aux méthodes @Tool et renvoie le résultat au LLM jusqu'à la réponse finale.
 *
 * API publique inchangée : chat() et chatAsSubAgent() restent identiques pour les
 * controllers et services existants.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentOrchestrator {

    private final LlmGateway              llmGateway;
    private final ChatModelFactory        chatModelFactory;
    private final EncryptionService       encryptionService;
    private final AgentSpringTools        agentSpringTools;
    private final MemoryService           memoryService;
    private final PromptService           promptService;
    private final AgentRepository         agentRepo;
    private final AgentConfigRepository   configRepo;
    private final AgentTaskRepository     taskRepo;
    private final AuditService            auditService;
    private final ExecutionHistoryService historyService;
    private final ObjectMapper            objectMapper;

    // Outils interdits aux sous-agents pour prévenir les boucles de délégation infinie
    private static final Set<String> ORCHESTRATION_ONLY_TOOLS =
        Set.of("select_agent", "delegate_to_agent", "create_agent", "create_team");

    /**
     * Convertit un nom d'outil Spring AI (camelCase, nom de méthode @Tool)
     * en alias snake_case utilisé dans les configs (ex : delegateToAgent → delegate_to_agent).
     */
    private static String toSnakeCase(String camelCase) {
        if (camelCase == null || camelCase.isBlank()) return "";
        return camelCase.replaceAll("([a-z0-9])([A-Z])", "$1_$2").toLowerCase(Locale.ROOT);
    }

    /**
     * Accepte un outil Spring AI s'il figure dans la liste autorisée, sous son nom
     * natif (camelCase) ou son alias snake_case (configs existantes).
     */
    private static boolean matchesEnabled(String toolName, Set<String> allowed) {
        return allowed.contains(toolName) || allowed.contains(toSnakeCase(toolName));
    }

    @Value("${minio.public-url:http://localhost:9400}")
    private String minioPublicUrl;

    private static final Pattern PATRON_TASK_ID_PATTERN =
        Pattern.compile("TaskId\\s*:\\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
            Pattern.CASE_INSENSITIVE);

    // ── API publique ──────────────────────────────────────────────────────────

    public Flux<String> chat(String agentId, String userId, String userMessage,
                             String sessionId, String context) {
        return chatInternal(agentId, userId, userMessage, sessionId, context, List.of(), false);
    }

    public Flux<String> chatAsSubAgent(String agentId, String userId,
                                       String userMessage, String sessionId) {
        List<String> enabledTools = getEnabledTools(agentId).stream()
            .filter(t -> !ORCHESTRATION_ONLY_TOOLS.contains(t))
            .toList();
        return chatInternal(agentId, userId, userMessage, sessionId, null, enabledTools, true);
    }

    // ── Implémentation interne ────────────────────────────────────────────────

    private Flux<String> chatInternal(String agentId, String userId, String userMessage,
                                      String sessionId, String context, List<String> forcedEnabledTools,
                                      boolean subAgent) {
        log.info("[ORCHESTRATOR] chatInternal called agentId={} userId={} sid={}", agentId, userId, sessionId);
        String sid = sessionId != null ? sessionId : UUID.randomUUID().toString();
        String rawMessage = (context != null && !context.isBlank())
            ? userMessage + "\n\n---\nContexte :\n" + context
            : userMessage;
        String patronTaskId = extractPatronTaskId(rawMessage);
        // Si la tâche patron a un product_snapshot, l'injecter dans le message
        final String fullMessage = injectProductSnapshotFromTask(rawMessage, patronTaskId, sessionId);

        // Résolution des tools activés pour cet agent
        List<String> enabledTools = forcedEnabledTools.isEmpty()
            ? getEnabledTools(agentId)
            : forcedEnabledTools;

        return Flux.create(sink -> {
            // Pré-exécution : vérifications + sauvegarde mémoire + ACK session
            try {
                agentRepo.findByIdAndDeletedFalse(agentId)
                    .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));
                memoryService.saveUserMessage(userId, agentId, sid, fullMessage);
                sink.next("[SESSION:" + sid + "]");
            } catch (Exception e) {
                log.error("[ORCHESTRATOR] Pre-flight error agentId={}: {}", agentId, e.getMessage(), e);
                sink.next("⚠️ Erreur : " + e.getMessage());
                sink.next("[DONE]");
                sink.complete();
                return;
            }

            // Keepalive toutes les 15s pour éviter le timeout SSE gateway (600s)
            AtomicBoolean llmDone = new AtomicBoolean(false);
            Schedulers.boundedElastic().schedule(() -> {
                while (!llmDone.get()) {
                    try { Thread.sleep(15_000); } catch (InterruptedException ex) { break; }
                    if (!llmDone.get() && !sink.isCancelled()) sink.next("[PING]");
                }
            });

            // Exécution sur bounded elastic — libère le thread de souscription
            Schedulers.boundedElastic().schedule(() -> {
                try {
                    AgentContext.set(agentId, userId, sid, patronTaskId, subAgent);
                    if (patronTaskId != null) historyService.logTaskStarted(patronTaskId, agentId, userId);

                    // Candidates ordonnés pour le failover : primary puis backups
                    // (ex : DeepSeek primary → Groq backup). Si le provider appelé échoue
                    // (clé invalide, quota, réseau…), on rejoue le loop avec le suivant.
                    List<LlmProvider> providers = llmGateway.resolveProviderCandidates(agentId, userId);

                    // Spring AI ChatClient avec function calling natif
                    // Le LLM appelle les @Tool via JSON structuré — plus de parsing regex
                    String systemPrompt = buildSystemPrompt(agentId, enabledTools);
                    List<Message> messages = buildSpringAiMessages(agentId, userId, sid, systemPrompt);

                    // Filtrage réel des outils : si enabledTools configuré, on ne passe
                    // que les outils autorisés au LLM (pas juste un hint dans le prompt)
                    ToolCallback[] allCallbacks = ToolCallbacks.from(agentSpringTools);
                    // Log des noms réels (une seule fois au démarrage suffirait, mais utile ici)
                    if (log.isDebugEnabled()) {
                        java.util.Arrays.stream(allCallbacks).forEach(cb ->
                            log.debug("[ORCHESTRATOR] tool-name={}", cb.getToolDefinition().name()));
                    }
                    ToolCallback[] toolCallbacks;
                    if (!enabledTools.isEmpty()) {
                        Set<String> allowed = new java.util.HashSet<>(enabledTools);
                        toolCallbacks = java.util.Arrays.stream(allCallbacks)
                            .filter(cb -> matchesEnabled(cb.getToolDefinition().name(), allowed))
                            .toArray(ToolCallback[]::new);
                        log.info("[ORCHESTRATOR] agent={} tools filtrés={}/{} allowed={}", agentId,
                            toolCallbacks.length, allCallbacks.length, allowed);
                    } else {
                        toolCallbacks = allCallbacks;
                    }

                    String response = null;
                    for (int pi = 0; pi < providers.size(); pi++) {
                        LlmProvider provider = providers.get(pi);
                        try {
                            String apiKey = encryptionService.decrypt(provider.getEncryptedApiKey());
                            ChatModel chatModel = chatModelFactory.buildFor(provider, apiKey);
                            log.info("[ORCHESTRATOR] agent={} → LLM {} {} ({})",
                                agentId, provider.getType(), provider.getModelId(),
                                pi == 0 ? "primary" : "failover");
                            response = ChatClient.create(chatModel)
                                .prompt()
                                .messages(messages)
                                .toolCallbacks(toolCallbacks)
                                .call()
                                .content();
                            break;
                        } catch (Exception e) {
                            if (pi < providers.size() - 1) {
                                log.warn("[ORCHESTRATOR] Échec provider {} {} ({}) — bascule automatique vers {}",
                                    provider.getType(), provider.getModelId(), e.getMessage(),
                                    providerLabel(providers.get(pi + 1)));
                            } else {
                                throw e;
                            }
                        }
                    }

                    if (response == null || response.isBlank()) {
                        response = "J'ai terminé l'exécution.";
                    }

                    memoryService.saveAssistantMessage(userId, agentId, sid, response);
                    auditService.log(userId, agentId, null, "AGENT_CHAT", "agent", agentId, true);
                    if (patronTaskId != null) historyService.logTaskCompleted(patronTaskId, agentId, userId, response);
                    autoUpdatePatronTask(patronTaskId, TaskStatus.DONE);
                    emitPseudoStream(response, sink);

                } catch (IllegalStateException e) {
                    log.warn("[ORCHESTRATOR] No LLM for agentId={}: {}", agentId, e.getMessage());
                    if (patronTaskId != null) historyService.logTaskFailed(patronTaskId, agentId, userId, e.getMessage());
                    autoUpdatePatronTask(patronTaskId, TaskStatus.FAILED);
                    sink.next("⚠️ " + e.getMessage()
                        + "\n\nRendez-vous dans **Paramètres > Clés API** pour configurer un provider LLM.");
                    sink.next("[DONE]");
                    sink.complete();
                } catch (Exception e) {
                    log.error("[ORCHESTRATOR] Error agentId={}: {}", agentId, e.getMessage(), e);
                    auditService.log(userId, agentId, null, "AGENT_CHAT_ERROR", "agent", agentId, false,
                        e.getMessage(), null);
                    if (patronTaskId != null) historyService.logTaskFailed(patronTaskId, agentId, userId, e.getMessage());
                    autoUpdatePatronTask(patronTaskId, TaskStatus.FAILED);
                    sink.next("⚠️ Erreur : " + e.getMessage());
                    sink.next("[DONE]");
                    sink.complete();
                } finally {
                    AgentContext.clear();
                    llmDone.set(true);
                }
            });
        });
    }

    // ── Context builders ──────────────────────────────────────────────────────

    /**
     * Convertit l'historique de conversation (AgentMemory) en messages Spring AI.
     * Le system prompt est injecté en premier.
     */
    private List<Message> buildSpringAiMessages(String agentId, String userId,
                                                String sessionId, String systemPrompt) {
        List<Message> msgs = new ArrayList<>();
        msgs.add(new SystemMessage(systemPrompt));

        List<AgentMemory> history = memoryService.buildContextMessages(userId, agentId, sessionId);
        for (AgentMemory m : history) {
            String role = m.getRole().name().toLowerCase().replace("tool_result", "user");
            msgs.add(switch (role) {
                case "assistant" -> new AssistantMessage(nvl(m.getContent()));
                default          -> new UserMessage(nvl(m.getContent()));
            });
        }
        return msgs;
    }

    /**
     * System prompt enrichi avec la liste des outils disponibles.
     * Note : avec le function calling natif, les outils sont aussi dans le schema JSON
     * du provider. Le system prompt sert à guider le comportement général.
     */
    private String buildSystemPrompt(String agentId, List<String> enabledTools) {
        try {
            String custom = promptService.renderPrompt(agentId, PromptType.SYSTEM, Map.of());
            if (custom != null && !custom.isBlank()) return custom;
        } catch (Exception ignored) {}

        String toolsHint = enabledTools.isEmpty()
            ? "Tu disposes d'outils pour t'aider. Utilise-les quand c'est pertinent."
            : "Outils disponibles pour cet agent : " + String.join(", ", enabledTools) + ".";

        return """
            Tu es un agent IA professionnel. Réponds toujours en français sauf instruction contraire.
            Utilise les outils disponibles pour répondre aux demandes de l'utilisateur.
            %s
            Sois précis, concis et professionnel dans tes réponses.
            """.formatted(toolsHint);
    }

    // ── Configuration helpers ─────────────────────────────────────────────────

    // Outils réservés aux Scrum Masters — orchestration uniquement, jamais d'exécution directe
    // Noms en camelCase = noms des méthodes @Tool de AgentSpringTools (convention Spring AI)
    // ET snake_case = alias utilisé dans certaines versions — on inclut les deux pour robustesse
    private static final List<String> SCRUM_MASTER_TOOLS = List.of(
        "selectAgent",      "select_agent",
        "delegateToAgent",  "delegate_to_agent",
        "createTask",       "create_task",
        "updateTaskStatus", "update_task_status",
        "deliverResult",    "deliver_result",
        "getCurrentDate",   "get_current_date"
    );

    // Outils par défaut pour les Community Managers (tous les canaux sociaux)
    private static final List<String> COMMUNITY_MANAGER_TOOLS = List.of(
        "postSocial",             "post_social",
        "listMedia",              "list_media",
        "replyInstagramComment",  "reply_instagram_comment",
        "replyFacebookComment",   "reply_facebook_comment",
        "getFacebookComments",    "get_facebook_comments",
        "createTask",             "create_task",
        "updateTaskStatus",       "update_task_status",
        "deliverResult",          "deliver_result",
        "getCurrentDate",         "get_current_date",
        "searchTasks",            "search_tasks"
    );

    /**
     * Liste des outils autorisés depuis AgentConfig.customParams.
     * Format : {"enabledTools": ["send_email", "create_task", ...]}
     * Liste vide = tous les outils autorisés (sauf SCRUM_MASTER qui a une liste par défaut).
     */
    private List<String> getEnabledTools(String agentId) {
        // Récupérer le type de l'agent pour appliquer les restrictions par défaut
        String agentType = agentRepo.findByIdAndDeletedFalse(agentId)
            .map(a -> a.getType() != null ? a.getType().name() : "")
            .orElse("");

        return configRepo.findByAgentIdAndDeletedFalse(agentId)
            .map(cfg -> {
                try {
                    String params = cfg.getCustomParams();
                    if (params != null && !params.isBlank()) {
                        JsonNode node = objectMapper.readTree(params);
                        JsonNode arr  = node.get("enabledTools");
                        if (arr != null && arr.isArray() && arr.size() > 0) {
                            List<String> tools = new ArrayList<>();
                            arr.forEach(n -> tools.add(n.asText()));
                            return tools;
                        }
                    }
                } catch (Exception e) {
                    log.warn("[ORCHESTRATOR] Impossible de parser enabledTools pour agent {}: {}",
                        agentId, e.getMessage());
                }
                // Pas de config custom → appliquer les restrictions par type
                return defaultToolsForType(agentType);
            })
            .orElseGet(() -> defaultToolsForType(agentType));
    }

    private List<String> defaultToolsForType(String agentType) {
        return switch (agentType) {
            case "SCRUM_MASTER"      -> SCRUM_MASTER_TOOLS;
            case "COMMUNITY_MANAGER" -> COMMUNITY_MANAGER_TOOLS;
            default                  -> List.of(); // tous les outils
        };
    }

    // ── SSE helpers ───────────────────────────────────────────────────────────

    private void emitPseudoStream(String text, reactor.core.publisher.FluxSink<String> sink) {
        try {
            sink.next(objectMapper.writeValueAsString(Map.of("content", text)));
        } catch (Exception e) {
            log.error("[ORCHESTRATOR] emitPseudoStream error: {}", e.getMessage());
            sink.next(text);
        }
        sink.next("[DONE]");
        sink.complete();
    }

    // ── Safety net : mise à jour automatique de la tâche patron ──────────────

    private String injectProductSnapshotFromTask(String message, String patronTaskId, String sessionId) {
        // Cherche le product_snapshot dans la tâche patron, ou via le format "patron-{uuid}" du sessionId
        String resolvedId = patronTaskId;
        if (resolvedId == null && sessionId != null) {
            if (sessionId.startsWith("patron-")) {
                // Format: "patron-{uuid}" — extract uuid directly
                resolvedId = sessionId.substring("patron-".length());
            } else {
                Matcher m = PATRON_TASK_ID_PATTERN.matcher(sessionId);
                if (m.find()) resolvedId = m.group(1);
            }
        }
        if (resolvedId == null) return message;
        final String taskId = resolvedId;

        try {
            return taskRepo.findByIdAndDeletedFalse(taskId).map(task -> {
                String snap = task.getProductSnapshot();
                if (snap == null || snap.isBlank()) return message;
                try {
                    List<Map<String, Object>> products = objectMapper.readValue(snap, new TypeReference<>() {});
                    if (products.isEmpty()) return message;
                    StringBuilder sb = new StringBuilder(message);
                    sb.append("\n\n=== PRODUITS À PROMOUVOIR ===\n");
                    for (Map<String, Object> p : products) {
                        sb.append("- Nom : ").append(p.getOrDefault("nom", "")).append("\n");
                        sb.append("  Description : ").append(p.getOrDefault("description", "")).append("\n");
                        Object prix = p.get("prix");
                        if (prix != null) sb.append("  Prix : ").append(prix).append("\n");
                        Object photos = p.get("photos");
                        if (photos instanceof List<?> photoList && !photoList.isEmpty()) {
                            sb.append("  Images disponibles (URLs publiques à utiliser dans post_social → mediaUrls) :\n");
                            for (Object url : photoList) {
                                String imageUrl = String.valueOf(url)
                                    .replace("http://localhost:9400", minioPublicUrl.replaceAll("/$", ""))
                                    .replace("http://localhost:9000", minioPublicUrl.replaceAll("/$", ""));
                                sb.append("    • ").append(imageUrl).append("\n");
                            }
                        }
                    }
                    sb.append("==============================\n");
                    log.info("[ORCHESTRATOR] product_snapshot injecté dans message taskId={}", taskId);
                    return sb.toString();
                } catch (Exception e) {
                    log.warn("[ORCHESTRATOR] Impossible de parser product_snapshot taskId={}: {}", taskId, e.getMessage());
                    return message;
                }
            }).orElse(message);
        } catch (Exception e) {
            return message;
        }
    }

    private String extractPatronTaskId(String message) {
        if (message == null) return null;
        Matcher m = PATRON_TASK_ID_PATTERN.matcher(message);
        return m.find() ? m.group(1) : null;
    }

    private void autoUpdatePatronTask(String patronTaskId, TaskStatus status) {
        if (patronTaskId == null) return;
        try {
            taskRepo.findByIdAndDeletedFalse(patronTaskId).ifPresent(task -> {
                if (task.getStatus() == TaskStatus.IN_PROGRESS || task.getStatus() == TaskStatus.PENDING) {
                    task.setStatus(status);
                    if (status == TaskStatus.DONE) task.setCompletedAt(LocalDateTime.now());
                    taskRepo.save(task);
                    log.info("[ORCHESTRATOR] Auto-update tâche patron {} → {}", patronTaskId, status);
                }
            });
        } catch (Exception e) {
            log.warn("[ORCHESTRATOR] Impossible de mettre à jour la tâche patron {}: {}", patronTaskId, e.getMessage());
        }
    }

    private static String nvl(String v) { return v != null ? v : ""; }

    private static String providerLabel(LlmProvider p) {
        return p.getType().name() + " " + (p.getModelId() != null ? p.getModelId() : "");
    }
}
