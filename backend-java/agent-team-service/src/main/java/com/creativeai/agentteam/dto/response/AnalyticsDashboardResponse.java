package com.creativeai.agentteam.dto.response;

import java.time.LocalDate;
import java.util.List;

/**
 * Réponse agrégée du tableau de bord analytics — destinée au "patron".
 *
 * Couvre la période [from, to] et expose :
 *  - indicateurs globaux de tâches
 *  - performance par agent
 *  - actions réalisées (emails, posts sociaux)
 *  - outils les plus utilisés
 *  - estimation du temps économisé (heuristique : 30 min/tâche complétée)
 */
public record AnalyticsDashboardResponse(

    LocalDate from,
    LocalDate to,

    // ── Indicateurs globaux ───────────────────────────────────────────────────
    long totalTasks,
    long completedTasks,
    long failedTasks,
    long pendingTasks,
    double globalSuccessRate,

    /** Durée moyenne de traitement d'une tâche (minutes). */
    double avgCompletionMinutes,

    /** Heures estimées économisées (30 min × tâches complétées). */
    double estimatedHoursSaved,

    // ── Actions concrètes ─────────────────────────────────────────────────────
    long emailsSent,
    long socialPosts,
    long delegations,

    // ── Décomposition par agent ───────────────────────────────────────────────
    List<AgentStats> agentBreakdown,

    // ── Outils les plus utilisés ──────────────────────────────────────────────
    List<ToolUsage> topTools

) {
    /** Stats d'un agent individuel sur la période. */
    public record AgentStats(
        String agentId,
        String agentName,
        long tasksCompleted,
        long tasksFailed,
        long tasksPending,
        double successRate,
        long emailsSent,
        long socialPosts
    ) {}

    /** Utilisation d'un outil sur la période. */
    public record ToolUsage(
        String toolName,
        long count
    ) {}
}
