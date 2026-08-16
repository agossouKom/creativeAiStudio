package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.AgentTeam;
import com.creativeai.agentteam.model.enums.TeamStatus;
import com.creativeai.agentteam.model.enums.TeamType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface AgentTeamRepository extends JpaRepository<AgentTeam, String> {

    Optional<AgentTeam> findByIdAndDeletedFalse(String id);
    Optional<AgentTeam> findByIdAndOwnerIdAndDeletedFalse(String id, String ownerId);
    List<AgentTeam>     findByOwnerIdAndDeletedFalseOrderByCreatedAtDesc(String ownerId);
    List<AgentTeam>     findByOwnerIdAndStatusAndDeletedFalse(String ownerId, TeamStatus status);
    List<AgentTeam>     findByOwnerIdAndTypeAndDeletedFalseOrderByCreatedAtDesc(String ownerId, TeamType type);
    List<AgentTeam>     findByOwnerIdAndStatusAndTypeAndDeletedFalseOrderByCreatedAtDesc(String ownerId, TeamStatus status, TeamType type);
    List<AgentTeam>     findByOrganizationIdAndDeletedFalse(String organizationId);
    long                countByOwnerIdAndDeletedFalse(String ownerId);

    // Soft-delete / restore
    List<AgentTeam>     findByOwnerIdAndDeletedTrueOrderByUpdatedAtDesc(String ownerId);
    Optional<AgentTeam> findByIdAndOwnerIdAndDeletedTrue(String id, String ownerId);
}
