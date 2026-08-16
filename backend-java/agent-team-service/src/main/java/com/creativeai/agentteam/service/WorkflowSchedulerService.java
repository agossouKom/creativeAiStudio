package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.Workflow;
import com.creativeai.agentteam.model.WorkflowStep;
import com.creativeai.agentteam.model.enums.ActionType;
import com.creativeai.agentteam.model.enums.AgentStatus;
import com.creativeai.agentteam.model.enums.WorkflowStatus;
import com.creativeai.agentteam.orchestrator.AgentOrchestrator;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.WorkflowRepository;
import com.creativeai.agentteam.repository.WorkflowStepRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;

/**
 * Exécution automatique des workflows planifiés et du point journalier.
 *
 * - Toutes les minutes : déclenche les workflows ACTIVE dont nextRunAt est dépassé
 * - Tous les jours à l'heure configurée : envoie un briefing journalier à chaque agent ACTIVE
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "agent.workflow-scheduler-enabled", matchIfMissing = true)
public class WorkflowSchedulerService {

    private final WorkflowRepository     workflowRepo;
    private final WorkflowStepRepository stepRepo;
    private final AgentRepository        agentRepo;
    private final AgentOrchestrator      orchestrator;
    private final ObjectMapper           objectMapper;

    @Value("${agent.daily-briefing-cron:0 0 9 * * *}")
    private String dailyBriefingCron;

    // ── Workflow scheduler — toutes les minutes ───────────────────────────────

    @Scheduled(cron = "0 * * * * *")
    @Transactional
    public void processScheduledWorkflows() {
        List<Workflow> due = workflowRepo.findByStatusAndNextRunAtBeforeAndDeletedFalse(
                WorkflowStatus.ACTIVE, LocalDateTime.now());

        if (due.isEmpty()) return;

        log.info("[SCHEDULER] {} workflow(s) à exécuter", due.size());

        for (Workflow wf : due) {
            try {
                executeWorkflow(wf);
            } catch (Exception e) {
                log.error("[SCHEDULER] Erreur workflow id={} name='{}': {}", wf.getId(), wf.getName(), e.getMessage(), e);
                markFailed(wf, e.getMessage());
            }
        }
    }

    // ── Daily briefing ────────────────────────────────────────────────────────

    @Scheduled(cron = "${agent.daily-briefing-cron:0 0 9 * * *}")
    public void sendDailyBriefing() {
        List<Agent> activeAgents = agentRepo.findByStatusAndDeletedFalse(AgentStatus.ACTIVE);
        log.info("[SCHEDULER] Point journalier : {} agent(s) ACTIVE", activeAgents.size());

        for (Agent agent : activeAgents) {
            try {
                String prompt = buildDailyBriefingPrompt(agent);
                String sessionId = "daily-" + LocalDateTime.now().toLocalDate() + "-" + agent.getId();

                orchestrator.chat(agent.getId(), agent.getOwnerId(), prompt, sessionId, null)
                    .subscribe(
                        token -> {},
                        err   -> log.warn("[SCHEDULER] Briefing error agent={}: {}", agent.getId(), err.getMessage()),
                        ()    -> log.debug("[SCHEDULER] Briefing terminé pour agent={}", agent.getId())
                    );
            } catch (Exception e) {
                log.warn("[SCHEDULER] Impossible de démarrer le briefing pour agent={}: {}", agent.getId(), e.getMessage());
            }
        }
    }

    // ── Exécution d'un workflow ───────────────────────────────────────────────

    private void executeWorkflow(Workflow wf) {
        log.info("[SCHEDULER] Démarrage workflow id={} name='{}'", wf.getId(), wf.getName());

        wf.setStatus(WorkflowStatus.RUNNING);
        workflowRepo.save(wf);

        List<WorkflowStep> steps = stepRepo.findByWorkflowIdAndDeletedFalseOrderByStepOrderAsc(wf.getId());
        StringBuilder executionLog = new StringBuilder();
        boolean hasError = false;

        for (WorkflowStep step : steps) {
            try {
                String result = executeStep(wf, step);
                executionLog.append("[").append(step.getName()).append("] ✓ ").append(summarize(result)).append("\n");
            } catch (Exception e) {
                executionLog.append("[").append(step.getName()).append("] ✗ ").append(e.getMessage()).append("\n");
                log.warn("[SCHEDULER] Étape '{}' échouée dans workflow '{}': {}", step.getName(), wf.getName(), e.getMessage());
                hasError = true;
                if (step.getOnFailureStepId() == null) break;
            }
        }

        // Mise à jour des métriques
        wf.setLastRunAt(LocalDateTime.now());
        wf.setRunCount(wf.getRunCount() + 1);
        wf.setCurrentStepIndex(0);

        if (hasError) {
            wf.setLastError(executionLog.toString());
        } else {
            wf.setLastError(null);
        }

        // Calcul du prochain déclenchement si cron configuré
        wf.setNextRunAt(computeNextRun(wf.getCronExpression()));

        // Remettre en ACTIVE (pas FAILED — c'est un workflow récurrent)
        wf.setStatus(WorkflowStatus.ACTIVE);
        workflowRepo.save(wf);

        log.info("[SCHEDULER] Workflow '{}' terminé — prochaine exécution : {}", wf.getName(), wf.getNextRunAt());
    }

    private String executeStep(Workflow wf, WorkflowStep step) {
        String agentId = step.getAgentId();
        String ownerId = wf.getOwnerId();

        if (step.getActionType() == ActionType.CHAT || step.getActionType() == ActionType.GENERATE) {
            String prompt = extractPromptFromConfig(step.getConfig(), step.getName());
            String sessionId = "wf-" + wf.getId() + "-run-" + wf.getRunCount();

            StringBuilder[] result = {new StringBuilder()};
            orchestrator.chat(agentId, ownerId, prompt, sessionId, null)
                .filter(token -> !token.startsWith("[") || !token.endsWith("]"))
                .subscribe(result[0]::append);

            return result[0].toString();
        }

        log.info("[SCHEDULER] Étape '{}' type={} — stub (pas encore branché)", step.getName(), step.getActionType());
        return "ok";
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String extractPromptFromConfig(String configJson, String fallbackName) {
        if (configJson == null || configJson.isBlank()) return "Exécute ta tâche : " + fallbackName;
        try {
            JsonNode node = objectMapper.readTree(configJson);
            if (node.has("prompt")) return node.get("prompt").asText();
            if (node.has("message")) return node.get("message").asText();
        } catch (Exception ignored) {}
        return "Exécute ta tâche : " + fallbackName;
    }

    private String buildDailyBriefingPrompt(Agent agent) {
        return String.format(
            """
            [POINT JOURNALIER AUTOMATIQUE]
            Bonjour %s. Il est temps de faire ton point journalier.
            Résume les actions importantes d'hier, liste tes priorités pour aujourd'hui, \
            et signale tout point d'attention particulier.
            Sois concis et structuré.
            """,
            agent.getName() != null ? agent.getName() : "agent"
        );
    }

    private LocalDateTime computeNextRun(String cronExpression) {
        if (cronExpression == null || cronExpression.isBlank()) return null;
        try {
            CronExpression cron    = CronExpression.parse(cronExpression);
            ZonedDateTime  now     = ZonedDateTime.now(ZoneOffset.UTC);
            ZonedDateTime  next    = cron.next(now);
            return (next != null) ? next.toLocalDateTime() : null;
        } catch (Exception e) {
            log.warn("[SCHEDULER] Expression cron invalide '{}': {}", cronExpression, e.getMessage());
            return null;
        }
    }

    private void markFailed(Workflow wf, String error) {
        try {
            wf.setLastRunAt(LocalDateTime.now());
            wf.setLastError(error);
            wf.setNextRunAt(computeNextRun(wf.getCronExpression()));
            wf.setStatus(WorkflowStatus.ACTIVE);
            workflowRepo.save(wf);
        } catch (Exception e2) {
            log.error("[SCHEDULER] Impossible de sauvegarder l'état d'erreur du workflow {}: {}", wf.getId(), e2.getMessage());
        }
    }

    private String summarize(String text) {
        if (text == null) return "";
        return text.length() > 100 ? text.substring(0, 100) + "…" : text;
    }
}
