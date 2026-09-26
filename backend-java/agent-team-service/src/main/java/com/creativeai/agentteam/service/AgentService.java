package com.creativeai.agentteam.service;

import com.creativeai.agentteam.dto.request.*;
import com.creativeai.agentteam.dto.response.*;
import com.creativeai.agentteam.model.*;
import com.creativeai.agentteam.model.enums.AgentStatus;
import com.creativeai.agentteam.model.enums.AgentType;
import com.creativeai.agentteam.model.enums.LlmType;
import com.creativeai.agentteam.model.enums.PromptType;
import com.creativeai.agentteam.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Service
@RequiredArgsConstructor
public class AgentService {

    private final AgentRepository          agentRepo;
    private final AgentTeamRepository      teamRepo;
    private final AgentConfigRepository   configRepo;
    private final AgentProfileRepository  profileRepo;
    private final LlmProviderRepository   llmRepo;
    private final KnowledgeBaseRepository kbRepo;
    private final PromptTemplateRepository promptRepo;
    private final AuditService            auditService;
    private final EncryptionService       encryptionService;
    private final AgentTemplateService    templateService;
    private final ObjectMapper            objectMapper;

    @Value("${GROQ_API_KEY:}")         private String groqApiKey;
    @Value("${agent.groq-base-url}")   private String groqBaseUrl;
    @Value("${agent.default-model}")   private String defaultModel;

    // ── CRUD Agent ──────────────────────────────────────────────────────────

    @Transactional
    public AgentDetailResponse createAgent(String ownerId, CreateAgentRequest req) {
        String slug = buildSlug(req.slug() != null ? req.slug() : req.name(), ownerId);

        Agent agent = Agent.builder()
            .name(req.name()).slug(slug).code(generateUniqueAgentCode()).description(req.description())
            .type(req.type()).status(AgentStatus.ACTIVE)
            .ownerId(ownerId).teamId(req.teamId())
            .build();
        agent = agentRepo.save(agent);

        AgentConfig  config  = buildConfig(agent, req.config());  configRepo.save(config);
        AgentProfile profile = buildProfile(agent, req.profile(), req.type()); profileRepo.save(profile);
        agent.setConfig(config); agent.setProfile(profile);

        KnowledgeBase kb = KnowledgeBase.builder()
            .agent(agent).name(agent.getName() + " - Knowledge Base").build();
        kbRepo.save(kb);

        auditService.log(ownerId, "CREATE_AGENT", "agent", agent.getId(), true,
            AuditService.details("name", agent.getName(), "type", agent.getType(), "slug", slug));
        log.info("Agent created: {} [{}] by {}", agent.getName(), agent.getType(), ownerId);
        return AgentDetailResponse.from(agentRepo.findById(agent.getId()).orElseThrow());
    }

