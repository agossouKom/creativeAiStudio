package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.Workflow;
import com.creativeai.agentteam.model.enums.WorkflowStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface WorkflowRepository extends JpaRepository<Workflow, String> {
    Optional<Workflow> findByIdAndDeletedFalse(String id);
    Optional<Workflow> findByIdAndOwnerIdAndDeletedFalse(String id, String ownerId);
    List<Workflow>     findByOwnerIdAndDeletedFalseOrderByCreatedAtDesc(String ownerId);
    List<Workflow>     findByTeamIdAndDeletedFalse(String teamId);
    List<Workflow>     findByOwnerIdAndStatusAndDeletedFalse(String ownerId, WorkflowStatus status);
    List<Workflow>     findByStatusAndNextRunAtBeforeAndDeletedFalse(WorkflowStatus status, LocalDateTime now);

    // Soft-delete / restore
    List<Workflow>     findByOwnerIdAndDeletedTrueOrderByUpdatedAtDesc(String ownerId);
    Optional<Workflow> findByIdAndOwnerIdAndDeletedTrue(String id, String ownerId);
}
