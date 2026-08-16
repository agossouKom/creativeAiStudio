package com.creativeai.telegram.bot;

import java.time.Instant;

/**
 * Etat d'une session Telegram : chatId → compte plateforme.
 *
 * @param userId      identifiant plateforme (UUID)
 * @param jwtToken    JWT généré pour cet userId (valide 7 jours)
 * @param sessionId   ID de session conversationnelle Spring AI (réutilisé entre messages)
 * @param linkedAt    date de liaison initiale
 */
public record UserSession(
    String  userId,
    String  jwtToken,
    String  sessionId,
    Instant linkedAt
) {
    public UserSession withSession(String newSessionId) {
        return new UserSession(userId, jwtToken, newSessionId, linkedAt);
    }
}
