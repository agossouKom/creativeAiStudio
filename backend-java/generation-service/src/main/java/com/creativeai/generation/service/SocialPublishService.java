package com.creativeai.generation.service;

import com.creativeai.generation.dto.PublishRequest;
import com.creativeai.generation.dto.SocialPublishRequestResponse;
import com.creativeai.generation.exception.PlatformApiException;
import com.creativeai.generation.exception.PublishNotAllowedException;
import com.creativeai.generation.exception.ResourceNotFoundException;
import com.creativeai.generation.model.GenerationJob;
import com.creativeai.generation.model.GenerationOutput;
import com.creativeai.generation.model.JobStatus;
import com.creativeai.generation.model.PublishStatus;
import com.creativeai.generation.model.SocialPublishRequest;
import com.creativeai.generation.repository.GenerationJobRepository;
import com.creativeai.generation.repository.GenerationOutputRepository;
import com.creativeai.generation.repository.SocialPublishRequestRepository;
import com.creativeai.generation.social.PlatformCapabilities;
import com.creativeai.generation.social.SocialPlatform;
import com.creativeai.generation.social.SocialPlatformRegistry;
import com.creativeai.generation.social.SupportLevel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Slf4j
@Service
public class SocialPublishService {

    /** Au-delà, on ne relance plus : l'utilisateur doit d'abord corriger la cause. */
    private static final int MAX_ATTEMPTS = 3;
    private static final int MAX_CAPTION_LENGTH = 2200;
    private static final Pattern SAFE_REMOTE_ID = Pattern.compile("[A-Za-z0-9_.-]{1,255}");

    private final GenerationJobRepository jobRepository;
    private final GenerationOutputRepository outputRepository;
    private final SocialPublishRequestRepository publishRepository;
    private final SocialPlatformRegistry registry;
    private final SocialMediaReferenceResolver referenceResolver;
    private final AgentTeamSocialClient agentTeamClient;
    private final PublishRequestStore store;
    private final boolean publishEnabled;

    public SocialPublishService(GenerationJobRepository jobRepository,
                                GenerationOutputRepository outputRepository,
                                SocialPublishRequestRepository publishRepository,
                                SocialPlatformRegistry registry,
                                SocialMediaReferenceResolver referenceResolver,
                                AgentTeamSocialClient agentTeamClient,
                                PublishRequestStore store,
                                @Value("${generation.publish.enabled:false}") boolean publishEnabled) {
        this.jobRepository = jobRepository;
        this.outputRepository = outputRepository;
        this.publishRepository = publishRepository;
        this.registry = registry;
        this.referenceResolver = referenceResolver;
        this.agentTeamClient = agentTeamClient;
        this.store = store;
        this.publishEnabled = publishEnabled;
    }

    public SocialPublishRequestResponse publish(String jobId, int outputIndex, String userEmail,
                                                PublishRequest request, String callerToken) {
        GenerationJob job = requireJob(jobId, userEmail);
        GenerationOutput output = requireOutput(job, outputIndex);
        PlatformCapabilities capabilities = requirePublishable(request.platform(), job);
        requireAgentId(request.agentId());

        String mediaReference = referenceResolver.resolve(capabilities, output);
        String caption = caption(request.caption(), job);

        SocialPublishRequest entity = store.create(SocialPublishRequest.builder()
            .requestId(UUID.randomUUID().toString())
            .jobId(jobId)
            .executionVersion(job.getExecutionVersion())
            .outputIndex(outputIndex)
            .userEmail(userEmail)
            .platform(request.platform())
            .agentId(request.agentId())
            .status(PublishStatus.PENDING)
            .caption(caption)
            .attempts(0)
            .build());

        return dispatch(entity, capabilities, caption, mediaReference, callerToken);
    }

