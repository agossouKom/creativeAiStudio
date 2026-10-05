package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.response.LlmProviderResponse;
import com.creativeai.agentteam.model.LlmProvider;
import com.creativeai.agentteam.service.AgentService;
import com.creativeai.agentteam.service.LlmProviderProvisioningService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Point d'entrée administrateur pour le provider LLM par défaut de la plateforme.
 *
 * <p>Un administrateur enregistre un provider depuis son espace de travail
 * (comme n'importe quel utilisateur), puis le marque ici comme provider par
 * défaut. Ce modèle est alors recopié automatiquement dans chaque compte qui
 * n'a encore aucun provider — donc notamment chez tous les nouveaux inscrits,
 * qui peuvent chatter immédiatement sans configuration préalable. Les comptes
 * qui ont déjà choisi leur modèle ne sont jamais écrasés, et l'utilisateur peut
 * toujours remplacer ou supprimer le provider reçu.
 *
 * <p>{@code @PreAuthorize("hasRole('ADMIN')")} : marquer un provider par
 * défaut revient à faire porter sa clé API par tous les comptes de la
 * plateforme, l'opération doit donc être réservée aux administrateurs.
 */
@Tag(
    name = "Admin — LLM providers",
    description = "Provider LLM par défaut de la plateforme, hérité par les comptes sans configuration."
)
@RestController
@RequestMapping("/api/admin/llm-providers")
@RequiredArgsConstructor
public class AdminLlmController {

    private final LlmProviderProvisioningService provisioningService;
    private final AgentService agentService;

    @Operation(
        summary = "Provider LLM actuellement défini par défaut pour la plateforme",
        description = "404 si aucun provider n'est marqué par défaut.")
    @GetMapping("/platform-default")
    public ResponseEntity<LlmProviderResponse> current() {
        LlmProvider provider = provisioningService.currentPlatformDefault()
            .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.NOT_FOUND,
                "Aucun provider LLM par défaut n'est défini"));
        return ResponseEntity.ok(LlmProviderResponse.from(provider));
    }

    /**
     * Marque un provider existant comme provider par défaut de la plateforme.
     *
     * <p>Le provider doit appartenir au compte de l'administrateur appelant :
     * on ne peut pas déclarer par défaut la clé d'un autre utilisateur.
     */
    @Operation(
        summary = "Définir un de mes providers comme provider par défaut de la plateforme",
        description = """
            Le modèle et la clé API sont recopiés dans chaque compte dépourvu de
            provider, y compris les inscriptions futures. Les comptes ayant déjà
            un modèle ne sont pas modifiés.
            """)
    @PutMapping("/platform-default/{llmId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<LlmProviderResponse> setDefault(
            @org.springframework.security.core.annotation.AuthenticationPrincipal String userId,
            @PathVariable String llmId) {
        LlmProvider owned = agentService.requireOwnedUserLlmProvider(userId, llmId);
        return ResponseEntity.ok(
            LlmProviderResponse.from(provisioningService.setPlatformDefault(owned)));
    }

    /** Retire le statut de provider par défaut, sans supprimer le provider. */
    @Operation(summary = "Retirer le statut de provider par défaut de la plateforme")
    @DeleteMapping("/platform-default")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> clear() {
        provisioningService.clearPlatformDefault();
        return ResponseEntity.ok(Map.of("status", "cleared"));
    }
}