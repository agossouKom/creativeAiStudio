package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.CreateTeamRequest;
import com.creativeai.agentteam.dto.request.UpdateTeamRequest;
import com.creativeai.agentteam.dto.response.TeamResponse;
import com.creativeai.agentteam.model.enums.TeamStatus;
import com.creativeai.agentteam.model.enums.TeamType;
import com.creativeai.agentteam.service.AgentTeamService;
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
 * Gestion des équipes multi-agents.
 *
 * <p>Une équipe regroupe plusieurs agents sous un agent lead (SCRUM_MASTER).
 * Pour chatter avec une équipe, utilisez {@code POST /api/teams/{teamId}/chat/stream}.
 */
@Tag(
    name = "Teams",
    description = """
        Gestion des équipes d'agents IA.

        Une **équipe** regroupe plusieurs agents spécialisés coordonnés par un agent lead.
        Le `leadAgentId` (généralement un `SCRUM_MASTER`) reçoit les messages de l'utilisateur
        et délègue automatiquement aux agents membres via l'outil `delegate_to_agent`.

        **Flux typique :**
        1. Créer les agents individuels (`POST /api/agents`)
        2. Créer l'équipe avec un lead agent (`POST /api/teams`)
        3. Ajouter les membres (`POST /api/teams/{id}/members/{agentId}`)
        4. Chatter avec l'équipe (`POST /api/teams/{id}/chat/stream`)

        Authentification requise : `Authorization: Bearer <JWT>`
        """
)
@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
public class TeamController {

    private final AgentTeamService teamService;

