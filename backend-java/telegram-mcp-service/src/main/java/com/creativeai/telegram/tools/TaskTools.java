package com.creativeai.telegram.tools;

import com.creativeai.telegram.client.AgentTeamClient;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

/**
 * Outils MCP pour la gestion des tâches.
 * Exposés via le MCP server et disponibles pour le LLM Telegram.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TaskTools {

    private final AgentTeamClient client;

    // ── Inputs (records → schéma JSON automatique via Jackson) ───────────────

    record CreateTaskInput(
        @JsonPropertyDescription("Titre court et descriptif de la tâche") String title,
        @JsonPropertyDescription("Description détaillée : contexte, instructions, données pertinentes") String description,
        @JsonPropertyDescription("Type de tâche. Valeurs : EMAIL_RESPONSE, EMAIL_CLASSIFICATION, EMAIL_FORWARD, SOCIAL_POST, SOCIAL_REPLY, SOCIAL_ANALYTICS, PROSPECT_SEARCH, PROSPECT_QUALIFY, PROSPECT_OUTREACH, CAMPAIGN_CREATE, CONTENT_GENERATE, SEO_OPTIMIZE, TICKET_HANDLE, TICKET_ESCALATE, FAQ_UPDATE, DOCUMENT_INGEST, DOCUMENT_SEARCH, DOCUMENT_SUMMARIZE, CV_CREATE, CV_ANALYZE, CV_OPTIMIZE, IMAGE_GENERATE, IMAGE_EDIT, REPORT_GENERATE, PRESENTATION_CREATE, SOCIAL_CONTENT, DOCUMENT_PDF, SCHEDULED_TASK, TELEGRAM_TASK, GENERAL") String type,
        @JsonPropertyDescription("Priorité : LOW | MEDIUM | HIGH | URGENT | CRITICAL") String priority,
        @JsonPropertyDescription("Résultat attendu par l'utilisateur (optionnel)") String expectedResult
    ) {}

    record ListTasksInput(
        @JsonPropertyDescription("Filtrer par statut : PENDING | IN_PROGRESS | COMPLETED | FAILED | CANCELLED (optionnel, laisser vide pour tout)") String status,
        @JsonPropertyDescription("Nombre maximum de tâches à retourner (défaut : 10, max : 50)") Integer limit
    ) {}

    record GetTaskInput(
        @JsonPropertyDescription("UUID de la tâche") String taskId
    ) {}

    // ── Outils MCP ────────────────────────────────────────────────────────────

    @Tool(description = "Crée une nouvelle tâche. L'assignation de l'agent est automatique — ne jamais demander à l'utilisateur de choisir un agent.")
    public String createTask(CreateTaskInput input) {
        log.info("[TOOL:createTask] userId={} title={}", UserContextHolder.getUserId(), input.title());
        return client.createTask(
            UserContextHolder.getUserId(),
            UserContextHolder.getJwtToken(),
            input.title(),
            input.description(),
            input.type()     != null ? input.type()     : "GENERAL",
            input.priority() != null ? input.priority() : "MEDIUM",
            null,   // assignedAgentId → auto
            input.expectedResult(),
            null, null, null, null, null  // contacts, products, dueDate, scheduledAt, confidential
        );
    }

    @Tool(description = "Liste les tâches de l'utilisateur, avec filtre optionnel par statut.")
    public String listTasks(ListTasksInput input) {
        log.info("[TOOL:listTasks] userId={} status={}", UserContextHolder.getUserId(), input.status());
        int limit = (input.limit() != null && input.limit() > 0) ? Math.min(input.limit(), 50) : 10;
        return client.listTasks(
            UserContextHolder.getUserId(),
            UserContextHolder.getJwtToken(),
            input.status(),
            limit
        );
    }

    @Tool(description = "Récupère le détail et le statut d'une tâche spécifique par son UUID.")
    public String getTask(GetTaskInput input) {
        log.info("[TOOL:getTask] taskId={}", input.taskId());
        return client.getTask(
            UserContextHolder.getUserId(),
            UserContextHolder.getJwtToken(),
            input.taskId()
        );
    }
}
