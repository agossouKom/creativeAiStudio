package com.creativeai.agentteam.dto.request;

import com.creativeai.agentteam.model.enums.Priority;
import com.creativeai.agentteam.model.enums.TaskSource;
import com.creativeai.agentteam.model.enums.TaskType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;

@Schema(description = "Payload de création d'une tâche agent")
public record CreateTaskRequest(

    @Schema(description = "Titre court et descriptif de la tâche", example = "Rédiger email de relance client Dupont", maxLength = 500)
    @NotBlank @Size(max = 500)
    String title,

    @Schema(
        description = "Description détaillée : contexte, instructions, contraintes",
        example = "Le client Dupont n'a pas payé la facture #2024-042 (1200€). Échéance dépassée de 30 jours. Ton poli mais ferme."
    )
    String description,

    @Schema(
        description = "Type de tâche selon le domaine fonctionnel",
        example = "EMAIL_RESPONSE",
        allowableValues = {
            "EMAIL_RESPONSE", "EMAIL_CLASSIFICATION", "EMAIL_FORWARD",
            "SOCIAL_POST", "SOCIAL_REPLY", "SOCIAL_ANALYTICS",
            "PROSPECT_SEARCH", "PROSPECT_QUALIFY", "PROSPECT_OUTREACH",
            "CAMPAIGN_CREATE", "CONTENT_GENERATE", "SEO_OPTIMIZE",
            "TICKET_HANDLE", "TICKET_ESCALATE",
            "DOCUMENT_INGEST", "DOCUMENT_SEARCH", "DOCUMENT_SUMMARIZE",
            "CV_CREATE", "CV_ANALYZE",
            "IMAGE_GENERATE", "IMAGE_EDIT",
            "VIDEO_GENERATE", "VIDEO_TRANSCRIBE",
            "SECURITY_SCAN", "SECURITY_AUDIT",
            "REPORT_GENERATE", "GENERAL"
        }
    )
    TaskType type,

    @Schema(
        description = "Priorité de traitement",
        example = "HIGH",
        allowableValues = {"LOW", "MEDIUM", "HIGH", "URGENT", "CRITICAL"}
    )
    Priority priority,

    @Schema(
        description = "Origine de la tâche",
        example = "USER",
        allowableValues = {"USER", "WORKFLOW", "INTER_AGENT", "API", "SCHEDULED", "EMAIL", "SOCIAL"}
    )
    TaskSource source,

    @Schema(description = "UUID de l'agent responsable de l'exécution", example = "d82a47a7-938d-4ff3-a8be-46da5579357c")
    String assignedAgentId,

    @Schema(description = "UUID de l'équipe associée", example = "c6b1312d-a126-4e5c-8d37-b1b7f4bab7d5")
    String teamId,

    @Schema(description = "UUID de la tâche parente (pour les sous-tâches dans un workflow)")
    String parentTaskId,

    @Schema(
        description = "Données brutes d'entrée au format JSON, spécifiques au type de tâche",
        example = "{\"emailId\": \"email-uuid\", \"subject\": \"Relance facture\", \"attachments\": []}"
    )
    String payload,

    @Schema(description = "Date et heure limite d'exécution (ISO 8601)", example = "2026-06-10T12:00:00")
    LocalDateTime dueDate,

    @Schema(description = "Date/heure d'exécution programmée — null = immédiat", example = "2026-06-11T09:00:00")
    LocalDateTime scheduledAt,

    @Schema(description = "Contacts ciblés JSON [{email, phone, name}]")
    String contacts,

    @Schema(description = "Résultat attendu par l'utilisateur")
    String expectedResult,

    @Schema(description = "Tâche confidentielle")
    Boolean confidential,

    // ── Promotion produit (type = PRODUCT_PROMOTION) ──────────────────────────

    @Schema(description = "Codes uniques des produits à promouvoir", example = "[\"PRD001\",\"PRD002\"]")
    List<String> productCodes,

    @Schema(description = "Plateformes de publication", example = "[\"INSTAGRAM\",\"FACEBOOK\",\"TIKTOK\"]")
    List<String> platforms,

    @Schema(description = "Hashtags personnalisés à inclure dans les posts", example = "#promo #nouveauté")
    String hashtags,

    @Schema(description = "Ton souhaité : dynamique, professionnel, humoristique, inspirant")
    String tone,

    @Schema(description = "Objectif de campagne : VENTES, NOTORIETE, ENGAGEMENT",
            allowableValues = {"VENTES", "NOTORIETE", "ENGAGEMENT"})
    String campaignObjective

) {}
