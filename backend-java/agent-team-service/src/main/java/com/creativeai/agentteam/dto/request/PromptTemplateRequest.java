package com.creativeai.agentteam.dto.request;

import com.creativeai.agentteam.model.enums.PromptType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Template de prompt pour personnaliser le comportement d'un agent")
public record PromptTemplateRequest(

    @Schema(description = "Nom interne du template", example = "Prompt Chef de Projet v2")
    @NotBlank
    String name,

    @Schema(
        description = "Type de prompt",
        example = "SYSTEM",
        allowableValues = {"SYSTEM", "TASK", "ANALYSIS", "REPLY", "CLASSIFICATION", "EXTRACTION", "GENERATION"}
    )
    @NotNull
    PromptType type,

    @Schema(
        description = """
            Contenu du prompt. Supporte les variables `{{nomVariable}}` remplacées à l'exécution.
            Pour le type SYSTEM : instructions générales, persona, règles de comportement.
            """,
        example = "Tu es {{role}}, un expert en coordination d'équipes IA. Réponds toujours en français. Ne réponds jamais directement aux tâches spécialisées, délègue-les via l'outil delegate_to_agent."
    )
    @NotBlank
    String content,

    @Schema(description = "Description interne de l'usage de ce template", example = "Prompt principal du SCRUM_MASTER avec délégation automatique")
    String description,

    @Schema(
        description = "Variables déclarées au format JSON objet. Clés = noms des variables, valeurs = valeurs par défaut.",
        example = "{\"role\": \"ChefBot\", \"company\": \"Acme Corp\"}"
    )
    String variablesJson,

    @Schema(description = "Si `true`, ce template est utilisé. Un seul template `SYSTEM` actif est utilisé par appel LLM.", example = "true")
    Boolean active

) {}
