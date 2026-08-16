package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.response.AuditLogResponse;
import com.creativeai.agentteam.dto.response.PageResponse;
import com.creativeai.agentteam.service.AuditService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

/**
 * Journal d'audit de la plateforme.
 * Chaque opération (création, modification, suppression, restauration, chat…)
 * est tracée avec l'utilisateur, la ressource impactée et les détails.
 */
@Tag(
    name = "Audit",
    description = """
        Journal d'audit de toutes les opérations effectuées sur la plateforme.

        Chaque entrée contient :
        - `userId` — qui a effectué l'action
        - `action` — quelle action (ex: `CREATE_AGENT`, `DELETE_TEAM`, `RESTORE_TASK`)
        - `resource` / `resourceId` — sur quelle entité
        - `details` — contexte JSON (nom, type, ancien/nouveau statut…)
        - `success` — si l'opération a réussi
        - `timestamp` — quand

        **Actions possibles :**
        `CREATE_AGENT`, `UPDATE_AGENT`, `DELETE_AGENT`, `RESTORE_AGENT`,
        `CREATE_TEAM`, `UPDATE_TEAM`, `DELETE_TEAM`, `RESTORE_TEAM`,
        `ADD_MEMBER`, `REMOVE_MEMBER`,
        `CREATE_TASK`, `UPDATE_TASK`, `DELETE_TASK`, `RESTORE_TASK`, `UPDATE_TASK_STATUS`,
        `CREATE_WORKFLOW`, `DELETE_WORKFLOW`, `RESTORE_WORKFLOW`, `ACTIVATE_WORKFLOW`, `PAUSE_WORKFLOW`,
        `CREATE_PROMPT`, `DELETE_PROMPT`, `RESTORE_PROMPT`,
        `ADD_LLM_PROVIDER`, `REMOVE_LLM_PROVIDER`,
        `AGENT_CHAT`, `AGENT_CHAT_ERROR`,
        `UPDATE_AGENT_STATUS`, `UPDATE_AGENT_CONFIG`, `UPDATE_AGENT_PROFILE`

        Authentification requise : `Authorization: Bearer <JWT>`
        """
)
@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService auditService;

    @Operation(
        summary = "Journal de l'utilisateur connecté",
        description = """
            Retourne toutes les entrées d'audit de l'utilisateur connecté, triées par date décroissante.

            **Filtres optionnels :**
            - `resource` : type de ressource (`agent`, `team`, `task`, `workflow`, `prompt`)
            - `action` : recherche partielle sur le nom de l'action (ex: `DELETE`)
            - `success` : `true` = succès seulement, `false` = erreurs seulement
            - `from` / `to` : plage temporelle ISO 8601 (`2026-06-01T00:00:00`)
            """
    )
    @ApiResponse(responseCode = "200", description = "Page de logs d'audit")
    @GetMapping
    public ResponseEntity<PageResponse<AuditLogResponse>> getMyLogs(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "Filtrer par type de ressource", example = "agent")
            @RequestParam(required = false) String resource,
            @Parameter(description = "Filtrer par action (recherche partielle)", example = "DELETE")
            @RequestParam(required = false) String action,
            @Parameter(description = "`true` = succès, `false` = erreurs")
            @RequestParam(required = false) Boolean success,
            @Parameter(description = "Date de début (ISO 8601)", example = "2026-06-01T00:00:00")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @Parameter(description = "Date de fin (ISO 8601)", example = "2026-06-30T23:59:59")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @Parameter(description = "Page (0-based)", example = "0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Taille de page", example = "50")
            @RequestParam(defaultValue = "50") int size) {

        var pageable = PageRequest.of(page, size, Sort.by("timestamp").descending());
        var result = auditService.search(userId, resource, action, success, from, to, pageable);
        return ResponseEntity.ok(PageResponse.from(result, AuditLogResponse::from));
    }

    @Operation(
        summary = "Historique complet d'une ressource",
        description = """
            Retourne toutes les opérations effectuées sur une ressource précise.
            Utile pour auditer l'historique complet d'un agent, d'une équipe, d'une tâche, etc.

            **Exemple :** `GET /api/audit/resource/agent/55865815-187e-4ef1-b2d4-a4814bd05cac`
            → toutes les créations, modifs, suppressions, restaurations de cet agent.
            """
    )
    @ApiResponse(responseCode = "200", description = "Historique de la ressource")
    @GetMapping("/resource/{resource}/{resourceId}")
    public ResponseEntity<PageResponse<AuditLogResponse>> getResourceHistory(
            @Parameter(description = "Type de ressource", example = "agent") @PathVariable String resource,
            @Parameter(description = "UUID de la ressource") @PathVariable String resourceId,
            @Parameter(description = "Page (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Taille de page") @RequestParam(defaultValue = "50") int size) {

        var pageable = PageRequest.of(page, size, Sort.by("timestamp").descending());
        var result = auditService.getResourceHistory(resource, resourceId, pageable);
        return ResponseEntity.ok(PageResponse.from(result, AuditLogResponse::from));
    }
}