    public SocialPublishRequestResponse retry(String requestId, String userEmail, String callerToken) {
        SocialPublishRequest entity = publishRepository.findByRequestIdAndUserEmail(requestId, userEmail)
            .orElseThrow(() -> ResourceNotFoundException.of("Demande de publication", requestId));
        if (entity.getStatus() == PublishStatus.PUBLISHED) {
            throw new PublishNotAllowedException("ALREADY_PUBLISHED",
                "La demande " + requestId + " a déjà abouti.");
        }
        if (entity.getStatus() == PublishStatus.PENDING || entity.getStatus() == PublishStatus.DISPATCHED) {
            throw new PublishNotAllowedException("DISPATCH_IN_PROGRESS",
                "La demande " + requestId + " est " + entity.getStatus()
                    + " : l'issue de l'envoi précédent est inconnue, une relance risquerait "
                    + "de publier deux fois le même contenu. Vérifiez la plateforme avant de relancer.");
        }
        if (entity.getAttempts() != null && entity.getAttempts() >= MAX_ATTEMPTS) {
            throw new PublishNotAllowedException("MAX_ATTEMPTS_REACHED",
                "La demande " + requestId + " a atteint " + MAX_ATTEMPTS + " tentatives.");
        }
        GenerationJob job = requireJob(entity.getJobId(), userEmail);
        GenerationOutput output = requireOutput(job.getJobId(), requestVersion(entity), entity.getOutputIndex());
        PlatformCapabilities capabilities = requirePublishable(entity.getPlatform(), job);
        requireAgentId(entity.getAgentId());

        String mediaReference = referenceResolver.resolve(capabilities, output);
        return dispatch(entity, capabilities, entity.getCaption(), mediaReference, callerToken);
    }

    public SocialPublishRequestResponse get(String requestId, String userEmail) {
        return toResponse(publishRepository.findByRequestIdAndUserEmail(requestId, userEmail)
            .orElseThrow(() -> ResourceNotFoundException.of("Demande de publication", requestId)));
    }

    public Page<SocialPublishRequest> list(String userEmail, int page, int size) {
        return publishRepository.findByUserEmailOrderByCreatedAtDesc(userEmail,
            PageRequest.of(Math.max(0, page), clampSize(size)));
    }

    public List<SocialPublishRequest> listForJob(String jobId, String userEmail) {
        requireJob(jobId, userEmail);
        return publishRepository.findByJobIdOrderByCreatedAtDesc(jobId);
    }

    public List<SocialPublishRequestResponse> toResponses(List<SocialPublishRequest> requests) {
        return requests.stream().map(this::toResponse).toList();
    }

    // ── interne ────────────────────────────────────────────────────────────────

    private SocialPublishRequestResponse dispatch(SocialPublishRequest entity,
                                                  PlatformCapabilities capabilities,
                                                  String caption, String mediaReference,
                                                  String callerToken) {
        store.markDispatched(entity.getId(), null);
        try {
            AgentTeamSocialClient.AgentPostResult result = agentTeamClient.publish(
                entity.getAgentId(), entity.getPlatform(), caption, List.of(mediaReference), callerToken);
            if (!result.success()) {
                String error = result.error() != null ? result.error() : "réponse négative de la plateforme";
                throw new PlatformApiException("PLATFORM_REJECTED", error);
            }
            String remoteId = sanitizeRemoteId(result.messageId());
            return toResponse(store.markPublished(entity.getId(), remoteId,
                permalink(capabilities.platform(), remoteId)));
        } catch (PlatformApiException e) {
            store.markFailed(entity.getId(), e.getCode(), e.getMessage());
            throw e;
        }
    }

    private GenerationJob requireJob(String jobId, String userEmail) {
        return jobRepository.findByJobIdAndUserEmail(jobId, userEmail)
            .orElseThrow(() -> ResourceNotFoundException.of("Job", jobId));
    }

    private GenerationOutput requireOutput(GenerationJob job, int outputIndex) {
        return requireOutput(job.getJobId(), job.getExecutionVersion(), outputIndex);
    }

    /**
     * La sortie est cherchée dans la version d'exécution enregistrée sur la demande
     * de publication, pas dans la version courante du job : après une relance de
     * génération, un index peut viser un autre fichier, voire n'exister plus.
     */
    private GenerationOutput requireOutput(String jobId, Integer executionVersion, int outputIndex) {
        if (outputIndex < 0) {
            throw new IllegalArgumentException("outputIndex doit être >= 0");
        }
        int version = executionVersion != null ? executionVersion : 0;
        return outputRepository.findByJobIdAndExecutionVersionAndOutputIndex(
                jobId, version, outputIndex)
            .orElseThrow(() -> ResourceNotFoundException.of("Sortie",
                jobId + "#" + outputIndex + " (version " + version + ")"));
    }

