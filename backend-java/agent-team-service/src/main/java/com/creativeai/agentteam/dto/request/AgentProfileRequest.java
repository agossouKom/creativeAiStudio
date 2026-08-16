package com.creativeai.agentteam.dto.request;

import com.creativeai.agentteam.model.enums.ToneStyle;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Profil d'identité visible d'un agent")
public record AgentProfileRequest(

    @Schema(description = "Nom affiché dans l'interface utilisateur", example = "ChefBot", maxLength = 100)
    @NotBlank @Size(max = 100)
    String displayName,

    @Schema(description = "Biographie courte présentant l'agent", example = "Je coordonne votre équipe d'agents IA pour maximiser l'efficacité.", maxLength = 500)
    @Size(max = 500)
    String bio,

    @Schema(
        description = "Description de la persona — instructions de roleplay injectées dans le prompt système. Ex : 'Tu es un expert RH avec 20 ans d'expérience...'",
        example = "Tu es un chef de projet agile expert. Tu analyses, coordonnes et délègues avec clarté."
    )
    String persona,

    @Schema(
        description = "Style de ton pour les réponses",
        example = "PROFESSIONAL",
        allowableValues = {"PROFESSIONAL", "CASUAL", "FORMAL", "FRIENDLY", "CREATIVE"}
    )
    ToneStyle tone,

    @Schema(
        description = "Message envoyé automatiquement au début de chaque nouvelle session",
        example = "Bonjour ! Je suis votre chef de projet IA. Comment puis-je coordonner votre équipe aujourd'hui ?"
    )
    String welcomeMessage,

    @Schema(description = "URL de l'avatar ou de l'image de profil de l'agent", example = "https://cdn.example.com/avatars/scrum-master.png")
    String avatarUrl,

    @Schema(
        description = "Liste des capacités déclarées au format JSON array. Informative, pas limitante.",
        example = "[\"delegation\", \"planning\", \"reporting\", \"email\"]"
    )
    String capabilitiesJson,

    @Schema(
        description = "Liste des restrictions au format JSON array. L'agent refusera les demandes dans ces domaines.",
        example = "[\"medical_advice\", \"legal_advice\"]"
    )
    String restrictionsJson,

    @Schema(
        description = "Directives de voix de marque au format JSON. Guide le ton éditorial.",
        example = "{\"avoid\": [\"informel\"], \"prefer\": [\"vous\", \"clair\", \"concis\"]}"
    )
    String brandVoiceJson

) {}
