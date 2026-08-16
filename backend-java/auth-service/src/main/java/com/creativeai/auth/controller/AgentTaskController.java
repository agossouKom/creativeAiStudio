package com.creativeai.auth.controller;

import com.creativeai.auth.dto.agent.AgentTaskRequest;
import com.creativeai.auth.dto.agent.AgentTaskResponse;
import com.creativeai.auth.model.AgentTask;
import com.creativeai.auth.model.enums.TaskPriority;
import com.creativeai.auth.model.enums.TaskStatus;
import com.creativeai.auth.repository.AgentTaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@RestController
@RequestMapping("/api/agent/tasks")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AgentTaskController {

    private final AgentTaskRepository taskRepo;

    @GetMapping
    public ResponseEntity<List<AgentTaskResponse>> list(
            @RequestParam(required = false) String status) {
        String userId = userId();
        List<AgentTask> tasks = status != null
            ? taskRepo.findByUserIdAndStatusAndDeletedFalse(userId, TaskStatus.valueOf(status.toUpperCase()))
            : taskRepo.findByUserIdAndDeletedFalseOrderByCreatedAtDesc(userId);
        return ResponseEntity.ok(tasks.stream().map(this::toDto).toList());
    }

    @PostMapping
    public ResponseEntity<AgentTaskResponse> create(@RequestBody AgentTaskRequest req) {
        AgentTask task = AgentTask.builder()
            .userId(userId())
            .title(req.title())
            .description(req.description())
            .priority(parsePriority(req.priority()))
            .dueDate(parseDate(req.dueDate()))
            .sourceEmailId(req.sourceEmailId())
            .build();
        return ResponseEntity.ok(toDto(taskRepo.save(task)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AgentTaskResponse> update(@PathVariable String id, @RequestBody AgentTaskRequest req) {
        return taskRepo.findByIdAndUserIdAndDeletedFalse(id, userId())
            .map(task -> {
                if (req.title()       != null) task.setTitle(req.title());
                if (req.description() != null) task.setDescription(req.description());
                if (req.priority()    != null) task.setPriority(parsePriority(req.priority()));
                if (req.dueDate()     != null) task.setDueDate(parseDate(req.dueDate()));
                return ResponseEntity.ok(toDto(taskRepo.save(task)));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<AgentTaskResponse> updateStatus(@PathVariable String id, @RequestParam String status) {
        return taskRepo.findByIdAndUserIdAndDeletedFalse(id, userId())
            .map(task -> {
                TaskStatus s = TaskStatus.valueOf(status.toUpperCase());
                task.setStatus(s);
                if (s == TaskStatus.DONE) task.setCompletedAt(LocalDateTime.now());
                return ResponseEntity.ok(toDto(taskRepo.save(task)));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        taskRepo.findByIdAndUserIdAndDeletedFalse(id, userId()).ifPresent(t -> {
            t.setDeleted(true);
            taskRepo.save(t);
        });
        return ResponseEntity.noContent().build();
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private String userId() { return SecurityContextHolder.getContext().getAuthentication().getName(); }

    private AgentTaskResponse toDto(AgentTask t) {
        return new AgentTaskResponse(t.getId(), t.getTitle(), t.getDescription(),
            t.getStatus().name(), t.getPriority().name(), t.getDueDate(),
            t.isAgentGenerated(), t.getCreatedAt(), t.getCompletedAt());
    }

    private TaskPriority parsePriority(String p) {
        try { return TaskPriority.valueOf(p.toUpperCase()); } catch (Exception e) { return TaskPriority.MEDIUM; }
    }

    private LocalDateTime parseDate(String d) {
        if (d == null || d.isBlank()) return null;
        try { return LocalDateTime.parse(d, DateTimeFormatter.ISO_DATE_TIME); } catch (Exception e) { return null; }
    }
}
