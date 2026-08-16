package com.creativeai.agentteam.service;

import com.creativeai.agentteam.dto.request.PromptTemplateRequest;
import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.PromptTemplate;
import com.creativeai.agentteam.model.enums.PromptType;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.PromptTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class PromptService {

    private final PromptTemplateRepository promptRepo;
    private final AgentRepository          agentRepo;
    private final AuditService             auditService;

    @Transactional
    public PromptTemplate createPrompt(String ownerId, String agentId, PromptTemplateRequest req) {
        Agent agent = agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));

        if (req.active() != null && req.active()) {
            promptRepo.findByAgentIdAndTypeAndActiveTrueAndDeletedFalse(agentId, req.type())
                .ifPresent(old -> { old.setActive(false); promptRepo.save(old); });
        }

        int version = promptRepo.findByAgentIdAndTypeAndDeletedFalse(agentId, req.type()).size() + 1;
        PromptTemplate prompt = PromptTemplate.builder()
            .agent(agent).name(req.name()).type(req.type()).content(req.content())
            .description(req.description()).variablesJson(req.variablesJson())
            .version(version).active(req.active() != null ? req.active() : true)
            .build();
        prompt = promptRepo.save(prompt);
        auditService.log(ownerId, "CREATE_PROMPT", "prompt", prompt.getId(), true,
            AuditService.details("agentName", agent.getName(), "promptName", prompt.getName(),
                "type", prompt.getType(), "version", prompt.getVersion()));
        return prompt;
    }

    @Transactional(readOnly = true)
    public List<PromptTemplate> listPrompts(String ownerId, String agentId) {
        agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));
        return promptRepo.findByAgentIdAndDeletedFalseOrderByVersionDesc(agentId);
    }

    @Transactional(readOnly = true)
    public List<PromptTemplate> listDeletedPrompts(String ownerId, String agentId) {
        agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));
        return promptRepo.findByAgentIdAndDeletedTrueOrderByUpdatedAtDesc(agentId);
    }

    @Transactional
    public PromptTemplate restorePrompt(String ownerId, String agentId, String promptId) {
        Agent agent = agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));
        PromptTemplate p = promptRepo.findByIdAndAgentIdAndDeletedTrue(promptId, agentId)
            .orElseThrow(() -> new ResourceNotFoundException("Prompt supprimé introuvable: " + promptId));
        p.setDeleted(false);
        p = promptRepo.save(p);
        auditService.log(ownerId, "RESTORE_PROMPT", "prompt", promptId, true,
            AuditService.details("agentName", agent.getName(), "promptName", p.getName(), "type", p.getType()));
        return p;
    }

    @Transactional(readOnly = true)
    public PromptTemplate getActivePrompt(String agentId, PromptType type) {
        return promptRepo.findByAgentIdAndTypeAndActiveTrueAndDeletedFalse(agentId, type)
            .orElseThrow(() -> new ResourceNotFoundException(
                "Aucun prompt actif de type " + type + " pour l'agent " + agentId));
    }

    public String renderPrompt(String agentId, PromptType type, Map<String, Object> variables) {
        PromptTemplate tpl = promptRepo.findByAgentIdAndTypeAndActiveTrueAndDeletedFalse(agentId, type)
            .orElse(null);
        if (tpl == null) return null;
        String content = tpl.getContent();
        if (variables != null) {
            for (Map.Entry<String, Object> e : variables.entrySet()) {
                content = content.replace("{{" + e.getKey() + "}}", String.valueOf(e.getValue()));
            }
        }
        return content;
    }

    @Transactional
    public void deletePrompt(String ownerId, String agentId, String promptId) {
        Agent agent = agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));
        PromptTemplate p = promptRepo.findByIdAndAgentIdAndDeletedFalse(promptId, agentId)
            .orElseThrow(() -> new ResourceNotFoundException("Prompt non trouvé: " + promptId));
        p.setDeleted(true);
        promptRepo.save(p);
        auditService.log(ownerId, "DELETE_PROMPT", "prompt", promptId, true,
            AuditService.details("agentName", agent.getName(), "promptName", p.getName(), "softDelete", true));
    }
}
