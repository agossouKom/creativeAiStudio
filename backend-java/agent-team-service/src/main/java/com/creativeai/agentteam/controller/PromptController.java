package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.PromptTemplateRequest;
import com.creativeai.agentteam.model.PromptTemplate;
import com.creativeai.agentteam.service.PromptService;
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
 * Gestion des templates de prompts par agent.
 *
 * <p>Le prompt de type {@code SYSTEM} remplace le prompt système générique
 * de l'orchestrateur. Les autres types ({@code TASK}, {@code REPLY}…) sont
 * utilisés programmatiquement.
 */
@Tag(
    name = "Prompts",
    description = """
        Gestion des templates de prompts par agent.

        Un **prompt template** permet de personnaliser complètement le comportement
        d'un agent. Le prompt de type `SYSTEM` est injecté en tête de chaque conversation
        à la place du prompt générique.

        **Variables dynamiques :**
        Utilisez `{{nomVariable}}` dans le `content` pour des variables remplacées
        à l'exécution. Déclarez-les dans `variablesJson`.

        **Types de prompts (`type`) :**
        | Type | Usage |
        |------|-------|
        | `SYSTEM` | Instructions générales de l'agent (personnalité, règles) |
        | `TASK` | Instructions pour exécuter une tâche spécifique |
        | `REPLY` | Template de réponse formatée |
        | `ANALYSIS` | Instructions d'analyse de documents |
        | `CLASSIFICATION` | Règles de classification |
        | `EXTRACTION` | Instructions d'extraction d'informations |
        | `GENERATION` | Instructions de génération de contenu |

        Authentification requise : `Authorization: Bearer <JWT>`
        """
)
@RestController
@RequestMapping("/api/agents/{agentId}/prompts")
@RequiredArgsConstructor
public class PromptController {

    private final PromptService promptService;

    @Operation(
        summary = "Créer un template de prompt",
        description = """
            Crée et attache un template de prompt à l'agent.

            Le prompt `SYSTEM` remplace immédiatement le prompt par défaut de l'orchestrateur.
            Un seul prompt `SYSTEM` actif est utilisé par conversation (le plus récent si plusieurs).

            **Syntaxe des variables :** `{{nomVariable}}`
            Elles sont remplacées à l'exécution via `variablesJson`.
            """,
        requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
            content = @Content(
                mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = {
                    @ExampleObject(
                        name = "Prompt SYSTEM SCRUM_MASTER",
                        summary = "Prompt système pour un chef de projet IA",
                        value = """
                            {
                              "name": "Prompt Chef de Projet",
                              "type": "SYSTEM",
                              "content": "Tu es {{role}}, un chef de projet agile expert.\\nTon rôle est de :\\n- Analyser les demandes de l'utilisateur\\n- Déléguer aux agents spécialisés via l'outil delegate_to_agent\\n- Synthétiser les résultats\\n- Toujours répondre en français\\n\\nNe réponds jamais directement aux tâches spécialisées (emails, images…), délègue-les toujours.",
                              "description": "Prompt principal du SCRUM_MASTER",
                              "variablesJson": "{\\"role\\": \\"ChefBot\\"}",
                              "active": true
                            }
                            """
                    ),
                    @ExampleObject(
                        name = "Prompt SYSTEM EMAIL_MANAGER",
                        summary = "Prompt système pour l'agent email",
                        value = """
                            {
                              "name": "Prompt Email Pro",
                              "type": "SYSTEM",
                              "content": "Tu es un expert en communication professionnelle.\\nTu rédiges des emails clairs, concis et professionnels en français.\\nAdapte toujours le ton selon le contexte : formel pour les relances, chaleureux pour les remerciements.",
                              "active": true
                            }
                            """
                    ),
                    @ExampleObject(
                        name = "Prompt TASK (extraction)",
                        summary = "Instructions pour extraire des données d'un email",
                        value = """
                            {
                              "name": "Extracteur email",
                              "type": "EXTRACTION",
                              "content": "Extrait du texte suivant : l'expéditeur, la date, le sujet, le niveau d'urgence (1-5) et les actions requises. Retourne un JSON structuré.",
                              "active": true
                            }
                            """
                    )
                }
            )
        )
    )
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Prompt créé et actif"),
        @ApiResponse(responseCode = "400", description = "Champs invalides (name, type ou content manquant)"),
        @ApiResponse(responseCode = "404", description = "Agent introuvable")
    })
    @PostMapping
    public ResponseEntity<PromptTemplate> create(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent") @PathVariable String agentId,
            @Valid @RequestBody PromptTemplateRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(promptService.createPrompt(userId, agentId, req));
    }

    @Operation(
        summary = "Lister les prompts d'un agent",
        description = "Retourne tous les templates de prompts de l'agent, tous types confondus."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Liste des prompts"),
        @ApiResponse(responseCode = "404", description = "Agent introuvable")
    })
    @GetMapping
    public ResponseEntity<List<PromptTemplate>> list(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent") @PathVariable String agentId) {
        return ResponseEntity.ok(promptService.listPrompts(userId, agentId));
    }

    @Operation(
        summary = "Supprimer un prompt (soft delete)",
        description = """
            Marque le prompt comme supprimé. Si c'était le seul prompt `SYSTEM` actif,
            l'agent retombe sur le prompt générique. Récupérable via `POST /{promptId}/restore`.
            """
    )
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Prompt supprimé"),
        @ApiResponse(responseCode = "404", description = "Prompt ou agent introuvable")
    })
    @DeleteMapping("/{promptId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent") @PathVariable String agentId,
            @Parameter(description = "UUID du prompt")  @PathVariable String promptId) {
        promptService.deletePrompt(userId, agentId, promptId);
        return ResponseEntity.noContent().build();
    }

    // ── Soft-delete / Restore ─────────────────────────────────────────────

    @Operation(summary = "Lister les prompts supprimés d'un agent",
               description = "Retourne les prompts dont `deleted=true` pour cet agent.")
    @ApiResponse(responseCode = "200", description = "Liste des prompts supprimés")
    @GetMapping("/deleted")
    public ResponseEntity<List<PromptTemplate>> listDeleted(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent") @PathVariable String agentId) {
        return ResponseEntity.ok(promptService.listDeletedPrompts(userId, agentId));
    }

    @Operation(summary = "Restaurer un prompt supprimé",
               description = "Remet `deleted=false`. Le prompt réapparaît dans `GET /api/agents/{agentId}/prompts`.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Prompt restauré"),
        @ApiResponse(responseCode = "404", description = "Prompt supprimé introuvable")
    })
    @PostMapping("/{promptId}/restore")
    public ResponseEntity<PromptTemplate> restore(@AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent") @PathVariable String agentId,
            @Parameter(description = "UUID du prompt supprimé") @PathVariable String promptId) {
        return ResponseEntity.ok(promptService.restorePrompt(userId, agentId, promptId));
    }
}
