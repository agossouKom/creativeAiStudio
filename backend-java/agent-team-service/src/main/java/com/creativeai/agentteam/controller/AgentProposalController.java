package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.response.AgentProposalResponse;
import com.creativeai.agentteam.model.enums.ProposalStatus;
import com.creativeai.agentteam.service.AgentProposalService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Agent Proposals", description = "File d'approbation des créations d'agent proposées par le SCRUM MANAGER")
@RestController
@RequestMapping("/api/agent-proposals")
@RequiredArgsConstructor
public class AgentProposalController {

    private final AgentProposalService proposalService;

    @Operation(
        summary = "Lister les propositions de création d'agent",
        description = "Renvoie les propositions de l'utilisateur connecté, filtrées par statut (PENDING par défaut)."
    )
    @GetMapping
    public ResponseEntity<List<AgentProposalResponse>> list(
        @AuthenticationPrincipal String userId,
        @Parameter(description = "Filtrer par statut (PENDING, APPROVED, REFUSED)") @RequestParam(required = false) ProposalStatus status) {
        ProposalStatus effective = status != null ? status : ProposalStatus.PENDING;
        return ResponseEntity.ok(proposalService.list(userId, effective));
    }

    @Operation(summary = "Valider la création d'agent (un clic)", description = "Crée l'agent tout configuré (outils, modèle IA, prompt depuis le template) au nom de l'utilisateur connecté.")
    @PostMapping("/{proposalId}/approve")
    public ResponseEntity<AgentProposalResponse> approve(
        @AuthenticationPrincipal String userId,
        @Parameter(description = "UUID de la proposition") @PathVariable String proposalId) {
        return ResponseEntity.ok(proposalService.approve(userId, proposalId));
    }

    @Operation(summary = "Refuser la création d'agent", description = "Clôt la proposition sans créer d'agent.")
    @PostMapping("/{proposalId}/refuse")
    public ResponseEntity<AgentProposalResponse> refuse(
        @AuthenticationPrincipal String userId,
        @Parameter(description = "UUID de la proposition") @PathVariable String proposalId) {
        return ResponseEntity.ok(proposalService.refuse(userId, proposalId));
    }
}