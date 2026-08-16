package com.creativeai.agentteam.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

@Schema(description = "Configuration comportementale d'un agent")
public record AgentConfigRequest(

    @Schema(
        description = "Température LLM : contrôle la créativité des réponses. 0.0 = déterministe, 2.0 = très créatif. Recommandé : 0.3–0.7 pour les tâches métier.",
        example = "0.5",
        minimum = "0.0",
        maximum = "2.0"
    )
    @DecimalMin("0.0") @DecimalMax("2.0")
    Double temperature,

    @Schema(
        description = "Nombre maximum de tokens générés par réponse LLM. 1024 pour des réponses courtes, 4096+ pour des analyses longues.",
        example = "2048",
        minimum = "1",
        maximum = "32768"
    )
    @Min(1) @Max(32768)
    Integer maxTokens,

    @Schema(
        description = "Nombre de messages conservés en mémoire contextuelle. Plus élevé = plus de contexte, mais plus de coût LLM.",
        example = "20",
        minimum = "1",
        maximum = "200"
    )
    @Min(1) @Max(200)
    Integer maxMemoryMessages,

    @Schema(
        description = "Nombre maximum d'itérations dans la boucle agentique (LLM → outil → LLM…). Évite les boucles infinies.",
        example = "8",
        minimum = "1",
        maximum = "20"
    )
    @Min(1) @Max(20)
    Integer maxIterations,

    @Schema(
        description = "Timeout d'exécution d'une tâche assignée en secondes.",
        example = "120",
        minimum = "10",
        maximum = "600"
    )
    @Min(10) @Max(600)
    Integer taskTimeoutSeconds,

    @Schema(
        description = "Limite de requêtes LLM par minute (rate limiting côté agent).",
        example = "30",
        minimum = "1",
        maximum = "300"
    )
    @Min(1) @Max(300)
    Integer rateLimitRpm,

    @Schema(description = "Code langue ISO 639-1 pour les réponses. `fr` par défaut.", example = "fr")
    String responseLanguage,

    @Schema(description = "Timezone IANA pour les références temporelles (dates, planifications).", example = "Europe/Paris")
    String timezone,

    @Schema(description = "Active le streaming SSE pour le chat. `true` recommandé.", example = "true")
    Boolean streamingEnabled,

    @Schema(description = "Si `true`, escalade automatiquement vers le lead agent en cas d'échec.", example = "false")
    Boolean autoEscalateEnabled,

    @Schema(description = "Si `true`, l'agent répond automatiquement aux messages entrants sans intervention humaine.", example = "false")
    Boolean autoReplyEnabled,

    @Schema(
        description = "Plages horaires de disponibilité au format JSON. Ex : actif uniquement en heures ouvrées.",
        example = "{\"monday\": \"09:00-18:00\", \"tuesday\": \"09:00-18:00\", \"saturday\": \"closed\"}"
    )
    String workingHoursJson,

    @Schema(
        description = "Paramètres personnalisés additionnels au format JSON (selon le type d'agent).",
        example = "{\"emailSignature\": \"Cordialement,\\nL'équipe\", \"maxEmailsPerDay\": 50}"
    )
    String customParams

) {}
