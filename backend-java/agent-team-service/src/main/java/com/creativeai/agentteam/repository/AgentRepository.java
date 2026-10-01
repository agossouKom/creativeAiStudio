package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.enums.AgentStatus;
import com.creativeai.agentteam.model.enums.AgentType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AgentRepository extends JpaRepository<Agent, String> {
    Optional<Agent> findBySlugAndDeletedFalse(String slug);
    Optional<Agent> findByCodeAndDeletedFalse(String code);
    Optional<Agent> findByCodeAndOwnerIdAndDeletedFalse(String code, String ownerId);
    Optional<Agent> findByIdAndDeletedFalse(String id);
    Optional<Agent> findByIdAndOwnerIdAndDeletedFalse(String id, String ownerId);

    /**
     * Agent accessible à l'appelant : possédé directement, ou membre d'une
     * équipe dont l'appelant est propriétaire.
     *
     * <p>C'est la règle d'accès utilisée par la délégation inter-agents. Sans
     * elle, le LLM pouvait cibler n'importe quel agentId de la base et lui
     * injecter une consigne exécutée avec les outils et le budget de cet agent.
     */
    @Query("SELECT a FROM Agent a WHERE a.id = :id AND a.deleted = false " +
           "AND (a.ownerId = :userId " +
           "  OR a.teamId IN (SELECT t.id FROM AgentTeam t WHERE t.ownerId = :userId AND t.deleted = false))")
    Optional<Agent> findAccessibleToUser(@Param("id") String id, @Param("userId") String userId);
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
