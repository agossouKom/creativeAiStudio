package com.creativeai.agentteam.dto.request;

import com.creativeai.agentteam.model.enums.LlmType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * Aperçu du catalogue d'un fournisseur <b>avant</b> enregistrement du provider.
 *
 * <p>La clé transite par le corps de la requête et non par la query string :
 * une URL est routinely écrite dans les journaux d'accès du gateway et du
 * reverse proxy, ce qui y exposerait la clé en clair. Elle n'est ni persistée ni
 * journalisée.
 *
 * @param type    fournisseur visé, pour choisir l'URL par défaut
 * @param baseUrl URL personnalisée (Ollama self-hosted, compatible OpenAI…)
 * @param apiKey  clé saisie dans le formulaire, optionnelle
 */
@Schema(description = "Aperçu des modèles d'un fournisseur avant enregistrement")
public record AvailableModelsRequest(

    @Schema(description = "Fournisseur LLM", example = "GROQ")
    @NotNull
    LlmType type,

    @Schema(description = "URL de base personnalisée", example = "http://localhost:11434")
    String baseUrl,

    @Schema(description = "Clé API en clair, utilisée pour l'appel et non conservée")
    String apiKey
) {}