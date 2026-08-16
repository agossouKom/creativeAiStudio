package com.creativeai.agentteam.service;

import com.creativeai.agentteam.client.AuthServiceClient;
import com.creativeai.agentteam.dto.request.CreateTaskRequest;
import com.creativeai.agentteam.dto.request.UpdateTaskRequest;
import com.creativeai.agentteam.dto.response.PageResponse;
import com.creativeai.agentteam.dto.response.TaskResponse;
import com.creativeai.agentteam.model.AgentTask;
import com.creativeai.agentteam.model.enums.*;
import com.creativeai.agentteam.repository.AgentTaskRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Service
@RequiredArgsConstructor
public class TaskService {

    private final AgentTaskRepository taskRepo;
    private final AuditService        auditService;
    private final QuotaService        quotaService;
    private final ChannelSenderService channelSender;
    private final InstagramService    instagramService;
    private final AuthServiceClient   authServiceClient;
    private final ObjectMapper        objectMapper;

    @Transactional
    public TaskResponse createTask(String userId, CreateTaskRequest req, String jwt) {
        quotaService.checkTaskQuota(userId);

        // Promotion produit : fetch snapshot depuis auth-service
        String productCodesJson  = null;
        String productSnapshot   = null;
        String platformsJson     = null;
        if (req.type() == TaskType.PRODUCT_PROMOTION
                && req.productCodes() != null && !req.productCodes().isEmpty()) {
            try {
                ArrayNode snapshot = objectMapper.createArrayNode();
                for (String code : req.productCodes()) {
                    authServiceClient.getProductByCode(code, jwt)
                        .ifPresentOrElse(
                            snapshot::add,
                            () -> log.warn("[TASK] Produit code={} introuvable, ignoré", code)
                        );
                }
                productCodesJson = objectMapper.writeValueAsString(req.productCodes());
                productSnapshot  = objectMapper.writeValueAsString(snapshot);
            } catch (Exception e) {
                log.error("[TASK] Erreur build snapshot produits: {}", e.getMessage());
            }
        }
        if (req.platforms() != null && !req.platforms().isEmpty()) {
            try { platformsJson = objectMapper.writeValueAsString(req.platforms()); }
            catch (Exception e) { log.warn("[TASK] Erreur sérialisation platforms"); }
        }

        AgentTask task = AgentTask.builder()
            .code(generateUniqueTaskCode())
            .title(req.title()).description(req.description())
            .type(req.type()     != null ? req.type()     : TaskType.GENERAL)
            .status(TaskStatus.PENDING)
            .priority(req.priority() != null ? req.priority() : Priority.MEDIUM)
            .source(req.scheduledAt() != null
                ? TaskSource.SCHEDULED
                : (req.source() != null ? req.source() : TaskSource.MANUAL))
            .userId(userId).teamId(req.teamId())
            .assignedAgentId(req.assignedAgentId())
            .parentTaskId(req.parentTaskId())
            .payload(req.payload()).dueDate(req.dueDate())
            .scheduledAt(req.scheduledAt())
            .contacts(req.contacts())
            .expectedResult(req.expectedResult())
            .confidential(req.confidential() != null && req.confidential())
            .agentGenerated(false)
            // Promotion produit
            .productCodes(productCodesJson)
            .productSnapshot(productSnapshot)
            .platforms(platformsJson)
            .hashtags(req.hashtags())
            .tone(req.tone())
            .campaignObjective(req.campaignObjective())
            .build();
        task = taskRepo.save(task);
        auditService.log(userId, "CREATE_TASK", "task", task.getId(), true,
            AuditService.details("title", task.getTitle(), "type", task.getType(),
                "priority", task.getPriority(), "assignedAgentId", req.assignedAgentId()));
        quotaService.incrementTaskUsage(userId);
        return TaskResponse.from(task);
    }

