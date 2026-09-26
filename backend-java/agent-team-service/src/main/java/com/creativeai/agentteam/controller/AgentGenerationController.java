package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.GenerationStoryboardRequest;
import com.creativeai.agentteam.dto.response.GenerationStoryboardResponse;
import com.creativeai.agentteam.llm.LlmGateway;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.service.ResourceNotFoundException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/agents/{agentId}/generation")
@RequiredArgsConstructor
public class AgentGenerationController {

    private static final String STORYBOARD_SCHEMA = """
        {"type":"object","required":["title","duration","scenes"],"properties":{
          "title":{"type":"string"},"duration":{"type":"integer"},
          "scenes":{"type":"array","items":{"type":"object","required":
            ["duration","narration","visual_prompt","keywords"],"properties":{
              "duration":{"type":"integer"},"narration":{"type":"string"},
              "visual_prompt":{"type":"string"},
              "keywords":{"type":"array","items":{"type":"string"}}
            }
          }}
        }}
        """;

    private final AgentRepository agentRepository;
    private final LlmGateway llmGateway;
    private final ObjectMapper objectMapper;

    @Operation(
        summary = "Générer un storyboard vidéo avec le provider de l'agent ou de son équipe",
        description = "La clé API reste dans agent-team-service et n'est jamais transmise au worker.")
    @PostMapping("/storyboards")
    public ResponseEntity<GenerationStoryboardResponse> storyboards(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId,
            @Valid @RequestBody GenerationStoryboardRequest request) {
        agentRepository.findByIdAndOwnerIdAndDeletedFalse(agentId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));

        String systemPrompt = "Return only a JSON object matching this schema: " + STORYBOARD_SCHEMA;
        List<JsonNode> results = new ArrayList<>();
        for (int variation = 0; variation < request.variations(); variation++) {
            String language = request.language() == null || request.language().isBlank()
                ? "English" : request.language().trim();
            String prompt = """
                Create a concise video storyboard as JSON only. Topic: %s.
                Write narration in %s. Return duration exactly %d seconds, with
                2-6 scenes whose integer durations sum exactly to the requested
                duration. Each scene needs original narration, a literal stock
                video search phrase in visual_prompt, and 2-5 concise keywords.
                This is variation %d; make it distinct.
                """.formatted(request.prompt().trim(), language,
                    request.durationSeconds(), variation + 1);
            String response = llmGateway.completeText(agentId, systemPrompt, prompt);
            try {
                JsonNode storyboard = objectMapper.readTree(response);
                if (storyboard == null || !storyboard.isObject()) {
                    throw new IllegalArgumentException("Storyboard must be a JSON object");
                }
                results.add(storyboard);
            } catch (Exception e) {
                throw new IllegalArgumentException(
                    "Le provider de l'agent a renvoyé un storyboard JSON invalide", e);
            }
        }
        return ResponseEntity.ok(new GenerationStoryboardResponse(results));
    }
}
