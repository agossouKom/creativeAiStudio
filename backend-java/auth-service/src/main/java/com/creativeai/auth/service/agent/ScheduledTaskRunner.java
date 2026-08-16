package com.creativeai.auth.service.agent;

import com.creativeai.auth.model.ScheduledEmailTask;
import com.creativeai.auth.repository.ScheduledEmailTaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class ScheduledTaskRunner {

    private final ScheduledEmailTaskRepository scheduledRepo;
    private final EmailAgentOrchestrator       orchestrator;

    @Scheduled(fixedDelay = 60_000) // every minute
    public void runPendingTasks() {
        List<ScheduledEmailTask> pending =
            scheduledRepo.findByActiveTrueAndDeletedFalseAndNextRunAtBefore(LocalDateTime.now());

        for (ScheduledEmailTask task : pending) {
            log.info("[SCHEDULER] Running task='{}' userId={}", task.getName(), task.getUserId());
            try {
                String result = orchestrator.chat(task.getUserId(), task.getPrompt())
                    .filter(c -> !c.equals("[DONE]"))
                    .reduce("", String::concat)
                    .block(Duration.ofMinutes(5));

                task.setLastRunAt(LocalDateTime.now());
                task.setLastRunResult(result);
                task.setRunCount(task.getRunCount() + 1);

                if (task.getCronExpression() != null && !task.getCronExpression().isBlank()) {
                    task.setNextRunAt(computeNextRun(task.getCronExpression()));
                } else {
                    task.setActive(false); // one-shot: deactivate after run
                }
                scheduledRepo.save(task);
                log.info("[SCHEDULER] Task='{}' done. Result length={}", task.getName(),
                         result != null ? result.length() : 0);
            } catch (Exception e) {
                log.error("[SCHEDULER] Task='{}' failed: {}", task.getName(), e.getMessage());
            }
        }
    }

    private LocalDateTime computeNextRun(String cron) {
        try {
            return CronExpression.parse(cron).next(LocalDateTime.now());
        } catch (Exception e) {
            log.warn("Invalid cron '{}': {}", cron, e.getMessage());
            return LocalDateTime.now().plusDays(1);
        }
    }
}
