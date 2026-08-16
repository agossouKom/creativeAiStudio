package com.creativeai.agentteam.dto.request;

import com.creativeai.agentteam.model.enums.LlmType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Configuration d'un provider LLM pour un agent")
public record LlmProviderRequest(

    @Schema(
        description = "Fournisseur LLM",
        example = "OPENAI",
        allowableValues = {"GROQ", "OPENAI", "ANTHROPIC", "OLLAMA", "MISTRAL", "GEMINI", "COHERE", "TOGETHER_AI"}
    )
    @NotNull
    LlmType type,

    @Schema(
        description = "Identifiant du modèle selon le fournisseur",
        example = "gpt-4o-mini"
    )
    @NotBlank
    String modelId,

    @Schema(
        description = "URL de base de l'API (requis pour OLLAMA self-hosted, optionnel sinon)",
        example = "http://localhost:11434"
    )
    String baseUrl,

    @Schema(
        description = "Clé API du fournisseur. Stockée chiffrée.",
        example = "sk-xxxxxxxxxxxxxxxxxxxx"
    )
    String apiKey,

    @Schema(description = "Nom d'affichage interne (ex: 'GPT-4o production')", example = "GPT-4o-mini prod")
    String displayName,

    @Schema(
        description = "Température de génération (0.0 = déterministe, 2.0 = très créatif). Écrase la valeur de la config agent.",
        example = "0.5",
        minimum = "0.0",
        maximum = "2.0"
    )
    Double temperature,

    @Schema(description = "Nombre max de tokens générés par réponse. Écrase la config agent.", example = "2048")
    Integer maxTokens,

    @Schema(description = "Active le streaming SSE. `true` recommandé pour le chat.", example = "true")
    Boolean streamingEnabled,

    @Schema(description = "Timeout de la requête LLM en secondes.", example = "60")
    Integer requestTimeoutSeconds,

    @Schema(description = "Limite de requêtes par minute (rate limiting). 0 = pas de limite.", example = "60")
    Integer rateLimitRpm,

    @Schema(description = "Si `true`, ce provider est utilisé en priorité par l'orchestrateur.", example = "true")
    Boolean primary,

    @Schema(
        description = "Paramètres supplémentaires au format JSON (ex: options spécifiques au provider)",
        example = "{\"top_p\": 0.9, \"frequency_penalty\": 0.2}"
    )
    String extraParams

) {}
