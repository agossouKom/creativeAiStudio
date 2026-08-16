package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, String> {

    Page<AuditLog>  findByUserIdOrderByTimestampDesc(String userId, Pageable pageable);
    Page<AuditLog>  findByAgentIdOrderByTimestampDesc(String agentId, Pageable pageable);
    List<AuditLog>  findByAgentIdAndTimestampAfterOrderByTimestampDesc(String agentId, LocalDateTime after);
    List<AuditLog>  findByTeamIdAndTimestampAfterOrderByTimestampDesc(String teamId, LocalDateTime after);
    long            countByAgentIdAndSuccessFalseAndTimestampAfter(String agentId, LocalDateTime after);

    /** Historique complet d'une ressource spécifique (ex: tous les changements sur un agent). */
    Page<AuditLog>  findByResourceAndResourceIdOrderByTimestampDesc(
                        String resource, String resourceId, Pageable pageable);

    /** Recherche filtrée sur le journal d'un utilisateur. Tous les paramètres sont optionnels. */
    @Query(
        value = """
            SELECT * FROM audit_logs
            WHERE user_id = :userId
              AND (CAST(:resource AS text)    IS NULL OR resource = CAST(:resource AS text))
              AND (CAST(:action   AS text)    IS NULL OR action   LIKE '%' || CAST(:action AS text) || '%')
              AND (CAST(:success  AS boolean) IS NULL OR success  = CAST(:success AS boolean))
              AND (CAST(:from     AS timestamp) IS NULL OR timestamp >= CAST(:from AS timestamp))
              AND (CAST(:to       AS timestamp) IS NULL OR timestamp <= CAST(:to   AS timestamp))
            ORDER BY timestamp DESC
            """,
        countQuery = """
            SELECT COUNT(*) FROM audit_logs
            WHERE user_id = :userId
              AND (CAST(:resource AS text)    IS NULL OR resource = CAST(:resource AS text))
              AND (CAST(:action   AS text)    IS NULL OR action   LIKE '%' || CAST(:action AS text) || '%')
              AND (CAST(:success  AS boolean) IS NULL OR success  = CAST(:success AS boolean))
              AND (CAST(:from     AS timestamp) IS NULL OR timestamp >= CAST(:from AS timestamp))
              AND (CAST(:to       AS timestamp) IS NULL OR timestamp <= CAST(:to   AS timestamp))
            """,
        nativeQuery = true
    )
    Page<AuditLog> search(
        @Param("userId")   String userId,
        @Param("resource") String resource,
        @Param("action")   String action,
        @Param("success")  Boolean success,
        @Param("from")     LocalDateTime from,
        @Param("to")       LocalDateTime to,
        Pageable pageable
    );

    long countByUserIdAndSuccessFalseAndTimestampAfter(String userId, LocalDateTime after);
}
