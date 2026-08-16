package com.creativeai.agentteam.service;

import com.creativeai.agentteam.dto.response.AnalyticsDashboardResponse;
import com.creativeai.agentteam.dto.response.AnalyticsDashboardResponse.AgentStats;
import com.creativeai.agentteam.dto.response.AnalyticsDashboardResponse.ToolUsage;
import com.creativeai.agentteam.model.TaskExecutionEvent;
import com.creativeai.agentteam.model.enums.TaskStatus;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.AgentTaskRepository;
import com.creativeai.agentteam.repository.TaskExecutionEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnalyticsService {

    /** Minutes économisées par tâche complétée (heuristique). */
    private static final double MINUTES_SAVED_PER_TASK = 30.0;
    /** Nombre de résultats dans le top outils. */
    private static final int TOP_TOOLS_LIMIT = 10;

    private final AgentTaskRepository     taskRepo;
    private final TaskExecutionEventRepository eventRepo;
    private final AgentRepository         agentRepo;

    /**
     * Agrège les statistiques sur les derniers {@code days} jours pour l'utilisateur.
     */
    public AnalyticsDashboardResponse getDashboard(String userId, int days) {
        LocalDateTime from = LocalDateTime.now().minusDays(days);
        LocalDate fromDate = LocalDate.now().minusDays(days);

        // ── 1. Tâches par agent et par statut ────────────────────────────────
        List<Object[]> taskRows = taskRepo.countTasksByAgentAndStatus(userId, from);

        // Accumulation : agentId → { status → count }
        Map<String, Map<TaskStatus, Long>> tasksByAgent = new HashMap<>();
        long totalTasks = 0, completedTasks = 0, failedTasks = 0, pendingTasks = 0;

        for (Object[] row : taskRows) {
            String agentId  = (String) row[0];
            TaskStatus stat = (TaskStatus) row[1];
            long count      = ((Number) row[2]).longValue();

            tasksByAgent.computeIfAbsent(agentId != null ? agentId : "__unassigned__",
                k -> new HashMap<>()).merge(stat, count, Long::sum);

            totalTasks += count;
            if (stat == TaskStatus.DONE)      completedTasks += count;
            else if (stat == TaskStatus.FAILED) failedTasks   += count;
            else if (stat == TaskStatus.PENDING || stat == TaskStatus.IN_PROGRESS) pendingTasks += count;
        }

        double globalSuccessRate = completedTasks + failedTasks == 0 ? 0.0
            : (double) completedTasks / (completedTasks + failedTasks) * 100.0;

        // ── 2. Durée moyenne de complétion ────────────────────────────────────
        Double avgSeconds = taskRepo.avgCompletionSeconds(userId, from);
        double avgCompletionMinutes = avgSeconds != null ? avgSeconds / 60.0 : 0.0;

        // ── 3. Heures économisées ─────────────────────────────────────────────
        double estimatedHoursSaved = (completedTasks * MINUTES_SAVED_PER_TASK) / 60.0;

        // ── 4. Actions concrètes (emails, social, délégations) ────────────────
        long emailsSent  = eventRepo.countEmailsSentByUserSince(userId, from);
        long socialPosts = eventRepo.countSocialPostsByUserSince(userId, from);
        long delegations = eventRepo.countDelegationsByUserSince(userId, from);

        // ── 5. Emails et posts par agent ──────────────────────────────────────
        Map<String, Long> emailsByAgent = toMap(eventRepo.countEmailsByAgentSince(userId, from));
        Map<String, Long> socialByAgent = toMap(eventRepo.countSocialPostsByAgentSince(userId, from));

        // ── 6. Résolution des noms d'agents ──────────────────────────────────
        Set<String> agentIds = new HashSet<>(tasksByAgent.keySet());
        agentIds.remove("__unassigned__");
        Map<String, String> agentNames = agentRepo.findAllById(agentIds).stream()
            .collect(Collectors.toMap(a -> a.getId(), a -> a.getName()));

        // ── 7. Décomposition par agent ────────────────────────────────────────
        List<AgentStats> agentBreakdown = tasksByAgent.entrySet().stream()
            .filter(e -> !"__unassigned__".equals(e.getKey()))
            .map(e -> {
                String aid = e.getKey();
                Map<TaskStatus, Long> counts = e.getValue();
                long done    = counts.getOrDefault(TaskStatus.DONE, 0L);
                long failed  = counts.getOrDefault(TaskStatus.FAILED, 0L);
                long pending = counts.getOrDefault(TaskStatus.PENDING, 0L)
                             + counts.getOrDefault(TaskStatus.IN_PROGRESS, 0L);
                double rate  = done + failed == 0 ? 0.0 : (double) done / (done + failed) * 100.0;
                return new AgentStats(
                    aid,
                    agentNames.getOrDefault(aid, "Agent inconnu"),
                    done, failed, pending, rate,
                    emailsByAgent.getOrDefault(aid, 0L),
                    socialByAgent.getOrDefault(aid, 0L)
                );
            })
            .sorted(Comparator.comparingLong(AgentStats::tasksCompleted).reversed())
            .toList();

        // ── 8. Top outils ─────────────────────────────────────────────────────
        List<ToolUsage> topTools = eventRepo.countToolUsageByUserSince(userId, from).stream()
            .limit(TOP_TOOLS_LIMIT)
            .map(r -> new ToolUsage((String) r[0], ((Number) r[1]).longValue()))
            .toList();

        return new AnalyticsDashboardResponse(
            fromDate, LocalDate.now(),
            totalTasks, completedTasks, failedTasks, pendingTasks,
            round(globalSuccessRate), round(avgCompletionMinutes), round(estimatedHoursSaved),
            emailsSent, socialPosts, delegations,
            agentBreakdown, topTools
        );
    }

    /**
     * Timeline des événements d'une tâche (pour le drill-down patron).
     */
    public List<TaskExecutionEvent> getTaskTimeline(String taskId) {
        return eventRepo.findByTaskIdOrderByCreatedAtAsc(taskId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static Map<String, Long> toMap(List<Object[]> rows) {
        Map<String, Long> m = new HashMap<>();
        for (Object[] r : rows) {
            if (r[0] != null) m.put((String) r[0], ((Number) r[1]).longValue());
        }
        return m;
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
