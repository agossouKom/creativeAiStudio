package com.creativeai.agentteam.tool;

/**
 * Stocke le contexte d'exécution de l'agent dans un ThreadLocal.
 *
 * Spring AI exécute les @Tool callbacks sur le thread courant — ce holder permet
 * à chaque outil d'accéder à l'agentId et userId sans les passer en paramètre,
 * ce qui est incompatible avec la signature @Tool (paramètres ↔ JSON schema LLM).
 *
 * Usage :
 *   AgentContext.set(agentId, userId, sessionId);
 *   try { chatClient.call(); }
 *   finally { AgentContext.clear(); }
 */
public final class AgentContext {

    private AgentContext() {}

    private static final ThreadLocal<ExecutionContext> HOLDER = new ThreadLocal<>();

    /** taskId peut être null pour les sessions de chat libre. subAgent=true bloque les outils d'orchestration. */
    public record ExecutionContext(String agentId, String userId, String sessionId, String taskId, boolean subAgent) {}

    public static void set(String agentId, String userId, String sessionId) {
        HOLDER.set(new ExecutionContext(agentId, userId, sessionId, null, false));
    }

    public static void set(String agentId, String userId, String sessionId, String taskId) {
        HOLDER.set(new ExecutionContext(agentId, userId, sessionId, taskId, false));
    }

    public static void set(String agentId, String userId, String sessionId, String taskId, boolean subAgent) {
        HOLDER.set(new ExecutionContext(agentId, userId, sessionId, taskId, subAgent));
    }

    public static boolean isSubAgent() {
        ExecutionContext ctx = HOLDER.get();
        return ctx != null && ctx.subAgent();
    }

    public static ExecutionContext require() {
        ExecutionContext ctx = HOLDER.get();
        if (ctx == null) throw new IllegalStateException(
            "AgentContext non initialisé — appelez AgentContext.set() avant l'exécution des outils.");
        return ctx;
    }

    public static void clear() {
        HOLDER.remove();
    }
}
