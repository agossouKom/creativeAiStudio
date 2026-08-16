package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.WorkflowStep;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface WorkflowStepRepository extends JpaRepository<WorkflowStep, String> {
    List<WorkflowStep>     findByWorkflowIdAndDeletedFalseOrderByStepOrderAsc(String workflowId);
    Optional<WorkflowStep> findByWorkflowIdAndStepOrderAndDeletedFalse(String workflowId, int order);
    void                   deleteByWorkflowId(String workflowId);
}
