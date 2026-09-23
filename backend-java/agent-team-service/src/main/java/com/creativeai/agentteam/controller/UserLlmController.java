package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.LlmProviderRequest;
import com.creativeai.agentteam.dto.response.LlmProviderResponse;
import com.creativeai.agentteam.service.AgentService;
import io.swagger.v3.oas.annotations.Operation;
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
import java.util.Map;

/**
 * CRUD des LLM providers rattachés au compte utilisateur courant.
 *
 * <p>Chaque utilisateur configure ses propres providers LLM (clés API, modèles)
 * qui sont ensuite utilisés par tous ses agents. Les providers du compte admin
 * servent de **provider par défaut** (fallback global) pour tous les comptes
 * qui n'en ont pas configuré.
 */
@Tag(
    name = "LLM Providers (compte)",
    description = """
        LLM providers rattachés au compte utilisateur courant (userId = email JWT).

        Ils servent de fallback pour tous les agents du compte. Les providers du
        compte admin (`ADMIN_USER_ID`) font office de provider par défaut pour
        l'ensemble des comptes.
        """
)
@RestController
@RequestMapping("/api/users/me/llm-providers")
@RequiredArgsConstructor
public class UserLlmController {

    private final AgentService agentService;

    @Operation(summary = "Lister les LLM providers de mon compte")
    @GetMapping
    public ResponseEntity<List<LlmProviderResponse>> list(
            @AuthenticationPrincipal String userId,
            @RequestParam(defaultValue = "false") boolean includeDeleted) {
        return ResponseEntity.ok(agentService.listUserLlmProviders(userId, includeDeleted));
    }

    @Operation(summary = "Ajouter un LLM provider à mon compte")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "LLM provider ajouté"),
        @ApiResponse(responseCode = "400", description = "Champs obligatoires manquants (type, modelId)")
    })
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<LlmProviderResponse> add(
            @AuthenticationPrincipal String userId,
            @Valid @RequestBody LlmProviderRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(agentService.addUserLlmProvider(userId, req));
    }

    @Operation(summary = "Mettre à jour un LLM provider de mon compte")
    @PutMapping("/{llmId}")
    public ResponseEntity<LlmProviderResponse> update(
            @AuthenticationPrincipal String userId,
            @PathVariable String llmId,
            @Valid @RequestBody LlmProviderRequest req) {
        return ResponseEntity.ok(agentService.updateUserLlmProvider(userId, llmId, req));
    }

    @Operation(summary = "Définir un LLM provider de mon compte comme principal")
    @PatchMapping("/{llmId}/primary")
    public ResponseEntity<LlmProviderResponse> setPrimary(
            @AuthenticationPrincipal String userId,
            @PathVariable String llmId) {
        return ResponseEntity.ok(agentService.setPrimaryUserLlmProvider(userId, llmId));
    }

    @Operation(summary = "Supprimer (soft-delete) un LLM provider de mon compte")
    @DeleteMapping("/{llmId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal String userId,
            @PathVariable String llmId) {
        agentService.deleteUserLlmProvider(userId, llmId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Restaurer un LLM provider soft-deleted")
    @PostMapping("/{llmId}/restore")
    public ResponseEntity<LlmProviderResponse> restore(
            @AuthenticationPrincipal String userId,
            @PathVariable String llmId) {
        return ResponseEntity.ok(agentService.restoreUserLlmProvider(userId, llmId));
    }

    @Operation(summary = "Révéler la clé API d'un LLM provider de mon compte (décryptée)")
    @GetMapping("/{llmId}/reveal")
    public ResponseEntity<Map<String, String>> reveal(
            @AuthenticationPrincipal String userId,
            @PathVariable String llmId) {
        String key = agentService.revealUserLlmApiKey(userId, llmId);
        return ResponseEntity.ok(Map.of("apiKey", key));
    }
}