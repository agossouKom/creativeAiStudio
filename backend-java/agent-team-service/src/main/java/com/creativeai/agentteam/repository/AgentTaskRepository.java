package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.AgentTask;
import com.creativeai.agentteam.model.enums.Priority;
import com.creativeai.agentteam.model.enums.TaskStatus;
import com.creativeai.agentteam.model.enums.TaskType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AgentTaskRepository extends JpaRepository<AgentTask, String> {
    Optional<AgentTask>  findByIdAndDeletedFalse(String id);
    Optional<AgentTask>  findByCodeAndUserIdAndDeletedFalse(String code, String userId);
    Optional<AgentTask>  findByCodeAndDeletedFalse(String code);
    Optional<AgentTask>  findByIdAndUserIdAndDeletedFalse(String id, String userId);
    List<AgentTask>      findByUserIdAndDeletedFalseOrderByCreatedAtDesc(String userId);
    List<AgentTask>      findByUserIdAndStatusAndDeletedFalse(String userId, TaskStatus status);
    List<AgentTask>      findByUserIdAndPriorityAndDeletedFalse(String userId, Priority priority);
    List<AgentTask>      findByAssignedAgentIdAndStatusAndDeletedFalse(String agentId, TaskStatus status);
    List<AgentTask>      findByTeamIdAndStatusAndDeletedFalse(String teamId, TaskStatus status);
    List<AgentTask>      findByWorkflowIdAndDeletedFalse(String workflowId);
    List<AgentTask>      findByParentTaskIdAndDeletedFalse(String parentId);
    Page<AgentTask>      findByUserIdAndDeletedFalse(String userId, Pageable pageable);
    long                 countByUserIdAndStatusAndDeletedFalse(String userId, TaskStatus status);
    long                 countByAssignedAgentIdAndStatusAndDeletedFalse(String agentId, TaskStatus status);

    @Query("SELECT t FROM AgentTask t WHERE t.userId = :userId AND t.deleted = false " +
           "AND t.dueDate < :now AND t.status NOT IN (com.creativeai.agentteam.model.enums.TaskStatus.DONE, " +
           "com.creativeai.agentteam.model.enums.TaskStatus.CANCELLED)")
    List<AgentTask> findOverdueTasks(String userId, LocalDateTime now);

    @Query("SELECT t FROM AgentTask t WHERE t.deleted = false " +
           "AND t.source = com.creativeai.agentteam.model.enums.TaskSource.SCHEDULED " +
           "AND t.status = com.creativeai.agentteam.model.enums.TaskStatus.PENDING " +
           "AND t.scheduledAt IS NOT NULL AND t.scheduledAt <= :now")
    List<AgentTask> findDueScheduledTasks(LocalDateTime now);

    @Query("SELECT t FROM AgentTask t WHERE t.deleted = false " +
           "AND t.source = com.creativeai.agentteam.model.enums.TaskSource.SOCIAL_MEDIA " +
           "AND t.status = com.creativeai.agentteam.model.enums.TaskStatus.PENDING " +
           "AND t.assignedAgentId IS NOT NULL")
    List<AgentTask> findPendingSocialMediaTasks();

    // Soft-delete / restore
    List<AgentTask>     findByUserIdAndDeletedTrueOrderByUpdatedAtDesc(String userId);
    Optional<AgentTask> findByIdAndUserIdAndDeletedTrue(String id, String userId);

    // ── Analytics ─────────────────────────────────────────────────────────────

    /** Nombre de tâches par agent et par statut sur une période. */
    @Query("SELECT t.assignedAgentId, t.status, COUNT(t) FROM AgentTask t " +
           "WHERE t.userId = :userId AND t.deleted = false AND t.createdAt >= :from " +
           "GROUP BY t.assignedAgentId, t.status")
    List<Object[]> countTasksByAgentAndStatus(
        @Param("userId") String userId,
        @Param("from") LocalDateTime from);

    /** Durée moyenne de traitement (secondes) pour les tâches terminées. */
    @Query(value = "SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) " +
                   "FROM agent_tasks " +
                   "WHERE user_id = :userId AND status = 'DONE' " +
                   "AND started_at IS NOT NULL AND completed_at IS NOT NULL " +
                   "AND deleted = false AND created_at >= :from",
           nativeQuery = true)
    Double avgCompletionSeconds(
        @Param("userId") String userId,
        @Param("from") LocalDateTime from);
}
