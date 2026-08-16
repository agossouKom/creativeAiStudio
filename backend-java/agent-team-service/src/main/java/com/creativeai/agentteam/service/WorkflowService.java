package com.creativeai.agentteam.service;

import com.creativeai.agentteam.dto.request.CreateWorkflowRequest;
import com.creativeai.agentteam.dto.request.WorkflowStepRequest;
import com.creativeai.agentteam.dto.response.WorkflowResponse;
import com.creativeai.agentteam.dto.response.WorkflowStepResponse;
import com.creativeai.agentteam.model.Workflow;
import com.creativeai.agentteam.model.WorkflowStep;
import com.creativeai.agentteam.model.enums.TriggerType;
import com.creativeai.agentteam.model.enums.WorkflowStatus;
import com.creativeai.agentteam.repository.WorkflowRepository;
import com.creativeai.agentteam.repository.WorkflowStepRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowService {

    private final WorkflowRepository     workflowRepo;
    private final WorkflowStepRepository stepRepo;
    private final AuditService           auditService;

    @Transactional
    public WorkflowResponse createWorkflow(String ownerId, CreateWorkflowRequest req) {
        Workflow workflow = Workflow.builder()
            .name(req.name()).description(req.description())
            .teamId(req.teamId()).ownerId(ownerId)
            .triggerType(req.triggerType() != null ? req.triggerType() : TriggerType.MANUAL)
            .cronExpression(req.cronExpression()).triggerAgentId(req.triggerAgentId())
            .status(WorkflowStatus.DRAFT)
            .build();
        workflow = workflowRepo.save(workflow);

        List<WorkflowStep> steps = new ArrayList<>();
        if (req.steps() != null) {
            for (WorkflowStepRequest sr : req.steps()) steps.add(buildStep(workflow, sr));
            stepRepo.saveAll(steps);
            workflow.setSteps(steps);
        }

        auditService.log(ownerId, "CREATE_WORKFLOW", "workflow", workflow.getId(), true,
            AuditService.details("name", workflow.getName(), "triggerType", workflow.getTriggerType()));
        return toResponse(workflow, steps);
    }

    @Transactional(readOnly = true)
    public WorkflowResponse getWorkflow(String ownerId, String workflowId) {
        Workflow wf = workflowRepo.findByIdAndOwnerIdAndDeletedFalse(workflowId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Workflow non trouvé: " + workflowId));
        return toResponse(wf, stepRepo.findByWorkflowIdAndDeletedFalseOrderByStepOrderAsc(workflowId));
    }

    @Transactional(readOnly = true)
    public List<WorkflowResponse> listWorkflows(String ownerId) {
        return workflowRepo.findByOwnerIdAndDeletedFalseOrderByCreatedAtDesc(ownerId)
            .stream().map(wf -> toResponse(wf,
                stepRepo.findByWorkflowIdAndDeletedFalseOrderByStepOrderAsc(wf.getId())))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<WorkflowResponse> listDeletedWorkflows(String ownerId) {
        return workflowRepo.findByOwnerIdAndDeletedTrueOrderByUpdatedAtDesc(ownerId)
            .stream().map(wf -> toResponse(wf, List.of()))
            .toList();
    }

    @Transactional
    public WorkflowResponse activateWorkflow(String ownerId, String workflowId) {
        Workflow wf = workflowRepo.findByIdAndOwnerIdAndDeletedFalse(workflowId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Workflow non trouvé: " + workflowId));
        WorkflowStatus old = wf.getStatus();
        wf.setStatus(WorkflowStatus.ACTIVE);
        workflowRepo.save(wf);
        auditService.log(ownerId, "ACTIVATE_WORKFLOW", "workflow", workflowId, true,
            AuditService.details("name", wf.getName(), "from", old, "to", WorkflowStatus.ACTIVE));
        return toResponse(wf, stepRepo.findByWorkflowIdAndDeletedFalseOrderByStepOrderAsc(workflowId));
    }

    @Transactional
    public WorkflowResponse pauseWorkflow(String ownerId, String workflowId) {
        Workflow wf = workflowRepo.findByIdAndOwnerIdAndDeletedFalse(workflowId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Workflow non trouvé: " + workflowId));
        WorkflowStatus old = wf.getStatus();
        wf.setStatus(WorkflowStatus.PAUSED);
        workflowRepo.save(wf);
        auditService.log(ownerId, "PAUSE_WORKFLOW", "workflow", workflowId, true,
            AuditService.details("name", wf.getName(), "from", old, "to", WorkflowStatus.PAUSED));
        return toResponse(wf, stepRepo.findByWorkflowIdAndDeletedFalseOrderByStepOrderAsc(workflowId));
    }

    @Transactional
    public void deleteWorkflow(String ownerId, String workflowId) {
        Workflow wf = workflowRepo.findByIdAndOwnerIdAndDeletedFalse(workflowId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Workflow non trouvé: " + workflowId));
        wf.setDeleted(true);
        workflowRepo.save(wf);
        auditService.log(ownerId, "DELETE_WORKFLOW", "workflow", workflowId, true,
            AuditService.details("name", wf.getName(), "softDelete", true));
    }

    @Transactional
    public WorkflowResponse restoreWorkflow(String ownerId, String workflowId) {
        Workflow wf = workflowRepo.findByIdAndOwnerIdAndDeletedTrue(workflowId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Workflow supprimé introuvable: " + workflowId));
        wf.setDeleted(false);
        workflowRepo.save(wf);
        auditService.log(ownerId, "RESTORE_WORKFLOW", "workflow", workflowId, true,
            AuditService.details("name", wf.getName()));
        return toResponse(wf, stepRepo.findByWorkflowIdAndDeletedFalseOrderByStepOrderAsc(workflowId));
    }

    private WorkflowStep buildStep(Workflow workflow, WorkflowStepRequest sr) {
        return WorkflowStep.builder()
            .workflow(workflow).stepOrder(sr.stepOrder()).name(sr.name())
            .agentId(sr.agentId()).actionType(sr.actionType())
            .config(sr.config()).conditions(sr.conditions())
            .onSuccessStepId(sr.onSuccessStepId()).onFailureStepId(sr.onFailureStepId())
            .timeoutSeconds(sr.timeoutSeconds() != null ? sr.timeoutSeconds() : 120)
            .parallel(sr.parallel() != null ? sr.parallel() : false)
            .build();
    }

    private WorkflowResponse toResponse(Workflow wf, List<WorkflowStep> steps) {
        return WorkflowResponse.from(wf, steps.stream().map(WorkflowStepResponse::from).toList());
    }
}
