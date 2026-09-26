package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.LlmProviderRequest;
import com.creativeai.agentteam.dto.response.LlmProviderResponse;
import com.creativeai.agentteam.service.AgentService;
import io.swagger.v3.oas.annotations.Operation;
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

@Tag(name = "LLM Providers (équipe)", description = "Providers partagés et chiffrés par équipe")
@RestController
@RequestMapping("/api/teams/{teamId}/llm-providers")
@RequiredArgsConstructor
public class TeamLlmController {

    private final AgentService agentService;

    @Operation(summary = "Lister les providers LLM d'une équipe")
    @GetMapping
    public ResponseEntity<List<LlmProviderResponse>> list(
            @AuthenticationPrincipal String userId,
            @PathVariable String teamId,
            @RequestParam(defaultValue = "false") boolean includeDeleted) {
        return ResponseEntity.ok(agentService.listTeamLlmProviders(userId, teamId, includeDeleted));
    }

    @Operation(summary = "Ajouter un provider LLM à une équipe")
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<LlmProviderResponse> add(
            @AuthenticationPrincipal String userId,
            @PathVariable String teamId,
            @Valid @RequestBody LlmProviderRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(agentService.addTeamLlmProvider(userId, teamId, request));
    }

    @Operation(summary = "Mettre à jour un provider LLM d'une équipe")
    @PutMapping("/{llmId}")
    public ResponseEntity<LlmProviderResponse> update(
            @AuthenticationPrincipal String userId,
            @PathVariable String teamId,
            @PathVariable String llmId,
            @Valid @RequestBody LlmProviderRequest request) {
        return ResponseEntity.ok(
            agentService.updateTeamLlmProvider(userId, teamId, llmId, request));
    }

    @Operation(summary = "Définir le provider LLM principal d'une équipe")
    @PatchMapping("/{llmId}/primary")
    public ResponseEntity<LlmProviderResponse> setPrimary(
            @AuthenticationPrincipal String userId,
            @PathVariable String teamId,
            @PathVariable String llmId) {
        return ResponseEntity.ok(
            agentService.setPrimaryTeamLlmProvider(userId, teamId, llmId));
    }

    @Operation(summary = "Supprimer un provider LLM d'une équipe")
    @DeleteMapping("/{llmId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal String userId,
            @PathVariable String teamId,
            @PathVariable String llmId) {
        agentService.deleteTeamLlmProvider(userId, teamId, llmId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Restaurer un provider LLM supprimé d'une équipe")
    @PostMapping("/{llmId}/restore")
    public ResponseEntity<LlmProviderResponse> restore(
            @AuthenticationPrincipal String userId,
            @PathVariable String teamId,
            @PathVariable String llmId) {
        return ResponseEntity.ok(
            agentService.restoreTeamLlmProvider(userId, teamId, llmId));
    }

    @Operation(summary = "Révéler la clé d'un provider LLM d'une équipe")
    @GetMapping("/{llmId}/reveal")
    public ResponseEntity<Map<String, String>> reveal(
            @AuthenticationPrincipal String userId,
            @PathVariable String teamId,
            @PathVariable String llmId) {
        return ResponseEntity.ok(Map.of(
            "apiKey", agentService.revealTeamLlmApiKey(userId, teamId, llmId)));
    }
}
