package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.CreateWorkflowRequest;
import com.creativeai.agentteam.dto.response.WorkflowResponse;
import com.creativeai.agentteam.service.WorkflowService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * Gestion des workflows d'automatisation multi-agents.
 */
@Tag(
    name = "Workflows",
    description = """
        Automatisation de chaînes de tâches multi-agents.

        Un **workflow** orchestre une séquence d'étapes exécutées par des agents.
        Il peut être déclenché :
        - **manuellement** (`MANUAL`)
        - **par planification CRON** (`SCHEDULED`)
        - **par webhook** (`WEBHOOK`)
        - **par un événement d'un autre agent** (`INTER_AGENT`)

        Chaque étape du workflow définit l'agent responsable, l'action à effectuer,
        et les conditions de passage à l'étape suivante.

        Authentification requise : `Authorization: Bearer <JWT>`
        """
)
@RestController
@RequestMapping("/api/workflows")
@RequiredArgsConstructor
public class WorkflowController {

    private final WorkflowService workflowService;

    @Operation(
        summary = "Créer un workflow",
        description = """
            Crée un workflow d'automatisation.

            **`triggerType` :**
            - `MANUAL` : déclenché explicitement via `POST /api/workflows/{id}/activate`
            - `SCHEDULED` : déclenché selon `cronExpression` (format cron standard, ex. `0 9 * * 1-5`)
            - `WEBHOOK` : déclenché par un appel HTTP externe
            - `EMAIL` : déclenché à la réception d'un email
            - `INTER_AGENT` : déclenché par un autre agent via l'outil `create_task`

            **Étapes (`steps`) :**
            Tableau ordonné d'étapes. Chaque étape définit `agentId`, `taskType`, et des `conditions`
            optionnelles pour passer à l'étape suivante.
            """,
        requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
            content = @Content(
                mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = {
                    @ExampleObject(
                        name = "Workflow email quotidien",
                        summary = "Traitement automatique des emails chaque matin",
                        value = """
                            {
                              "name": "Traitement emails matinal",
                              "description": "Classe et répond aux emails prioritaires chaque matin à 9h",
                              "triggerType": "SCHEDULED",
                              "cronExpression": "0 9 * * 1-5",
                              "steps": [
                                {
                                  "name": "Classification",
                                  "agentId": "d82a47a7-938d-4ff3-a8be-46da5579357c",
                                  "taskType": "EMAIL_CLASSIFICATION",
                                  "order": 1
                                },
                                {
                                  "name": "Réponse automatique",
                                  "agentId": "d82a47a7-938d-4ff3-a8be-46da5579357c",
                                  "taskType": "EMAIL_RESPONSE",
                                  "order": 2
                                }
                              ]
                            }
                            """
                    ),
                    @ExampleObject(
                        name = "Workflow manuel",
                        summary = "Workflow déclenché à la demande",
                        value = """
                            {
                              "name": "Rapport hebdomadaire",
                              "triggerType": "MANUAL",
                              "steps": [
                                {
                                  "name": "Collecte données",
                                  "agentId": "55865815-187e-4ef1-b2d4-a4814bd05cac",
                                  "taskType": "REPORT_GENERATE",
                                  "order": 1
                                }
                              ]
                            }
                            """
                    )
                }
            )
        )
    )
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Workflow créé"),
        @ApiResponse(responseCode = "400", description = "Champs invalides (name manquant)")
    })
    @PostMapping
    public ResponseEntity<WorkflowResponse> create(@AuthenticationPrincipal String userId,
            @Valid @RequestBody CreateWorkflowRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(workflowService.createWorkflow(userId, req));
    }

    @Operation(
        summary = "Lister les workflows",
        description = "Retourne tous les workflows de l'utilisateur, triés par date de création."
    )
    @ApiResponse(responseCode = "200", description = "Liste des workflows")
    @GetMapping
    public ResponseEntity<List<WorkflowResponse>> list(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(workflowService.listWorkflows(userId));
    }

    @Operation(
        summary = "Obtenir un workflow",
        description = "Retourne le détail complet d'un workflow : étapes, statut et historique d'exécution."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Détail du workflow"),
        @ApiResponse(responseCode = "404", description = "Workflow introuvable")
    })
    @GetMapping("/{workflowId}")
    public ResponseEntity<WorkflowResponse> get(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID du workflow") @PathVariable String workflowId) {
        return ResponseEntity.ok(workflowService.getWorkflow(userId, workflowId));
    }

    @Operation(
        summary = "Activer un workflow",
        description = """
            Active le workflow — il peut désormais être déclenché selon son `triggerType`.
            Pour les workflows `SCHEDULED`, la planification cron démarre immédiatement.
            Pour les workflows `MANUAL`, use `activate` puis déclenchez-le manuellement.
            """
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Workflow activé"),
        @ApiResponse(responseCode = "404", description = "Workflow introuvable")
    })
    @PostMapping("/{workflowId}/activate")
    public ResponseEntity<WorkflowResponse> activate(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID du workflow") @PathVariable String workflowId) {
        return ResponseEntity.ok(workflowService.activateWorkflow(userId, workflowId));
    }

    @Operation(
        summary = "Mettre un workflow en pause",
        description = "Suspend l'exécution du workflow. Les tâches en cours se terminent normalement."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Workflow en pause"),
        @ApiResponse(responseCode = "404", description = "Workflow introuvable")
    })
    @PostMapping("/{workflowId}/pause")
    public ResponseEntity<WorkflowResponse> pause(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID du workflow") @PathVariable String workflowId) {
        return ResponseEntity.ok(workflowService.pauseWorkflow(userId, workflowId));
    }

    @Operation(
        summary = "Supprimer un workflow (soft delete)",
        description = "Marque le workflow comme supprimé. Les tâches créées par ce workflow ne sont pas affectées. Récupérable via `POST /{workflowId}/restore`."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Workflow supprimé"),
        @ApiResponse(responseCode = "404", description = "Workflow introuvable")
    })
    @DeleteMapping("/{workflowId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID du workflow") @PathVariable String workflowId) {
        workflowService.deleteWorkflow(userId, workflowId);
        return ResponseEntity.noContent().build();
    }

    // ── Soft-delete / Restore ─────────────────────────────────────────────

    @Operation(summary = "Lister les workflows supprimés",
               description = "Retourne les workflows dont `deleted=true`.")
    @ApiResponse(responseCode = "200", description = "Liste des workflows supprimés")
    @GetMapping("/deleted")
    public ResponseEntity<List<WorkflowResponse>> listDeleted(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(workflowService.listDeletedWorkflows(userId));
    }

    @Operation(summary = "Restaurer un workflow supprimé",
               description = "Remet `deleted=false`. Le workflow réapparaît dans `GET /api/workflows`.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Workflow restauré"),
        @ApiResponse(responseCode = "404", description = "Workflow supprimé introuvable")
    })
    @PostMapping("/{workflowId}/restore")
    public ResponseEntity<WorkflowResponse> restore(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID du workflow supprimé") @PathVariable String workflowId) {
        return ResponseEntity.ok(workflowService.restoreWorkflow(userId, workflowId));
    }
}