    @Operation(
        summary = "Créer une équipe",
        description = """
            Crée une nouvelle équipe d'agents.

            **`leadAgentId`** : UUID de l'agent qui reçoit tous les messages en premier
            et les délègue. Doit idéalement être de type `SCRUM_MASTER`.

            **`memberAgentIds`** : liste des agents qui composent l'équipe.
            Si `leadAgentId` est absent, le premier `SCRUM_MASTER` de cette liste
            sera utilisé automatiquement.

            **Modes de collaboration (`collaborationMode`) :**
            - `SEQUENTIAL` : les agents travaillent l'un après l'autre
            - `PARALLEL` : les agents travaillent simultanément
            - `HYBRID` : le lead décide (recommandé)
            """,
        requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
            content = @Content(
                mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = {
                    @ExampleObject(
                        name = "Équipe Business minimale",
                        summary = "Équipe avec lead agent seulement",
                        value = """
                            {
                              "name": "Équipe Business",
                              "leadAgentId": "55865815-187e-4ef1-b2d4-a4814bd05cac"
                            }
                            """
                    ),
                    @ExampleObject(
                        name = "Équipe complète",
                        summary = "Équipe avec membres et configuration complète",
                        value = """
                            {
                              "name": "Équipe Marketing Digital",
                              "description": "Gère emails, réseaux sociaux et prospection",
                              "type": "BUSINESS",
                              "leadAgentId": "55865815-187e-4ef1-b2d4-a4814bd05cac",
                              "collaborationMode": "HYBRID",
                              "sharedMemoryEnabled": true,
                              "maxConcurrentTasks": 5,
                              "memberAgentIds": [
                                "55865815-187e-4ef1-b2d4-a4814bd05cac",
                                "d82a47a7-938d-4ff3-a8be-46da5579357c"
                              ]
                            }
                            """
                    )
                }
            )
        )
    )
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Équipe créée"),
        @ApiResponse(responseCode = "400", description = "Champs invalides")
    })
    @PostMapping
    public ResponseEntity<TeamResponse> create(@AuthenticationPrincipal String userId,
            @Valid @RequestBody CreateTeamRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(teamService.createTeam(userId, req));
    }

    @Operation(
        summary = "Lister les équipes",
        description = """
            Retourne les équipes actives de l'utilisateur (non supprimées).

            **Filtres optionnels :**
            - `status` : `ACTIVE`, `PAUSED`, `ARCHIVED`
            - `type` : `BUSINESS`, `CREATIVE`

            Les deux peuvent être combinés.
            """
    )
    @ApiResponse(responseCode = "200", description = "Liste des équipes")
    @GetMapping
    public ResponseEntity<List<TeamResponse>> list(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "Filtrer par statut", example = "ACTIVE")
            @RequestParam(required = false) TeamStatus status,
            @Parameter(description = "Filtrer par type", example = "BUSINESS")
            @RequestParam(required = false) TeamType type) {
        return ResponseEntity.ok(teamService.listTeamsFiltered(userId, status, type));
    }

    @Operation(
        summary = "Obtenir une équipe",
        description = "Retourne le détail d'une équipe : membres, lead agent, configuration."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Détail de l'équipe"),
        @ApiResponse(responseCode = "404", description = "Équipe introuvable")
    })
    @GetMapping("/{teamId}")
    public ResponseEntity<TeamResponse> get(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'équipe", example = "c6b1312d-a126-4e5c-8d37-b1b7f4bab7d5")
            @PathVariable String teamId) {
        return ResponseEntity.ok(teamService.getTeam(userId, teamId));
    }

    @Operation(
        summary = "Modifier une équipe",
        description = "Met à jour le nom, la description, le lead agent ou les paramètres de collaboration."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Équipe mise à jour"),
        @ApiResponse(responseCode = "404", description = "Équipe introuvable")
    })
    @PutMapping("/{teamId}")
    public ResponseEntity<TeamResponse> update(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'équipe") @PathVariable String teamId,
            @Valid @RequestBody UpdateTeamRequest req) {
        return ResponseEntity.ok(teamService.updateTeam(userId, teamId, req));
    }

    @Operation(
        summary = "Ajouter un agent à l'équipe",
        description = """
            Ajoute un agent existant à la liste des membres de l'équipe.
            L'agent doit appartenir au même utilisateur.
            Si l'agent est déjà membre, l'opération est idempotente.
            """
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Agent ajouté, équipe mise à jour"),
        @ApiResponse(responseCode = "404", description = "Équipe ou agent introuvable")
    })
    @PostMapping("/{teamId}/members/{agentId}")
    public ResponseEntity<TeamResponse> addMember(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'équipe")  @PathVariable String teamId,
            @Parameter(description = "UUID de l'agent à ajouter") @PathVariable String agentId) {
        return ResponseEntity.ok(teamService.addMember(userId, teamId, agentId));
    }

    @Operation(
        summary = "Retirer un agent de l'équipe",
        description = "Retire un agent de la liste des membres. L'agent n'est pas supprimé."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Agent retiré, équipe mise à jour"),
        @ApiResponse(responseCode = "404", description = "Équipe introuvable")
    })
    @DeleteMapping("/{teamId}/members/{agentId}")
    public ResponseEntity<TeamResponse> removeMember(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'équipe")  @PathVariable String teamId,
            @Parameter(description = "UUID de l'agent à retirer") @PathVariable String agentId) {
        return ResponseEntity.ok(teamService.removeMember(userId, teamId, agentId));
    }

    @Operation(
        summary = "Supprimer une équipe (soft delete)",
        description = "Marque l'équipe comme supprimée. Les agents membres ne sont pas affectés. Récupérable via `POST /{teamId}/restore`."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Équipe supprimée"),
        @ApiResponse(responseCode = "404", description = "Équipe introuvable")
    })
    @DeleteMapping("/{teamId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'équipe") @PathVariable String teamId) {
        teamService.deleteTeam(userId, teamId);
        return ResponseEntity.noContent().build();
    }

    // ── Soft-delete / Restore ─────────────────────────────────────────────

    @Operation(
        summary = "Lister les équipes supprimées",
        description = "Retourne les équipes dont `deleted=true`, triées par date de suppression décroissante."
    )
    @ApiResponse(responseCode = "200", description = "Liste des équipes supprimées")
    @GetMapping("/deleted")
    public ResponseEntity<List<TeamResponse>> listDeleted(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(teamService.listDeletedTeams(userId));
    }

    @Operation(
        summary = "Restaurer une équipe supprimée",
        description = "Remet `deleted=false`. L'équipe réapparaît dans `GET /api/teams`."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Équipe restaurée"),
        @ApiResponse(responseCode = "404", description = "Équipe supprimée introuvable")
    })
    @PostMapping("/{teamId}/restore")
    public ResponseEntity<TeamResponse> restore(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'équipe supprimée") @PathVariable String teamId) {
        return ResponseEntity.ok(teamService.restoreTeam(userId, teamId));
    }
}
