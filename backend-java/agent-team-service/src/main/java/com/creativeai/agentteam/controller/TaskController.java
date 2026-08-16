package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.CreateTaskRequest;
import com.creativeai.agentteam.dto.request.UpdateTaskRequest;
import com.creativeai.agentteam.dto.response.PageResponse;
import com.creativeai.agentteam.dto.response.TaskResponse;
import com.creativeai.agentteam.model.enums.TaskStatus;
import com.creativeai.agentteam.service.TaskService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import jakarta.servlet.http.HttpServletRequest;

/**
 * Gestion des tâches agents — créées manuellement ou générées par inter-agent.
 */
@Tag(
    name = "Tasks",
    description = """
        Gestion des tâches assignées aux agents IA.

        Une **tâche** représente une unité de travail confiée à un agent.
        Elle peut être :
        - créée **manuellement** par l'utilisateur (`source: USER`)
        - créée **par un agent** lors de la coordination (`source: INTER_AGENT`)
        - déclenchée par un **workflow** (`source: WORKFLOW`)

        **Cycle de vie :** `PENDING` → `IN_PROGRESS` → `COMPLETED` | `FAILED` | `CANCELLED`

        Authentification requise : `Authorization: Bearer <JWT>`
        """
)
@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @Operation(
        summary = "Créer une tâche",
        description = """
            Crée une tâche et l'assigne optionnellement à un agent.

            **Types de tâches (`type`) :**
            `EMAIL_RESPONSE`, `EMAIL_CLASSIFICATION`, `SOCIAL_POST`, `PROSPECT_SEARCH`,
            `CAMPAIGN_CREATE`, `CV_CREATE`, `IMAGE_GENERATE`, `SECURITY_SCAN`, `GENERAL`…

            **Priorités (`priority`) :** `LOW`, `MEDIUM`, `HIGH`, `URGENT`, `CRITICAL`

            **Sources (`source`) :** `USER` (manuelle), `WORKFLOW`, `INTER_AGENT`, `API`, `SCHEDULED`
            """,
        requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
            content = @Content(
                mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = {
                    @ExampleObject(
                        name = "Tâche email simple",
                        summary = "Rédaction d'un email de relance",
                        value = """
                            {
                              "title": "Rédiger email de relance client Dupont",
                              "description": "Le client n'a pas payé sa facture du 01/05. Rédiger un email poli mais ferme.",
                              "type": "EMAIL_RESPONSE",
                              "priority": "HIGH",
                              "source": "USER",
                              "assignedAgentId": "d82a47a7-938d-4ff3-a8be-46da5579357c",
                              "dueDate": "2026-06-10T12:00:00"
                            }
                            """
                    ),
                    @ExampleObject(
                        name = "Tâche de génération d'image",
                        summary = "Tâche pour l'agent IMAGE_CREATOR",
                        value = """
                            {
                              "title": "Créer visuels campagne été",
                              "description": "3 visuels 1080x1080 pour Instagram, thème plage et soleil",
                              "type": "IMAGE_GENERATE",
                              "priority": "MEDIUM",
                              "source": "USER",
                              "payload": "{\\"format\\":\\"1080x1080\\",\\"count\\":3,\\"theme\\":\\"summer beach\\"}"
                            }
                            """
                    )
                }
            )
        )
    )
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Tâche créée"),
        @ApiResponse(responseCode = "400", description = "Champs invalides (title manquant)")
    })
    @PostMapping
    public ResponseEntity<TaskResponse> create(@AuthenticationPrincipal String userId,
            @Valid @RequestBody CreateTaskRequest req,
            HttpServletRequest httpRequest) {
        String jwt = httpRequest.getHeader("Authorization");
        return ResponseEntity.status(HttpStatus.CREATED).body(taskService.createTask(userId, req, jwt));
    }

    @Operation(
        summary = "Lister les tâches",
        description = "Retourne toutes les tâches de l'utilisateur. Filtrable par statut via le paramètre `status`."
    )
    @ApiResponse(responseCode = "200", description = "Liste des tâches")
    @GetMapping
    public ResponseEntity<List<TaskResponse>> list(@AuthenticationPrincipal String userId,
            @Parameter(
                description = "Filtrer par statut",
                example = "IN_PROGRESS"
            ) @RequestParam(required = false) TaskStatus status) {
        return ResponseEntity.ok(status != null
            ? taskService.listTasksByStatus(userId, status)
            : taskService.listTasks(userId));
    }

    @Operation(
        summary = "Tâches paginées",
        description = "Version paginée de la liste des tâches. Utile pour les grandes listes."
    )
    @ApiResponse(responseCode = "200", description = "Page de tâches avec métadonnées de pagination")
    @GetMapping("/paged")
    public ResponseEntity<PageResponse<TaskResponse>> listPaged(@AuthenticationPrincipal String userId,
            @Parameter(description = "Page (0-based)", example = "0")  @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Taille de page", example = "20") @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(taskService.listTasksPaged(userId,
            PageRequest.of(page, size, Sort.by("createdAt").descending())));
    }

    @Operation(
        summary = "Tâches en retard",
        description = "Retourne les tâches dont la `dueDate` est dépassée et dont le statut n'est pas `COMPLETED` ou `CANCELLED`."
    )
    @ApiResponse(responseCode = "200", description = "Liste des tâches en retard")
    @GetMapping("/overdue")
    public ResponseEntity<List<TaskResponse>> overdue(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(taskService.listOverdueTasks(userId));
    }

    @Operation(
        summary = "Obtenir une tâche",
        description = "Retourne le détail complet d'une tâche, incluant le résultat si elle est terminée."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Détail de la tâche"),
        @ApiResponse(responseCode = "404", description = "Tâche introuvable")
    })
    @GetMapping("/{taskId}")
    public ResponseEntity<TaskResponse> get(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de la tâche") @PathVariable String taskId) {
        return ResponseEntity.ok(taskService.getTask(userId, taskId));
    }

    @GetMapping("/by-code/{code}")
    public ResponseEntity<TaskResponse> getByCode(@AuthenticationPrincipal String userId,
            @Parameter(description = "Code court 6 chiffres de la tâche", example = "123456")
            @PathVariable String code) {
        return ResponseEntity.ok(taskService.getTaskByCode(userId, code));
    }

    @Operation(
        summary = "Modifier une tâche",
        description = "Met à jour le titre, la description, la priorité ou l'agent assigné."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Tâche mise à jour"),
        @ApiResponse(responseCode = "404", description = "Tâche introuvable")
    })
    @PutMapping("/{taskId}")
    public ResponseEntity<TaskResponse> update(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de la tâche") @PathVariable String taskId,
            @Valid @RequestBody UpdateTaskRequest req) {
        return ResponseEntity.ok(taskService.updateTask(userId, taskId, req));
    }

    @Operation(
        summary = "Changer le statut d'une tâche",
        description = """
            Transitions de statut autorisées :

            | Depuis | Vers |
            |--------|------|
            | `PENDING` | `IN_PROGRESS`, `CANCELLED` |
            | `IN_PROGRESS` | `COMPLETED`, `FAILED`, `CANCELLED` |
            | `FAILED` | `PENDING` (retry) |
            """
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Statut mis à jour"),
        @ApiResponse(responseCode = "404", description = "Tâche introuvable")
    })
    @PatchMapping("/{taskId}/status")
    public ResponseEntity<TaskResponse> updateStatus(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de la tâche") @PathVariable String taskId,
            @Parameter(description = "Nouveau statut", example = "COMPLETED") @RequestParam TaskStatus status) {
        return ResponseEntity.ok(taskService.updateStatus(userId, taskId, status));
    }

    @Operation(
        summary = "Supprimer une tâche (soft delete)",
        description = "Marque la tâche comme supprimée. Récupérable via `POST /{taskId}/restore`."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Tâche supprimée"),
        @ApiResponse(responseCode = "404", description = "Tâche introuvable")
    })
    @DeleteMapping("/{taskId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de la tâche") @PathVariable String taskId) {
        taskService.deleteTask(userId, taskId);
        return ResponseEntity.noContent().build();
    }

    // ── Soft-delete / Restore ─────────────────────────────────────────────

    @Operation(summary = "Lister les tâches supprimées",
               description = "Retourne les tâches dont `deleted=true`.")
    @ApiResponse(responseCode = "200", description = "Liste des tâches supprimées")
    @GetMapping("/deleted")
    public ResponseEntity<List<TaskResponse>> listDeleted(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(taskService.listDeletedTasks(userId));
    }

    @Operation(summary = "Restaurer une tâche supprimée",
               description = "Remet `deleted=false`. La tâche réapparaît dans `GET /api/tasks`.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Tâche restaurée"),
        @ApiResponse(responseCode = "404", description = "Tâche supprimée introuvable")
    })
    @PostMapping("/{taskId}/restore")
    public ResponseEntity<TaskResponse> restore(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de la tâche supprimée") @PathVariable String taskId) {
        return ResponseEntity.ok(taskService.restoreTask(userId, taskId));
    }
}
