package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.enums.AgentStatus;
import com.creativeai.agentteam.model.enums.AgentType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface AgentRepository extends JpaRepository<Agent, String> {
    Optional<Agent> findBySlugAndDeletedFalse(String slug);
    Optional<Agent> findByCodeAndDeletedFalse(String code);
    Optional<Agent> findByCodeAndOwnerIdAndDeletedFalse(String code, String ownerId);
    Optional<Agent> findByIdAndDeletedFalse(String id);
    Optional<Agent> findByIdAndOwnerIdAndDeletedFalse(String id, String ownerId);
    List<Agent>     findByOwnerIdAndDeletedFalseOrderByCreatedAtDesc(String ownerId);
    List<Agent>     findByTeamIdAndDeletedFalseOrderByTypeAsc(String teamId);
    List<Agent>     findByOwnerIdAndTypeAndDeletedFalse(String ownerId, AgentType type);
    List<Agent>     findByOwnerIdAndStatusAndDeletedFalse(String ownerId, AgentStatus status);
    List<Agent>     findByTeamIdAndStatusAndDeletedFalse(String teamId, AgentStatus status);
    List<Agent>     findByStatusAndDeletedFalse(AgentStatus status);
    boolean         existsBySlugAndOwnerIdAndDeletedFalse(String slug, String ownerId);
    long            countByOwnerIdAndDeletedFalse(String ownerId);
    long            countByTeamIdAndDeletedFalse(String teamId);

    // Soft-delete / restore
    List<Agent>     findByOwnerIdAndDeletedTrueOrderByUpdatedAtDesc(String ownerId);
    Optional<Agent> findByIdAndOwnerIdAndDeletedTrue(String id, String ownerId);

    @Query("SELECT a FROM Agent a WHERE a.ownerId = :ownerId AND a.deleted = false " +
           "AND (LOWER(a.name) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(a.description) LIKE LOWER(CONCAT('%', :q, '%')))")
    Page<Agent> search(String ownerId, String q, Pageable pageable);
}
