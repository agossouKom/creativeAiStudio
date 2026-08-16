package com.creativeai.auth.controller;

import com.creativeai.auth.dto.agent.ScheduledTaskRequest;
import com.creativeai.auth.model.ScheduledEmailTask;
import com.creativeai.auth.repository.ScheduledEmailTaskRepository;
import com.creativeai.auth.service.agent.EmailAgentOrchestrator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.Executors;

@Slf4j
@RestController
@RequestMapping("/api/agent/scheduled")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ScheduledTaskController {

    private final ScheduledEmailTaskRepository scheduledRepo;
    private final EmailAgentOrchestrator       orchestrator;

    @GetMapping
    public ResponseEntity<List<ScheduledEmailTask>> list() {
        return ResponseEntity.ok(scheduledRepo.findByUserIdAndDeletedFalse(userId()));
    }

    @PostMapping
    public ResponseEntity<ScheduledEmailTask> create(@RequestBody ScheduledTaskRequest req) {
        LocalDateTime nextRun = computeFirstRun(req);
        ScheduledEmailTask task = ScheduledEmailTask.builder()
            .userId(userId())
            .name(req.name())
            .prompt(req.prompt())
            .cronExpression(req.cronExpression())
            .nextRunAt(nextRun)
            .build();
        return ResponseEntity.ok(scheduledRepo.save(task));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ScheduledEmailTask> toggle(@PathVariable String id,
                                                     @RequestParam boolean active) {
        return scheduledRepo.findByIdAndUserIdAndDeletedFalse(id, userId())
            .map(t -> { t.setActive(active); return ResponseEntity.ok(scheduledRepo.save(t)); })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        scheduledRepo.findByIdAndUserIdAndDeletedFalse(id, userId()).ifPresent(t -> {
            t.setDeleted(true); scheduledRepo.save(t);
        });
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/run")
    public ResponseEntity<Void> runNow(@PathVariable String id) {
        scheduledRepo.findByIdAndUserIdAndDeletedFalse(id, userId()).ifPresent(task ->
            Executors.newVirtualThreadPerTaskExecutor().submit(() -> {
                try {
                    String result = orchestrator.chat(task.getUserId(), task.getPrompt())
                        .filter(c -> !c.equals("[DONE]"))
                        .reduce("", String::concat)
                        .block(Duration.ofMinutes(5));
                    task.setLastRunAt(LocalDateTime.now());
                    task.setLastRunResult(result);
                    task.setRunCount(task.getRunCount() + 1);
                    scheduledRepo.save(task);
                } catch (Exception e) {
                    log.error("Manual run failed: {}", e.getMessage());
                }
            })
        );
        return ResponseEntity.accepted().build();
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private String userId() { return SecurityContextHolder.getContext().getAuthentication().getName(); }

    private LocalDateTime computeFirstRun(ScheduledTaskRequest req) {
        if (req.runAt() != null && !req.runAt().isBlank()) {
            try { return LocalDateTime.parse(req.runAt(), DateTimeFormatter.ISO_DATE_TIME); }
            catch (Exception ignored) {}
        }
        if (req.cronExpression() != null) {
            try { return CronExpression.parse(req.cronExpression()).next(LocalDateTime.now()); }
            catch (Exception ignored) {}
        }
        return LocalDateTime.now().plusMinutes(1);
    }
}
