package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.AuditLog;
import com.creativeai.agentteam.repository.AuditLogRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Service d'audit.
 *
 * <p>Toutes les méthodes {@code log()} sont asynchrones et transactionnelles de manière
 * indépendante ({@code REQUIRES_NEW}) pour ne pas polluer la transaction principale.
 *
 * <p>Usage recommandé :
 * <pre>
 *   auditService.log(userId, "DELETE_AGENT", "agent", agentId,
 *       AuditService.details("name", agent.getName(), "type", agent.getType()));
 * </pre>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepo;
    private final ObjectMapper       objectMapper;

    // ── Méthodes de log ──────────────────────────────────────────────────────

    /** Log simple sans détails. */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String userId, String agentId, String teamId,
                    String action, String resource, String resourceId, boolean success) {
        persist(userId, agentId, teamId, action, resource, resourceId, success, null, null);
    }

    /** Log avec message d'erreur (pour les échecs). */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String userId, String agentId, String teamId,
                    String action, String resource, String resourceId,
                    boolean success, String errorMessage, String detailsJson) {
        persist(userId, agentId, teamId, action, resource, resourceId, success, errorMessage, detailsJson);
    }

    /** Log avec détails structurés (Map → JSON). */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String userId, String action, String resource, String resourceId,
                    boolean success, Map<String, Object> details) {
        persist(userId, null, null, action, resource, resourceId, success, null, toJson(details));
    }

    /** Log avec agentId/teamId et détails structurés. */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String userId, String agentId, String teamId,
                    String action, String resource, String resourceId,
                    boolean success, Map<String, Object> details) {
        persist(userId, agentId, teamId, action, resource, resourceId, success, null, toJson(details));
    }

    // ── Lecture ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<AuditLog> search(String userId, String resource, String action,
                                 Boolean success, LocalDateTime from, LocalDateTime to,
                                 Pageable pageable) {
        return auditLogRepo.search(userId, resource, action, success, from, to, pageable);
    }

    @Transactional(readOnly = true)
    public Page<AuditLog> getResourceHistory(String resource, String resourceId, Pageable pageable) {
        return auditLogRepo.findByResourceAndResourceIdOrderByTimestampDesc(resource, resourceId, pageable);
    }

    @Transactional(readOnly = true)
    public Page<AuditLog> getAgentAuditLogs(String agentId, Pageable pageable) {
        return auditLogRepo.findByAgentIdOrderByTimestampDesc(agentId, pageable);
    }

    @Transactional(readOnly = true)
    public Page<AuditLog> getUserAuditLogs(String userId, Pageable pageable) {
        return auditLogRepo.findByUserIdOrderByTimestampDesc(userId, pageable);
    }

    @Transactional(readOnly = true)
    public long countRecentErrors(String agentId) {
        return auditLogRepo.countByAgentIdAndSuccessFalseAndTimestampAfter(
            agentId, LocalDateTime.now().minusHours(24));
    }

    @Transactional(readOnly = true)
    public long countRecentUserErrors(String userId) {
        return auditLogRepo.countByUserIdAndSuccessFalseAndTimestampAfter(
            userId, LocalDateTime.now().minusHours(24));
    }

    // ── Helpers statiques ────────────────────────────────────────────────────

    /**
     * Construit un Map de détails d'audit à partir de paires clé-valeur.
     * Les valeurs null sont ignorées.
     *
     * <pre>AuditService.details("name", agent.getName(), "type", agent.getType())</pre>
     */
    public static Map<String, Object> details(Object... kvPairs) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kvPairs.length; i += 2) {
            if (kvPairs[i + 1] != null) {
                map.put(String.valueOf(kvPairs[i]), kvPairs[i + 1]);
            }
        }
        return map;
    }

    // ── Implémentation interne ────────────────────────────────────────────────

    private void persist(String userId, String agentId, String teamId,
                         String action, String resource, String resourceId,
                         boolean success, String errorMessage, String detailsJson) {
        try {
            AuditLog audit = AuditLog.builder()
                .userId(userId)
                .agentId(agentId)
                .teamId(teamId)
                .action(action)
                .resource(resource)
                .resourceId(resourceId)
                .success(success)
                .errorMessage(errorMessage)
                .details(detailsJson)
                .build();
            auditLogRepo.save(audit);
        } catch (Exception e) {
            log.warn("Failed to write audit log: action={} userId={} error={}",
                action, userId, e.getMessage());
        }
    }

    private String toJson(Map<String, Object> map) {
        if (map == null || map.isEmpty()) return null;
        try { return objectMapper.writeValueAsString(map); }
        catch (Exception e) { return null; }
    }
}
