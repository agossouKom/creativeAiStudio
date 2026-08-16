package com.creativeai.agentteam.model.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Plans d'abonnement.
 *
 * Les limites ici sont les valeurs par défaut provisionnées à la création de
 * l'abonnement. Elles peuvent être surchargées dans {@code user_subscriptions}
 * pour les contrats enterprise sur-mesure.
 */
@Getter
@RequiredArgsConstructor
public enum SubscriptionPlan {

    FREE(50, 3, 1, false),
    PRO(500, 20, 5, true),
    ENTERPRISE(10_000, 100, 20, true);

    private final int     defaultTasksPerMonth;
    private final int     defaultMaxAgents;
    private final int     defaultMaxTeams;
    private final boolean premiumLlmEnabled;
}
