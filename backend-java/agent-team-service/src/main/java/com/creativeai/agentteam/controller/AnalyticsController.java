package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.response.AnalyticsDashboardResponse;
import com.creativeai.agentteam.model.TaskExecutionEvent;
import com.creativeai.agentteam.service.AnalyticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Tableau de bord analytics pour le "patron" — synthèse de l'activité des agents.
 *
 * Tous les endpoints sont authentifiés (JWT) ; les données retournées
 * sont scoped à l'utilisateur connecté.
 */
@Tag(
    name = "Analytics",
    description = """
        Tableau de bord d'activité pour les responsables.

        Indicateurs exposés :
        - Nombre de tâches complétées / échouées / en attente
        - Taux de succès global et par agent
        - Durée moyenne de traitement
        - Heures estimées économisées (heuristique : 30 min/tâche)
        - Emails envoyés, posts sociaux publiés, délégations
        - Top 10 des outils les plus utilisés
        - Détail par agent (drill-down)
        - Timeline d'une tâche (audit trail)

        Authentification requise : `Authorization: Bearer <JWT>`
        """
)
@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @Operation(
        summary = "Tableau de bord global",
        description = """
            Retourne les indicateurs agrégés sur les derniers `days` jours (défaut : 30).

            Utile pour la page d'accueil du responsable : KPIs, graphiques,
            performance par agent, outils les plus utilisés.
            """
    )
    @GetMapping("/dashboard")
    public ResponseEntity<AnalyticsDashboardResponse> dashboard(
        @AuthenticationPrincipal String userId,
        @Parameter(description = "Fenêtre temporelle en jours (1-365)", example = "30")
        @RequestParam(defaultValue = "30") int days
    ) {
        int safeDays = Math.min(Math.max(days, 1), 365);
        return ResponseEntity.ok(analyticsService.getDashboard(userId, safeDays));
    }

    @Operation(
        summary = "Timeline d'une tâche",
        description = """
            Retourne l'historique chronologique des événements d'une tâche :
            démarrage, appels d'outils, résultats, délégations, complétion ou échec.

            Permet au responsable de comprendre exactement ce qu'un agent a fait
            pour exécuter une tâche donnée.
            """
    )
    @GetMapping("/tasks/{taskId}/timeline")
    public ResponseEntity<List<TaskExecutionEvent>> taskTimeline(
        @AuthenticationPrincipal String userId,
        @PathVariable String taskId
    ) {
        return ResponseEntity.ok(analyticsService.getTaskTimeline(taskId));
    }
}
