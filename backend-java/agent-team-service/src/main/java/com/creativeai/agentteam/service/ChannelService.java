package com.creativeai.agentteam.service;

import com.creativeai.agentteam.dto.request.ChannelRequest;
import com.creativeai.agentteam.dto.request.UpdateChannelRequest;
import com.creativeai.agentteam.dto.response.ChannelResponse;
import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.ChannelRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChannelService {

    private final ChannelRepository  channelRepo;
    private final AgentRepository    agentRepo;
    private final EncryptionService  encryptionService;
    private final AuditService       auditService;
    private final ObjectMapper       objectMapper;

    @Value("${app.public-url:http://localhost:8480}")
    private String publicUrl;

    // ── CRUD ────────────────────────────────────────────────────────────────

    @Transactional
    public ChannelResponse createChannel(String userId, String agentId, ChannelRequest req) {
        Agent agent = resolveAgent(userId, agentId);
        String config = injectMetaVerifyToken(req.type(), req.platformType(), req.config());
        Channel channel = Channel.builder()
            .agent(agent)
            .type(req.type())
            .platformType(req.platformType())
            .displayName(req.displayName())
            .encryptedCredentials(encryptionService.encrypt(req.credentials()))
            .config(config)
            .accountId(req.accountId())
            .accountName(req.accountName())
            .build();
        Channel saved = channelRepo.save(channel);
        auditService.log(userId, agentId, null, "CREATE_CHANNEL", "channel", saved.getId(), true,
            AuditService.details("type", req.type(), "displayName", req.displayName()));
        log.info("Channel created: {} [{}] for agent {}", req.displayName(), req.type(), agentId);
        return ChannelResponse.fromWithUrl(saved, publicUrl);
    }

    @Transactional(readOnly = true)
    public List<ChannelResponse> listChannels(String userId, String agentId) {
        resolveAgent(userId, agentId);
        return channelRepo.findByAgentIdAndDeletedFalse(agentId)
            .stream().map(c -> ChannelResponse.fromWithUrl(c, publicUrl)).toList();
    }

    @Transactional(readOnly = true)
    public ChannelResponse getChannel(String userId, String agentId, String channelId) {
        resolveAgent(userId, agentId);
        return ChannelResponse.fromWithUrl(resolveChannel(agentId, channelId), publicUrl);
    }

    @Transactional
    public ChannelResponse updateChannel(String userId, String agentId, String channelId, UpdateChannelRequest req) {
        resolveAgent(userId, agentId);
        Channel channel = resolveChannel(agentId, channelId);
        if (req.displayName()  != null) channel.setDisplayName(req.displayName());
        if (req.platformType() != null) channel.setPlatformType(req.platformType());
        if (req.credentials()  != null) channel.setEncryptedCredentials(encryptionService.encrypt(req.credentials()));
        if (req.config()       != null) channel.setConfig(req.config());
        if (req.accountId()    != null) channel.setAccountId(req.accountId());
        if (req.accountName()  != null) channel.setAccountName(req.accountName());
        Channel saved = channelRepo.save(channel);
        auditService.log(userId, agentId, null, "UPDATE_CHANNEL", "channel", channelId, true,
            AuditService.details("displayName", channel.getDisplayName(), "type", channel.getType()));
        return ChannelResponse.fromWithUrl(saved, publicUrl);
    }

    // ── Connexion / Déconnexion ──────────────────────────────────────────────

    @Transactional
    public ChannelResponse connect(String userId, String agentId, String channelId) {
        resolveAgent(userId, agentId);
        Channel channel = resolveChannel(agentId, channelId);
        channel.setStatus(ChannelStatus.CONNECTED);
        Channel saved = channelRepo.save(channel);
        auditService.log(userId, agentId, null, "CONNECT_CHANNEL", "channel", channelId, true,
            AuditService.details("type", channel.getType(), "accountId", channel.getAccountId()));
        return ChannelResponse.fromWithUrl(saved, publicUrl);
    }

    @Transactional
    public ChannelResponse disconnect(String userId, String agentId, String channelId) {
        resolveAgent(userId, agentId);
        Channel channel = resolveChannel(agentId, channelId);
        channel.setStatus(ChannelStatus.DISCONNECTED);
        Channel saved = channelRepo.save(channel);
        auditService.log(userId, agentId, null, "DISCONNECT_CHANNEL", "channel", channelId, true,
            AuditService.details("type", channel.getType()));
        return ChannelResponse.fromWithUrl(saved, publicUrl);
    }

    // ── Soft-delete / Restore ────────────────────────────────────────────────

    @Transactional
    public void deleteChannel(String userId, String agentId, String channelId) {
        resolveAgent(userId, agentId);
        Channel channel = resolveChannel(agentId, channelId);
        channel.setDeleted(true);
        channel.setStatus(ChannelStatus.DISCONNECTED);
        channelRepo.save(channel);
        auditService.log(userId, agentId, null, "DELETE_CHANNEL", "channel", channelId, true,
            AuditService.details("type", channel.getType(), "displayName", channel.getDisplayName(), "softDelete", true));
    }

    @Transactional(readOnly = true)
    public List<ChannelResponse> listDeletedChannels(String userId, String agentId) {
        resolveAgent(userId, agentId);
        return channelRepo.findAll().stream()
            .filter(c -> c.getAgent().getId().equals(agentId) && c.isDeleted())
            .map(c -> ChannelResponse.fromWithUrl(c, publicUrl)).toList();
    }

    @Transactional
    public ChannelResponse restoreChannel(String userId, String agentId, String channelId) {
        resolveAgent(userId, agentId);
        Channel channel = channelRepo.findById(channelId)
            .filter(c -> c.getAgent().getId().equals(agentId) && c.isDeleted())
            .orElseThrow(() -> new ResourceNotFoundException("Canal supprimé introuvable : " + channelId));
        channel.setDeleted(false);
        channel.setStatus(ChannelStatus.DISCONNECTED);
        Channel saved = channelRepo.save(channel);
        auditService.log(userId, agentId, null, "RESTORE_CHANNEL", "channel", channelId, true,
            AuditService.details("type", channel.getType(), "displayName", channel.getDisplayName()));
        return ChannelResponse.fromWithUrl(saved, publicUrl);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Vérifie que l'agent appartient bien à l'appelant et le renvoie.
     *
     * <p>Point d'entrée unique pour les endpoints qui agissent sur les canaux
     * <em>sans</em> passer par le CRUD : c'est le seul moyen fiable dEMPêcher
     * qu'un utilisateur authentifié agisse sur l'agent d'un autre. Le refus est
     * un 404 et non un 403 — un agent existant mais appartenant à quelqu'un
     * d'autre ne doit pas être distinguable d'un agent inexistant, sinon
     * l'endpoint devient un oracle d'existence.
     *
     * <p>Les services qui résolvent un canal par {@code agentId} seul
     * (ChannelSenderService, InstagramService) ne peuvent pas s'en servir
     * eux-mêmes : c'est au contrôleur, seul à posséder l'identité de
     * l'appelant, d'appeler ce garde-fou avant de leur déléguer.
     */
    @Transactional(readOnly = true)
    public Agent requireOwnedAgent(String userId, String agentId) {
        if (userId == null || userId.isBlank()) {
            throw new ResourceNotFoundException("Agent introuvable : " + agentId);
        }
        return resolveAgent(userId, agentId);
    }

    private Agent resolveAgent(String userId, String agentId) {
        return agentRepo.findByIdAndOwnerIdAndDeletedFalse(agentId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent introuvable : " + agentId));
    }

    private Channel resolveChannel(String agentId, String channelId) {
        return channelRepo.findByIdAndAgentIdAndDeletedFalse(channelId, agentId)
            .orElseThrow(() -> new ResourceNotFoundException("Canal introuvable : " + channelId));
    }

    /**
     * Pour un canal SOCIAL_MEDIA Meta (FACEBOOK ou INSTAGRAM), injecte un
     * `verifyToken` unique dans le JSON de config si aucun n'est déjà présent.
     *
     * <p>Instagram est inclus parce que son webhook se configure exactement comme
     * celui de Facebook : même tableau de bord Meta, même principe de jeton par
     * canal. Sans ce token, {@code ChannelResponse.verifyToken} aurait valu
     * {@code null} et le canal Instagram n'avait aucun moyen d'être vérifié par Meta.
     */
    private String injectMetaVerifyToken(ChannelType type, PlatformType platform, String config) {
        if (type != ChannelType.SOCIAL_MEDIA) return config;
        boolean metaPlatform = platform == PlatformType.FACEBOOK || platform == PlatformType.INSTAGRAM;
        if (!metaPlatform) return config;
        try {
            ObjectNode node = config != null && !config.isBlank()
                ? (ObjectNode) objectMapper.readTree(config)
                : objectMapper.createObjectNode();
            if (!node.has("verifyToken") || node.get("verifyToken").asText().isBlank()) {
                node.put("verifyToken", UUID.randomUUID().toString());
            }
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            log.warn("[CHANNEL] Impossible d'injecter verifyToken dans config: {}", e.getMessage());
            return config;
        }
    }
}
