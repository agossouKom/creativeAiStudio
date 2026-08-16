package com.creativeai.telegram.tools;

/**
 * Transporte le contexte utilisateur (userId + JWT) sur le thread courant
 * pendant l'exécution d'un appel LLM et de ses tool calls.
 *
 * Pattern ThreadLocal justifié ici : chaque message Telegram est traité sur
 * son propre virtual thread (voir TelegramPollingService), donc pas de risque
 * de pollution entre sessions concurrentes.
 */
public final class UserContextHolder {

    private static final ThreadLocal<String> USER_ID   = new ThreadLocal<>();
    private static final ThreadLocal<String> JWT_TOKEN = new ThreadLocal<>();

    private UserContextHolder() {}

    public static void set(String userId, String jwtToken) {
        USER_ID.set(userId);
        JWT_TOKEN.set(jwtToken);
    }

    public static String getUserId() {
        String id = USER_ID.get();
        if (id == null) throw new IllegalStateException("No user context on current thread");
        return id;
    }

    public static String getJwtToken() {
        String token = JWT_TOKEN.get();
        if (token == null) throw new IllegalStateException("No JWT token on current thread");
        return token;
    }

    public static void clear() {
        USER_ID.remove();
        JWT_TOKEN.remove();
    }
}
