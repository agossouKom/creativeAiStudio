package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.AvailableModelsRequest;
import com.creativeai.agentteam.dto.request.LlmProviderRequest;
import com.creativeai.agentteam.dto.response.AvailableModelResponse;
import com.creativeai.agentteam.dto.response.LlmProviderResponse;
import com.creativeai.agentteam.llm.LlmResolution;
import com.creativeai.agentteam.model.LlmProvider;
import com.creativeai.agentteam.model.enums.LlmType;
import com.creativeai.agentteam.service.AgentService;
import com.creativeai.agentteam.service.LlmModelCatalogService;
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
import org.springframework.web.server.ResponseStatusException;

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

    private final AgentService           agentService;
    private final LlmModelCatalogService catalogService;

    @Operation(summary = "Lister les LLM providers de mon compte")
    @GetMapping
    public ResponseEntity<List<LlmProviderResponse>> list(
            @AuthenticationPrincipal String userId,
            @RequestParam(defaultValue = "false") boolean includeDeleted) {
        return ResponseEntity.ok(agentService.listUserLlmProviders(userId, includeDeleted));
    }

    /**
     * Provider effectivement utilisé par le backend pour l'agent demandé,
     * selon l'ordre de résolution agent > équipe > compte > admin.
     *
     * <p>Le frontend s'en sert pour afficher le modèle actif au lieu d'un
     * modèle en dur qui ne correspond pas toujours à la configuration réelle.
     * Aucune clé n'est exposée ici.
     *
     * <p>Le champ {@code resolutionSource} indique le tier qui a fourni ce
     * provider. C'est l'information qui manque quand on veut savoir d'où vient
     * le modèle d'un agent : les attributs du provider ne permettent pas de le
     * déduire, et s'en remettre à eux conduit régulièrement à la mauvaise
     * conclusion.
     */
    @Operation(
        summary = "Provider LLM résolu pour un agent",
        description = """
            Retourne le provider que le LlmGateway sélectionnerait pour cet agent
            (agent > équipe > compte > équipe auto > défaut plateforme > admin >
            clé d'environnement), ainsi que le tier d'origine dans
            resolutionSource. 404 si aucun provider n'est configuré.
            La clé API n'est jamais retournée.
            """)
    @GetMapping("/resolved")
    public ResponseEntity<LlmProviderResponse> resolved(
            @AuthenticationPrincipal String userId,
            @RequestParam(required = false) String agentId) {
        LlmResolution resolution = agentService.resolveLlmResolutionFor(userId, agentId);
        return ResponseEntity.ok(LlmProviderResponse.from(resolution.provider())
            .withResolutionSource(resolution.source()));
    }

    /**
     * Modèles réellement disponibles chez un fournisseur déjà enregistré.
     *
     * <p>Alimente le sélecteur de modèle de l'espace de travail : la liste
     * provient de l'endpoint {@code /models} du fournisseur, donc les modèles
     * retirés côté fournisseur disparaissent au lieu d'être proposés puis
     * rejetés en 404 au premier appel. La clé est déchiffrée côté serveur et
     * n'est jamais renvoyée au client.
     *
     * <p>Pour un fournisseur pas encore enregistré, utiliser
     * {@code POST /models/preview} : la clé transite alors par le corps de la
     * requête, jamais par l'URL.
     */
    @Operation(
        summary = "Modèles disponibles chez un fournisseur enregistré",
        description = """
            Interroge GET {baseUrl}/models chez le fournisseur et renvoie la liste
            de ses modèles. Sans clé, Groq/OpenAI refusent l'appel : la réponse
            indique alors source="none" et une saisie libre est possible.
            """)
    @GetMapping("/models")
    public ResponseEntity<AvailableModelResponse> models(
            @AuthenticationPrincipal String userId,
            @RequestParam(required = false) String llmId) {

        if (llmId == null || llmId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Le paramètre llmId est requis sur cette route. "
                    + "Pour prévisualiser un fournisseur non encore enregistré, utilisez POST /models.");
        }
        return ResponseEntity.ok(catalogService.listModelsFor(
            agentService.requireOwnedUserLlmProvider(userId, llmId)));
    }

    /**
     * Aperçu du catalogue avant enregistrement, la clé circulant dans le corps
     * de la requête.
     *
     * <p>Le passage de la query string au POST est délibéré : une clé placée
     * dans l'URL se retrouve dans les journaux du gateway et du reverse proxy,
     * ainsi que dans l'historique du navigateur. Ici elle n'est ni journalisée ni
     * conservée.
     */
    @Operation(
        summary = "Modèles d'un fournisseur en cours de configuration",
        description = """
            Interroge GET {baseUrl}/models sans rien enregistrer. La clé API
            transite par le corps de la requête et n'est ni stockée ni journalisée.
            """)
    @PostMapping(value = "/models/preview", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<AvailableModelResponse> previewModels(
            @Valid @RequestBody AvailableModelsRequest req) {
        return ResponseEntity.ok(catalogService.previewModels(req.type(), req.baseUrl(), req.apiKey()));
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