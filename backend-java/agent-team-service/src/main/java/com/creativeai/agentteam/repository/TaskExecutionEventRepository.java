package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.TaskExecutionEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface TaskExecutionEventRepository extends JpaRepository<TaskExecutionEvent, UUID> {

    List<TaskExecutionEvent> findByTaskIdOrderByCreatedAtAsc(String taskId);

    List<TaskExecutionEvent> findByUserIdAndCreatedAtAfterOrderByCreatedAtDesc(
        String userId, LocalDateTime after);

    List<TaskExecutionEvent> findByAgentIdAndEventTypeOrderByCreatedAtDesc(
        String agentId, String eventType);

    /** Nombre d'emails envoyés par agent sur une période */
    @Query("SELECT COUNT(e) FROM TaskExecutionEvent e " +
           "WHERE e.agentId = :agentId AND e.eventType = 'EMAIL_SENT' " +
           "AND e.createdAt >= :from")
    long countEmailsSentByAgentSince(@Param("agentId") String agentId,
                                     @Param("from") LocalDateTime from);

    /** Tous les événements d'une tâche pour le dashboard patron */
    @Query("SELECT e FROM TaskExecutionEvent e WHERE e.taskId IN :taskIds " +
           "ORDER BY e.createdAt ASC")
    List<TaskExecutionEvent> findByTaskIdIn(@Param("taskIds") List<String> taskIds);

    // ── Analytics ─────────────────────────────────────────────────────────────

    /** Emails envoyés par un utilisateur depuis une date. */
    @Query("SELECT COUNT(e) FROM TaskExecutionEvent e " +
           "WHERE e.userId = :userId AND e.eventType = 'EMAIL_SENT' AND e.createdAt >= :from")
    long countEmailsSentByUserSince(@Param("userId") String userId,
                                    @Param("from") LocalDateTime from);

    /** Posts sociaux publiés par un utilisateur depuis une date. */
    @Query("SELECT COUNT(e) FROM TaskExecutionEvent e " +
           "WHERE e.userId = :userId AND e.eventType = 'SOCIAL_POSTED' AND e.createdAt >= :from")
    long countSocialPostsByUserSince(@Param("userId") String userId,
                                     @Param("from") LocalDateTime from);

    /** Délégations effectuées par un utilisateur depuis une date. */
    @Query("SELECT COUNT(e) FROM TaskExecutionEvent e " +
           "WHERE e.userId = :userId AND e.eventType = 'DELEGATION' AND e.createdAt >= :from")
    long countDelegationsByUserSince(@Param("userId") String userId,
                                     @Param("from") LocalDateTime from);

    /** Top outils utilisés — retourne [toolName, count] trié par count DESC. */
    @Query("SELECT e.toolName, COUNT(e) FROM TaskExecutionEvent e " +
           "WHERE e.userId = :userId AND e.eventType = 'TOOL_CALLED' " +
           "AND e.toolName IS NOT NULL AND e.createdAt >= :from " +
           "GROUP BY e.toolName ORDER BY COUNT(e) DESC")
    List<Object[]> countToolUsageByUserSince(@Param("userId") String userId,
                                              @Param("from") LocalDateTime from);

    /** Emails par agent pour le dashboard agentBreakdown. */
    @Query("SELECT e.agentId, COUNT(e) FROM TaskExecutionEvent e " +
           "WHERE e.userId = :userId AND e.eventType = 'EMAIL_SENT' AND e.createdAt >= :from " +
           "GROUP BY e.agentId")
    List<Object[]> countEmailsByAgentSince(@Param("userId") String userId,
                                            @Param("from") LocalDateTime from);

    /** Posts sociaux par agent. */
    @Query("SELECT e.agentId, COUNT(e) FROM TaskExecutionEvent e " +
           "WHERE e.userId = :userId AND e.eventType = 'SOCIAL_POSTED' AND e.createdAt >= :from " +
           "GROUP BY e.agentId")
    List<Object[]> countSocialPostsByAgentSince(@Param("userId") String userId,
                                                 @Param("from") LocalDateTime from);
}