    /**
     * Option C : crée un agent pré-configuré depuis un template de type.
     * Le system prompt, la config et les outils sont définis automatiquement.
     */
    @Transactional
    public AgentDetailResponse createFromTemplate(String ownerId, AgentType type, CreateFromTemplateRequest req) {
        AgentTemplateService.AgentTemplate tpl = templateService.getTemplate(type);

        String name = (req != null && req.name() != null && !req.name().isBlank())
                ? req.name() : tpl.defaultName();
        String description = (req != null && req.description() != null && !req.description().isBlank())
                ? req.description() : tpl.defaultDescription();
        String teamId = req != null ? req.teamId() : null;

        String slug = buildSlug(name, ownerId);

        Agent agent = Agent.builder()
            .name(name).slug(slug).code(generateUniqueAgentCode()).description(description)
            .type(type).status(AgentStatus.ACTIVE)
            .ownerId(ownerId).teamId(teamId)
            .build();
        agent = agentRepo.save(agent);

        // Config avec valeurs du template
        String toolsJson = serializeDefaultTools(tpl.defaultTools());
        AgentConfig config = AgentConfig.builder()
            .agent(agent)
            .temperature(tpl.temperature())
            .maxTokens(tpl.maxTokens())
            .maxIterations(tpl.maxIterations())
            .autoReplyEnabled(tpl.autoReplyEnabled())
            .customParams(toolsJson)
            .build();
        configRepo.save(config);

        // Profil avec nom d'affichage du template
        AgentProfile profile = AgentProfile.builder()
            .agent(agent)
            .displayName(tpl.defaultName())
            .bio(tpl.defaultDescription())
            .build();
        profileRepo.save(profile);

        agent.setConfig(config);
        agent.setProfile(profile);

        // System prompt du template (actif immédiatement)
        PromptTemplate systemPrompt = PromptTemplate.builder()
            .agent(agent)
            .name("Prompt système — " + tpl.defaultName())
            .type(PromptType.SYSTEM)
            .content(tpl.systemPrompt())
            .description("Généré automatiquement depuis le template " + type.name())
            .version(1)
            .active(true)
            .build();
        promptRepo.save(systemPrompt);

        // Provider LLM par défaut (modèle par défaut configuré, max_tokens du template)
        String encryptedKey = (groqApiKey != null && !groqApiKey.isBlank())
            ? encryptionService.encrypt(groqApiKey) : null;
        LlmProvider provider = LlmProvider.builder()
            .agent(agent)
            .type(LlmType.GROQ)
            .modelId(defaultModel)
            .baseUrl(groqBaseUrl)
            .encryptedApiKey(encryptedKey)
            .displayName("Groq — " + defaultModel)
            .temperature(tpl.temperature())
            .maxTokens(tpl.maxTokens())
            .streamingEnabled(true)
            .requestTimeoutSeconds(120)
            .rateLimitRpm(30)
            .primary(true)
            .active(true)
            .build();
        llmRepo.save(provider);

        // Base de connaissances vide
        kbRepo.save(KnowledgeBase.builder()
            .agent(agent).name(name + " - Knowledge Base").build());

        auditService.log(ownerId, "CREATE_AGENT_FROM_TEMPLATE", "agent", agent.getId(), true,
            AuditService.details("name", name, "type", type, "slug", slug, "template", true));
        log.info("Agent created from template: {} [{}] by {}", name, type, ownerId);
        return AgentDetailResponse.from(agentRepo.findById(agent.getId()).orElseThrow());
    }

    private String serializeDefaultTools(List<String> tools) {
        try {
            return objectMapper.writeValueAsString(Map.of("enabledTools", tools));
        } catch (Exception e) {
            return "{\"enabledTools\":[]}";
        }
    }

