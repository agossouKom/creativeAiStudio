package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.UserSubscription;
import com.creativeai.agentteam.model.enums.SubscriptionPlan;
import com.creativeai.agentteam.service.QuotaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Gestion de l'abonnement et des quotas de l'utilisateur connecté.
 */
@Tag(
    name = "Subscription",
    description = """
        Consultation et gestion de l'abonnement.

        - `GET /api/subscription` — plan actuel + limites + usage du mois
        - `GET /api/subscription/usage` — compteur de tâches du mois courant
        - `POST /api/subscription/upgrade` — passer à un plan supérieur (admin/internal)

        Authentification requise : `Authorization: Bearer <JWT>`
        """
)
@RestController
@RequestMapping("/api/subscription")
@RequiredArgsConstructor
public class SubscriptionController {

    private final QuotaService quotaService;

    @Operation(summary = "Plan et limites de l'abonnement courant")
    @GetMapping
    public ResponseEntity<UserSubscription> getSubscription(
        @AuthenticationPrincipal String userId
    ) {
        return ResponseEntity.ok(quotaService.getSubscription(userId));
    }

    @Operation(summary = "Usage du mois courant (nombre de tâches créées)")
    @GetMapping("/usage")
    public ResponseEntity<Map<String, Object>> getUsage(
        @AuthenticationPrincipal String userId
    ) {
        UserSubscription sub = quotaService.getSubscription(userId);
        int used = quotaService.getCurrentMonthUsage(userId);
        return ResponseEntity.ok(Map.of(
            "tasksUsed",      used,
            "tasksPerMonth",  sub.getTasksPerMonth(),
            "remaining",      Math.max(0, sub.getTasksPerMonth() - used),
            "plan",           sub.getPlan().name()
        ));
    }

    @Operation(
        summary = "Changer de plan (admin uniquement en production)",
        description = "Endpoint interne — à sécuriser avec un rôle ADMIN en production."
    )
    @PostMapping("/upgrade")
    public ResponseEntity<UserSubscription> upgrade(
        @AuthenticationPrincipal String userId,
        @RequestParam SubscriptionPlan plan
    ) {
        return ResponseEntity.ok(quotaService.upgrade(userId, plan));
    }
}