    @Transactional(readOnly = true)
    public TaskResponse getTask(String userId, String taskId) {
        return TaskResponse.from(
            taskRepo.findByIdAndUserIdAndDeletedFalse(taskId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Tâche non trouvée: " + taskId)));
    }

    @Transactional(readOnly = true)
    public TaskResponse getTaskByCode(String userId, String code) {
        return TaskResponse.from(
            taskRepo.findByCodeAndUserIdAndDeletedFalse(code, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Tâche non trouvée avec le code: " + code)));
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> listTasks(String userId) {
        return taskRepo.findByUserIdAndDeletedFalseOrderByCreatedAtDesc(userId)
            .stream().map(TaskResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> listDeletedTasks(String userId) {
        return taskRepo.findByUserIdAndDeletedTrueOrderByUpdatedAtDesc(userId)
            .stream().map(TaskResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> listTasksByStatus(String userId, TaskStatus status) {
        return taskRepo.findByUserIdAndStatusAndDeletedFalse(userId, status)
            .stream().map(TaskResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<TaskResponse> listTasksPaged(String userId, Pageable pageable) {
        return PageResponse.from(taskRepo.findByUserIdAndDeletedFalse(userId, pageable), TaskResponse::from);
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> listOverdueTasks(String userId) {
        return taskRepo.findOverdueTasks(userId, LocalDateTime.now())
            .stream().map(TaskResponse::from).toList();
    }

    @Transactional
    public TaskResponse updateTask(String userId, String taskId, UpdateTaskRequest req) {
        AgentTask task = taskRepo.findByIdAndUserIdAndDeletedFalse(taskId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Tâche non trouvée: " + taskId));

        if (req.title()           != null) task.setTitle(req.title());
        if (req.description()     != null) task.setDescription(req.description());
        if (req.priority()        != null) task.setPriority(req.priority());
        if (req.assignedAgentId() != null) task.setAssignedAgentId(req.assignedAgentId());
        if (req.dueDate()         != null) task.setDueDate(req.dueDate());
        if (req.status()          != null) applyStatusTransition(task, req.status());

        auditService.log(userId, "UPDATE_TASK", "task", taskId, true,
            AuditService.details("title", task.getTitle(), "status", task.getStatus()));
        return TaskResponse.from(taskRepo.save(task));
    }

    @Transactional
    public TaskResponse updateStatus(String userId, String taskId, TaskStatus newStatus) {
        AgentTask task = taskRepo.findByIdAndUserIdAndDeletedFalse(taskId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Tâche non trouvée: " + taskId));
        TaskStatus oldStatus = task.getStatus();
        applyStatusTransition(task, newStatus);
        auditService.log(userId, "UPDATE_TASK_STATUS", "task", taskId, true,
            AuditService.details("title", task.getTitle(), "from", oldStatus, "to", newStatus));
        return TaskResponse.from(taskRepo.save(task));
    }

    @Transactional
    public void deleteTask(String userId, String taskId) {
        AgentTask task = taskRepo.findByIdAndUserIdAndDeletedFalse(taskId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Tâche non trouvée: " + taskId));

        // Suppression cascade des publications sociales associées
        deleteSocialPosts(task);

        task.setDeleted(true);
        taskRepo.save(task);
        auditService.log(userId, "DELETE_TASK", "task", taskId, true,
            AuditService.details("title", task.getTitle(), "softDelete", true));
    }

    private void deleteSocialPosts(AgentTask task) {
        if (task.getSocialPostIds() == null || task.getSocialPostIds().isBlank()) return;
        if (task.getAssignedAgentId() == null) return;
        try {
            java.util.Map<?, ?> postIds = objectMapper.readValue(task.getSocialPostIds(), java.util.Map.class);
            postIds.forEach((platform, postId) -> {
                if (postId == null) return;
                String platformStr = String.valueOf(platform);
                String postIdStr   = String.valueOf(postId);
                try {
                    switch (platformStr) {
                        case "FACEBOOK" -> {
                            ChannelSenderService.SendResult result =
                                channelSender.deleteFacebookPost(task.getAssignedAgentId(), postIdStr);
                            log.info("[DELETE_TASK] Cascade FB post={} task={} ok={}", postIdStr, task.getId(), result.success());
                        }
                        case "INSTAGRAM" -> {
                            boolean ok = instagramService.deleteMedia(task.getAssignedAgentId(), postIdStr);
                            log.info("[DELETE_TASK] Cascade IG media={} task={} ok={}", postIdStr, task.getId(), ok);
                        }
                        default -> log.debug("[DELETE_TASK] No cascade delete impl for platform={}", platformStr);
                    }
                } catch (Exception e) {
                    log.warn("[DELETE_TASK] Could not delete social post platform={} postId={}: {}", platformStr, postIdStr, e.getMessage());
                }
            });
        } catch (Exception e) {
            log.warn("[DELETE_TASK] Could not parse socialPostIds for task {}: {}", task.getId(), e.getMessage());
        }
    }

    @Transactional
    public TaskResponse restoreTask(String userId, String taskId) {
        AgentTask task = taskRepo.findByIdAndUserIdAndDeletedTrue(taskId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Tâche supprimée introuvable: " + taskId));
        task.setDeleted(false);
        task = taskRepo.save(task);
        auditService.log(userId, "RESTORE_TASK", "task", taskId, true,
            AuditService.details("title", task.getTitle()));
        return TaskResponse.from(task);
    }

    private String generateUniqueTaskCode() {
        String code;
        do {
            code = String.format("%06d", ThreadLocalRandom.current().nextInt(100000, 1000000));
        } while (taskRepo.findByCodeAndDeletedFalse(code).isPresent());
        return code;
    }

    private void applyStatusTransition(AgentTask task, TaskStatus newStatus) {
        task.setStatus(newStatus);
        switch (newStatus) {
            case IN_PROGRESS -> { if (task.getStartedAt() == null) task.setStartedAt(LocalDateTime.now()); }
            case DONE        -> task.setCompletedAt(LocalDateTime.now());
            default          -> {}
        }
    }
}