    @Transactional(readOnly = true)
    public AgentDetailResponse getAgent(String ownerId, String agentId) {
        return AgentDetailResponse.from(
            agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId)));
    }

    @Transactional(readOnly = true)
    public AgentDetailResponse getAgentByCode(String ownerId, String code) {
        return AgentDetailResponse.from(
            agentRepo.findByCodeAndOwnerIdAndDeletedFalse(code, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé avec le code: " + code)));
    }

    @Transactional(readOnly = true)
    public List<AgentResponse> listAgents(String ownerId) {
        return agentRepo.findByOwnerIdAndDeletedFalseOrderByCreatedAtDesc(ownerId)
            .stream().map(AgentResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<AgentResponse> listDeletedAgents(String ownerId) {
        return agentRepo.findByOwnerIdAndDeletedTrueOrderByUpdatedAtDesc(ownerId)
            .stream().map(AgentResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<AgentResponse> listAgentsByType(String ownerId, AgentType type) {
        return agentRepo.findByOwnerIdAndTypeAndDeletedFalse(ownerId, type)
            .stream().map(AgentResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<AgentResponse> searchAgents(String ownerId, String q, Pageable pageable) {
        Page<Agent> page = agentRepo.search(ownerId, q, pageable);
        return PageResponse.from(page, AgentResponse::from);
    }

    @Transactional
    public AgentResponse updateAgent(String ownerId, String agentId, UpdateAgentRequest req) {
        Agent agent = agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));

        if (req.name()        != null) agent.setName(req.name());
        if (req.description() != null) agent.setDescription(req.description());
        if (req.status()      != null) agent.setStatus(req.status());
        if (req.teamId()      != null) agent.setTeamId(req.teamId());
        if (req.extraConfig() != null) agent.setExtraConfig(req.extraConfig());

        agent = agentRepo.save(agent);
        auditService.log(ownerId, "UPDATE_AGENT", "agent", agentId, true,
            AuditService.details("name", agent.getName(), "type", agent.getType()));
        return AgentResponse.from(agent);
    }

    @Transactional
    public AgentResponse updateStatus(String ownerId, String agentId, AgentStatus newStatus) {
        Agent agent = agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));
        AgentStatus oldStatus = agent.getStatus();
        agent.setStatus(newStatus);
        if (newStatus == AgentStatus.ACTIVE) agent.setLastActiveAt(LocalDateTime.now());
        agentRepo.save(agent);
        auditService.log(ownerId, "UPDATE_AGENT_STATUS", "agent", agentId, true,
            AuditService.details("name", agent.getName(), "from", oldStatus, "to", newStatus));
        return AgentResponse.from(agent);
    }

    @Transactional
    public void deleteAgent(String ownerId, String agentId) {
        Agent agent = agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));
        agent.setDeleted(true);
        agentRepo.save(agent);
        auditService.log(ownerId, "DELETE_AGENT", "agent", agentId, true,
            AuditService.details("name", agent.getName(), "type", agent.getType(), "softDelete", true));
        log.info("Agent soft-deleted: {} by {}", agentId, ownerId);
    }

    @Transactional
    public AgentDetailResponse restoreAgent(String ownerId, String agentId) {
        Agent agent = agentRepo.findByIdAndOwnerIdAndDeletedTrue(agentId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent supprimé introuvable: " + agentId));
        agent.setDeleted(false);
        agentRepo.save(agent);
        auditService.log(ownerId, "RESTORE_AGENT", "agent", agentId, true,
            AuditService.details("name", agent.getName(), "type", agent.getType()));
        log.info("Agent restored: {} by {}", agentId, ownerId);
        return AgentDetailResponse.from(agentRepo.findById(agentId).orElseThrow());
    }

    // ── Config ──────────────────────────────────────────────────────────────

    @Transactional
    public AgentDetailResponse updateConfig(String ownerId, String agentId, AgentConfigRequest req) {
        Agent agent = agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));
        AgentConfig cfg = configRepo.findByAgentIdAndDeletedFalse(agentId)
            .orElse(AgentConfig.builder().agent(agent).build());

        if (req.temperature()         != null) cfg.setTemperature(req.temperature());
        if (req.maxTokens()           != null) cfg.setMaxTokens(req.maxTokens());
        if (req.maxMemoryMessages()   != null) cfg.setMaxMemoryMessages(req.maxMemoryMessages());
        if (req.maxIterations()       != null) cfg.setMaxIterations(req.maxIterations());
        if (req.taskTimeoutSeconds()  != null) cfg.setTaskTimeoutSeconds(req.taskTimeoutSeconds());
        if (req.rateLimitRpm()        != null) cfg.setRateLimitRpm(req.rateLimitRpm());
        if (req.responseLanguage()    != null) cfg.setResponseLanguage(req.responseLanguage());
        if (req.timezone()            != null) cfg.setTimezone(req.timezone());
        if (req.streamingEnabled()    != null) cfg.setStreamingEnabled(req.streamingEnabled());
        if (req.autoEscalateEnabled() != null) cfg.setAutoEscalateEnabled(req.autoEscalateEnabled());
        if (req.autoReplyEnabled()    != null) cfg.setAutoReplyEnabled(req.autoReplyEnabled());
        if (req.workingHoursJson()    != null) cfg.setWorkingHoursJson(req.workingHoursJson());
        if (req.customParams()        != null) cfg.setCustomParams(req.customParams());

        configRepo.save(cfg);
        auditService.log(ownerId, "UPDATE_AGENT_CONFIG", "agent", agentId, true,
            AuditService.details("name", agent.getName()));
        return getAgent(ownerId, agentId);
    }

    @Transactional
    public AgentDetailResponse updateProfile(String ownerId, String agentId, AgentProfileRequest req) {
        Agent agent = agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));
        AgentProfile prf = profileRepo.findByAgentIdAndDeletedFalse(agentId)
            .orElse(AgentProfile.builder().agent(agent).displayName(agent.getName()).build());

        if (req.displayName()      != null) prf.setDisplayName(req.displayName());
        if (req.bio()              != null) prf.setBio(req.bio());
        if (req.persona()          != null) prf.setPersona(req.persona());
        if (req.tone()             != null) prf.setTone(req.tone());
        if (req.welcomeMessage()   != null) prf.setWelcomeMessage(req.welcomeMessage());
        if (req.avatarUrl()        != null) prf.setAvatarUrl(req.avatarUrl());
        if (req.capabilitiesJson() != null) prf.setCapabilitiesJson(req.capabilitiesJson());
        if (req.restrictionsJson() != null) prf.setRestrictionsJson(req.restrictionsJson());
        if (req.brandVoiceJson()   != null) prf.setBrandVoiceJson(req.brandVoiceJson());

        profileRepo.save(prf);
        auditService.log(ownerId, "UPDATE_AGENT_PROFILE", "agent", agentId, true,
            AuditService.details("name", agent.getName(), "displayName", prf.getDisplayName()));
        return getAgent(ownerId, agentId);
    }

    // ── LLM Providers ───────────────────────────────────────────────────────

    @Transactional
    public LlmProviderResponse addLlmProvider(String ownerId, String agentId, LlmProviderRequest req) {
        Agent agent = agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));
        boolean makePrimary = req.primary() != null && req.primary();

        if (makePrimary) {
            llmRepo.findByAgentIdAndDeletedFalseOrderByPrimaryDesc(agentId)
                .forEach(p -> { p.setPrimary(false); llmRepo.save(p); });
        }
        LlmProvider llm = buildLlmProvider(agent, req, makePrimary);
        LlmProvider saved = llmRepo.save(llm);
        auditService.log(ownerId, "ADD_LLM_PROVIDER", "agent", agentId, true,
            AuditService.details("agentName", agent.getName(), "provider", req.type(), "model", req.modelId()));
        return LlmProviderResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<LlmProviderResponse> getLlmProviders(String ownerId, String agentId, boolean includeDeleted) {
        agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));
        List<LlmProvider> providers = includeDeleted
            ? llmRepo.findByAgentIdOrderByPrimaryDescCreatedAtDesc(agentId)
            : llmRepo.findByAgentIdAndDeletedFalseOrderByPrimaryDesc(agentId);
        return providers.stream().map(LlmProviderResponse::from).toList();
    }

    public String revealLlmApiKey(String ownerId, String agentId, String llmId) {
        agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));
        LlmProvider llm = llmRepo.findById(llmId)
            .orElseThrow(() -> new ResourceNotFoundException("LLM provider non trouvé: " + llmId));
        if (llm.getEncryptedApiKey() == null || llm.getEncryptedApiKey().isBlank()) return "";
        return encryptionService.decrypt(llm.getEncryptedApiKey());
    }

    @Transactional
    public void deleteLlmProvider(String ownerId, String agentId, String llmId) {
        Agent agent = agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));
        LlmProvider llm = llmRepo.findById(llmId)
            .orElseThrow(() -> new ResourceNotFoundException("LLM provider non trouvé: " + llmId));
        llm.setDeleted(true);
        llm.setPrimary(false);
        llmRepo.save(llm);
        auditService.log(ownerId, "REMOVE_LLM_PROVIDER", "agent", agentId, true,
            AuditService.details("agentName", agent.getName(), "provider", llm.getType(), "model", llm.getModelId()));
    }

    @Transactional
    public LlmProviderResponse restoreLlmProvider(String ownerId, String agentId, String llmId) {
        agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));
        LlmProvider llm = llmRepo.findById(llmId)
            .orElseThrow(() -> new ResourceNotFoundException("LLM provider non trouvé: " + llmId));
        llm.setDeleted(false);
        return LlmProviderResponse.from(llmRepo.save(llm));
    }

    @Transactional
    public LlmProviderResponse setPrimaryLlmProvider(String ownerId, String agentId, String llmId) {
        agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));
        // Retirer primary des autres providers actifs de cet agent
        llmRepo.findByAgentIdAndDeletedFalseOrderByPrimaryDesc(agentId)
            .forEach(p -> { p.setPrimary(false); llmRepo.save(p); });
        // Définir ce provider comme principal
        LlmProvider llm = llmRepo.findById(llmId)
            .orElseThrow(() -> new ResourceNotFoundException("LLM provider non trouvé: " + llmId));
        llm.setPrimary(true);
        llm.setDeleted(false);
        return LlmProviderResponse.from(llmRepo.save(llm));
    }

    // ── LLM Providers (compte utilisateur) ───────────────────────────────────

    @Transactional(readOnly = true)
    public List<LlmProviderResponse> listUserLlmProviders(String userId, boolean includeDeleted) {
        List<LlmProvider> providers = includeDeleted
            ? llmRepo.findByUserIdOrderByPrimaryDescCreatedAtDesc(userId)
            : llmRepo.findByUserIdAndDeletedFalseOrderByPrimaryDesc(userId);
        return providers.stream().map(LlmProviderResponse::from).toList();
    }

    @Transactional
    public LlmProviderResponse addUserLlmProvider(String userId, LlmProviderRequest req) {
        boolean makePrimary = req.primary() != null && req.primary();
        if (makePrimary) {
            llmRepo.findByUserIdAndDeletedFalseOrderByPrimaryDesc(userId)
                .forEach(p -> { p.setPrimary(false); llmRepo.save(p); });
        }
        LlmProvider llm = buildUserLlmProvider(userId, req, makePrimary);
        LlmProvider saved = llmRepo.save(llm);
        auditService.log(userId, "ADD_LLM_PROVIDER", "user", userId, true,
            AuditService.details("provider", req.type(), "model", req.modelId()));
        return LlmProviderResponse.from(saved);
    }

    @Transactional
    public LlmProviderResponse updateUserLlmProvider(String userId, String llmId, LlmProviderRequest req) {
        LlmProvider llm = findByUserActive(userId, llmId);
        if (req.type() != null)  llm.setType(req.type());
        if (req.modelId() != null) llm.setModelId(req.modelId());
        if (req.baseUrl() != null) llm.setBaseUrl(req.baseUrl());
        if (req.displayName() != null) llm.setDisplayName(req.displayName());
        if (req.apiKey() != null && !req.apiKey().isBlank()) {
            llm.setEncryptedApiKey(encryptionService.encrypt(req.apiKey()));
        }
        if (req.temperature() != null) llm.setTemperature(req.temperature());
        if (req.maxTokens() != null) llm.setMaxTokens(req.maxTokens());
        if (req.streamingEnabled() != null) llm.setStreamingEnabled(req.streamingEnabled());
        if (req.requestTimeoutSeconds() != null) llm.setRequestTimeoutSeconds(req.requestTimeoutSeconds());
        if (req.rateLimitRpm() != null) llm.setRateLimitRpm(req.rateLimitRpm());
        if (req.extraParams() != null) llm.setExtraParams(req.extraParams());
        if (req.primary() != null && req.primary()) {
            llmRepo.findByUserIdAndDeletedFalseOrderByPrimaryDesc(userId)
                .forEach(p -> { if (!p.getId().equals(llmId)) p.setPrimary(false); llmRepo.save(p); });
            llm.setPrimary(true);
        }
        LlmProvider saved = llmRepo.save(llm);
        auditService.log(userId, "UPDATE_LLM_PROVIDER", "user", userId, true,
            AuditService.details("provider", llm.getType(), "model", llm.getModelId()));
        return LlmProviderResponse.from(saved);
    }

    public String revealUserLlmApiKey(String userId, String llmId) {
        LlmProvider llm = findByUserActive(userId, llmId);
        if (llm.getEncryptedApiKey() == null || llm.getEncryptedApiKey().isBlank()) return "";
        return encryptionService.decrypt(llm.getEncryptedApiKey());
    }

    @Transactional
    public void deleteUserLlmProvider(String userId, String llmId) {
        LlmProvider llm = findByUserActive(userId, llmId);
        llm.setDeleted(true);
        llm.setPrimary(false);
        llmRepo.save(llm);
        auditService.log(userId, "REMOVE_LLM_PROVIDER", "user", userId, true,
            AuditService.details("provider", llm.getType(), "model", llm.getModelId()));
    }

    @Transactional
    public LlmProviderResponse restoreUserLlmProvider(String userId, String llmId) {
        LlmProvider llm = llmRepo.findByUserIdAndIdAndDeletedTrue(userId, llmId).stream().findFirst()
            .orElseThrow(() -> new ResourceNotFoundException("LLM provider non trouvé: " + llmId));
        llm.setDeleted(false);
        return LlmProviderResponse.from(llmRepo.save(llm));
    }

    @Transactional
    public LlmProviderResponse setPrimaryUserLlmProvider(String userId, String llmId) {
        LlmProvider llm = findByUserActive(userId, llmId);
        llmRepo.findByUserIdAndDeletedFalseOrderByPrimaryDesc(userId)
            .forEach(p -> { if (!p.getId().equals(llmId)) p.setPrimary(false); llmRepo.save(p); });
        llm.setPrimary(true);
        llm.setDeleted(false);
        return LlmProviderResponse.from(llmRepo.save(llm));
    }

    // ── LLM Providers (équipe) ──────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<LlmProviderResponse> listTeamLlmProviders(
            String ownerId, String teamId, boolean includeDeleted) {
        requireOwnedTeam(ownerId, teamId);
        List<LlmProvider> providers = includeDeleted
            ? llmRepo.findByTeamIdOrderByPrimaryDescCreatedAtDesc(teamId)
            : llmRepo.findByTeamIdAndDeletedFalseOrderByPrimaryDesc(teamId);
        return providers.stream().map(LlmProviderResponse::from).toList();
    }

    @Transactional
    public LlmProviderResponse addTeamLlmProvider(
            String ownerId, String teamId, LlmProviderRequest req) {
        requireOwnedTeam(ownerId, teamId);
        boolean makePrimary = req.primary() != null && req.primary();
        if (makePrimary) {
            llmRepo.findByTeamIdAndDeletedFalseOrderByPrimaryDesc(teamId)
                .forEach(provider -> {
                    provider.setPrimary(false);
                    llmRepo.save(provider);
                });
        }
        String encryptedKey = req.apiKey() != null && !req.apiKey().isBlank()
            ? encryptionService.encrypt(req.apiKey())
            : null;
        LlmProvider provider = LlmProvider.builder()
            .teamId(teamId)
            .type(req.type())
            .modelId(req.modelId())
            .baseUrl(req.baseUrl())
            .encryptedApiKey(encryptedKey)
            .displayName(req.displayName())
            .temperature(req.temperature() != null ? req.temperature() : 0.7)
            .maxTokens(req.maxTokens() != null ? req.maxTokens() : 2048)
            .streamingEnabled(req.streamingEnabled() != null ? req.streamingEnabled() : true)
            .requestTimeoutSeconds(req.requestTimeoutSeconds() != null
                ? req.requestTimeoutSeconds() : 60)
            .rateLimitRpm(req.rateLimitRpm() != null ? req.rateLimitRpm() : 30)
            .primary(makePrimary)
            .extraParams(req.extraParams())
            .build();
        LlmProvider saved = llmRepo.save(provider);
        auditService.log(ownerId, "ADD_TEAM_LLM_PROVIDER", "team", teamId, true,
            AuditService.details("provider", req.type(), "model", req.modelId()));
        return LlmProviderResponse.from(saved);
    }

    @Transactional
    public LlmProviderResponse updateTeamLlmProvider(
            String ownerId, String teamId, String llmId, LlmProviderRequest req) {
        requireOwnedTeam(ownerId, teamId);
        LlmProvider provider = findByTeamActive(teamId, llmId);
        if (req.type() != null) provider.setType(req.type());
        if (req.modelId() != null) provider.setModelId(req.modelId());
        if (req.baseUrl() != null) provider.setBaseUrl(req.baseUrl());
        if (req.displayName() != null) provider.setDisplayName(req.displayName());
        if (req.apiKey() != null && !req.apiKey().isBlank()) {
            provider.setEncryptedApiKey(encryptionService.encrypt(req.apiKey()));
        }
        if (req.temperature() != null) provider.setTemperature(req.temperature());
        if (req.maxTokens() != null) provider.setMaxTokens(req.maxTokens());
        if (req.streamingEnabled() != null) provider.setStreamingEnabled(req.streamingEnabled());
        if (req.requestTimeoutSeconds() != null) {
            provider.setRequestTimeoutSeconds(req.requestTimeoutSeconds());
        }
        if (req.rateLimitRpm() != null) provider.setRateLimitRpm(req.rateLimitRpm());
        if (req.extraParams() != null) provider.setExtraParams(req.extraParams());
        if (Boolean.TRUE.equals(req.primary())) {
            llmRepo.findByTeamIdAndDeletedFalseOrderByPrimaryDesc(teamId)
                .forEach(candidate -> {
                    if (!candidate.getId().equals(llmId)) candidate.setPrimary(false);
                    llmRepo.save(candidate);
                });
            provider.setPrimary(true);
        }
        LlmProvider saved = llmRepo.save(provider);
        auditService.log(ownerId, "UPDATE_TEAM_LLM_PROVIDER", "team", teamId, true,
            AuditService.details("provider", provider.getType(), "model", provider.getModelId()));
        return LlmProviderResponse.from(saved);
    }

    @Transactional
    public void deleteTeamLlmProvider(String ownerId, String teamId, String llmId) {
        requireOwnedTeam(ownerId, teamId);
        LlmProvider provider = findByTeamActive(teamId, llmId);
        provider.setDeleted(true);
        provider.setPrimary(false);
        llmRepo.save(provider);
        auditService.log(ownerId, "REMOVE_TEAM_LLM_PROVIDER", "team", teamId, true,
            AuditService.details("provider", provider.getType(), "model", provider.getModelId()));
    }

    @Transactional
    public LlmProviderResponse restoreTeamLlmProvider(
            String ownerId, String teamId, String llmId) {
        requireOwnedTeam(ownerId, teamId);
        LlmProvider provider = llmRepo.findByTeamIdAndIdAndDeletedTrue(teamId, llmId)
            .stream().findFirst()
            .orElseThrow(() -> new ResourceNotFoundException(
                "LLM provider supprimé non trouvé: " + llmId));
        provider.setDeleted(false);
        return LlmProviderResponse.from(llmRepo.save(provider));
    }

    @Transactional
    public LlmProviderResponse setPrimaryTeamLlmProvider(
            String ownerId, String teamId, String llmId) {
        requireOwnedTeam(ownerId, teamId);
        LlmProvider provider = findByTeamActive(teamId, llmId);
        llmRepo.findByTeamIdAndDeletedFalseOrderByPrimaryDesc(teamId)
            .forEach(candidate -> {
                candidate.setPrimary(candidate.getId().equals(llmId));
                llmRepo.save(candidate);
            });
        provider.setPrimary(true);
        return LlmProviderResponse.from(llmRepo.save(provider));
    }

    public String revealTeamLlmApiKey(String ownerId, String teamId, String llmId) {
        requireOwnedTeam(ownerId, teamId);
        LlmProvider provider = findByTeamActive(teamId, llmId);
        if (provider.getEncryptedApiKey() == null || provider.getEncryptedApiKey().isBlank()) {
            return "";
        }
        return encryptionService.decrypt(provider.getEncryptedApiKey());
    }

    private AgentTeam requireOwnedTeam(String ownerId, String teamId) {
        return teamRepo.findByIdAndOwnerIdAndDeletedFalse(teamId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Équipe introuvable: " + teamId));
    }

    private LlmProvider findByTeamActive(String teamId, String llmId) {
        return llmRepo.findByTeamIdAndIdAndDeletedFalse(teamId, llmId).stream().findFirst()
            .orElseThrow(() -> new ResourceNotFoundException("LLM provider non trouvé: " + llmId));
    }

    private LlmProvider findByUserActive(String userId, String llmId) {
        return llmRepo.findByUserIdAndIdAndDeletedFalse(userId, llmId).stream().findFirst()
            .orElseThrow(() -> new ResourceNotFoundException("LLM provider non trouvé: " + llmId));
    }

    private LlmProvider buildUserLlmProvider(String userId, LlmProviderRequest req, boolean primary) {
        String encryptedKey = req.apiKey() != null ? encryptionService.encrypt(req.apiKey()) : null;
        return LlmProvider.builder()
            .userId(userId).type(req.type()).modelId(req.modelId()).baseUrl(req.baseUrl())
            .encryptedApiKey(encryptedKey).displayName(req.displayName())
            .temperature(req.temperature()           != null ? req.temperature()           : 0.7)
            .maxTokens(req.maxTokens()               != null ? req.maxTokens()             : 2048)
            .streamingEnabled(req.streamingEnabled() != null ? req.streamingEnabled()      : true)
            .requestTimeoutSeconds(req.requestTimeoutSeconds() != null ? req.requestTimeoutSeconds() : 60)
            .rateLimitRpm(req.rateLimitRpm()         != null ? req.rateLimitRpm()          : 30)
            .primary(primary).extraParams(req.extraParams())
            .build();
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private String generateUniqueAgentCode() {
        String code;
        do {
            code = String.format("%06d", ThreadLocalRandom.current().nextInt(100000, 1000000));
        } while (agentRepo.findByCodeAndDeletedFalse(code).isPresent());
        return code;
    }

    private String buildSlug(String base, String ownerId) {
        String slug = base.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
        if (agentRepo.existsBySlugAndOwnerIdAndDeletedFalse(slug, ownerId)) {
            slug = slug + "-" + UUID.randomUUID().toString().substring(0, 6);
        }
        return slug;
    }

    private AgentConfig buildConfig(Agent agent, AgentConfigRequest req) {
        AgentConfig.AgentConfigBuilder b = AgentConfig.builder().agent(agent);
        if (req != null) {
            if (req.temperature()       != null) b.temperature(req.temperature());
            if (req.maxTokens()         != null) b.maxTokens(req.maxTokens());
            if (req.maxMemoryMessages() != null) b.maxMemoryMessages(req.maxMemoryMessages());
            if (req.maxIterations()     != null) b.maxIterations(req.maxIterations());
            if (req.responseLanguage()  != null) b.responseLanguage(req.responseLanguage());
            if (req.timezone()          != null) b.timezone(req.timezone());
            if (req.streamingEnabled()  != null) b.streamingEnabled(req.streamingEnabled());
            if (req.autoReplyEnabled()  != null) b.autoReplyEnabled(req.autoReplyEnabled());
            if (req.workingHoursJson()  != null) b.workingHoursJson(req.workingHoursJson());
            if (req.customParams()      != null) b.customParams(req.customParams());
        }
        return b.build();
    }

    private AgentProfile buildProfile(Agent agent, AgentProfileRequest req, AgentType type) {
        String defaultName = type.name().replace("_", " ").toLowerCase();
        defaultName = Character.toUpperCase(defaultName.charAt(0)) + defaultName.substring(1);
        AgentProfile.AgentProfileBuilder b = AgentProfile.builder().agent(agent).displayName(defaultName);
        if (req != null) {
            if (req.displayName()      != null) b.displayName(req.displayName());
            if (req.bio()              != null) b.bio(req.bio());
            if (req.persona()          != null) b.persona(req.persona());
            if (req.tone()             != null) b.tone(req.tone());
            if (req.welcomeMessage()   != null) b.welcomeMessage(req.welcomeMessage());
            if (req.avatarUrl()        != null) b.avatarUrl(req.avatarUrl());
            if (req.capabilitiesJson() != null) b.capabilitiesJson(req.capabilitiesJson());
        }
        return b.build();
    }

    private LlmProvider buildLlmProvider(Agent agent, LlmProviderRequest req, boolean primary) {
        String encryptedKey = req.apiKey() != null ? encryptionService.encrypt(req.apiKey()) : null;
        return LlmProvider.builder()
            .agent(agent).type(req.type()).modelId(req.modelId()).baseUrl(req.baseUrl())
            .encryptedApiKey(encryptedKey).displayName(req.displayName())
            .temperature(req.temperature()           != null ? req.temperature()           : 0.7)
            .maxTokens(req.maxTokens()               != null ? req.maxTokens()             : 2048)
            .streamingEnabled(req.streamingEnabled() != null ? req.streamingEnabled()      : true)
            .requestTimeoutSeconds(req.requestTimeoutSeconds() != null ? req.requestTimeoutSeconds() : 60)
            .rateLimitRpm(req.rateLimitRpm()         != null ? req.rateLimitRpm()          : 30)
            .primary(primary).extraParams(req.extraParams())
            .build();
    }
}