    private int requestVersion(SocialPublishRequest entity) {
        return entity.getExecutionVersion() != null ? entity.getExecutionVersion() : 0;
    }

    /**
     * Toutes les contraintes de publication sont vérifiées ici, avant tout appel
     * externe : job terminé, adaptateur existant, type de média accepté, publication
     * activée, agent identifié.
     */
    private PlatformCapabilities requirePublishable(SocialPlatform platform, GenerationJob job) {
        if (job.getStatus() != JobStatus.DONE) {
            throw new PublishNotAllowedException("JOB_NOT_READY",
                "Le job " + job.getJobId() + " est " + job.getStatus()
                    + " : aucune sortie publiée avant le statut DONE.");
        }
        PlatformCapabilities capabilities = registry.get(platform);
        if (capabilities.supportLevel() != SupportLevel.LIVE) {
            throw new PublishNotAllowedException("PLATFORM_NOT_AVAILABLE",
                platform + " n'a pas d'adaptateur dans cette installation. " + capabilities.notes());
        }
        if (!capabilities.accepts(job.getMediaType())) {
            throw new PublishNotAllowedException("PLATFORM_MEDIA_UNSUPPORTED",
                platform + " n'accepte pas les sorties " + job.getMediaType() + ".");
        }
        if (!publishEnabled) {
            throw new PublishNotAllowedException("SOCIAL_PUBLISH_DISABLED",
                "La publication sociale est désactivée (SOCIAL_PUBLISH_ENABLED=false).");
        }
        return capabilities;
    }

    private void requireAgentId(String agentId) {
        if (agentId == null || agentId.isBlank()) {
            throw new PublishNotAllowedException("AGENT_ID_REQUIRED",
                "agentId est obligatoire : il désigne l'agent dont les canaux connectés "
                    + "portent les credentials de la plateforme.");
        }
    }

    private String caption(String requested, GenerationJob job) {
        String text = requested != null && !requested.isBlank() ? requested.trim() : job.getPrompt();
        return text.length() <= MAX_CAPTION_LENGTH ? text : text.substring(0, MAX_CAPTION_LENGTH);
    }

    private String sanitizeRemoteId(String remoteId) {
        if (remoteId == null || remoteId.isBlank()) {
            return null;
        }
        return SAFE_REMOTE_ID.matcher(remoteId.trim()).matches() ? remoteId.trim() : null;
    }

    private String permalink(SocialPlatform platform, String remoteId) {
        if (remoteId == null) {
            return null;
        }
        return switch (platform) {
            case FACEBOOK -> "https://www.facebook.com/" + remoteId;
            case INSTAGRAM -> "https://www.instagram.com/p/" + remoteId;
            default -> null;
        };
    }

    private int clampSize(int size) {
        return Math.min(Math.max(size, 1), 100);
    }

    SocialPublishRequestResponse toResponse(SocialPublishRequest request) {
        var error = request.getErrorCode() == null && request.getErrorMessage() == null
            ? null
            : new com.creativeai.generation.dto.GenerationJobResponse.ErrorInfo(
                request.getErrorCode(), request.getErrorMessage());
        return new SocialPublishRequestResponse(
            request.getRequestId(),
            request.getJobId(),
            request.getExecutionVersion() != null ? request.getExecutionVersion() : 0,
            request.getOutputIndex() != null ? request.getOutputIndex() : 0,
            request.getPlatform(),
            request.getAgentId(),
            request.getStatus(),
            request.getCaption(),
            request.getRemoteMediaId(),
            request.getRemotePermalink(),
            error,
            request.getAttempts() != null ? request.getAttempts() : 0,
            request.getCreatedAt(),
            request.getSubmittedAt(),
            request.getPublishedAt());
    }
}
