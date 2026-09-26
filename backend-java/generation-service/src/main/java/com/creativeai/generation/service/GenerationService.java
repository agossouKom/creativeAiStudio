package com.creativeai.generation.service;

import com.creativeai.generation.dto.CreateImageRequest;
import com.creativeai.generation.dto.CreateVideoRequest;
import com.creativeai.generation.dto.GenerationJobResponse;
import com.creativeai.generation.dto.GenerationOutputResponse;
import com.creativeai.generation.dto.ImageOptionsRequest;
import com.creativeai.generation.dto.PageResponse;
import com.creativeai.generation.dto.VideoOptionsRequest;
import com.creativeai.generation.exception.PlatformApiException;
import com.creativeai.generation.exception.PublishNotAllowedException;
import com.creativeai.generation.exception.ResourceNotFoundException;
import com.creativeai.generation.messaging.GenerationCommandFactory;
import com.creativeai.generation.messaging.GenerationCommandPublisher;
import com.creativeai.generation.model.GenerationJob;
import com.creativeai.generation.model.GenerationOutput;
import com.creativeai.generation.model.JobStatus;
import com.creativeai.generation.model.MediaType;
import com.creativeai.generation.repository.GenerationJobRepository;
import com.creativeai.generation.repository.GenerationOutputRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
public class GenerationService {

    private final GenerationJobRepository jobRepository;
    private final GenerationOutputRepository outputRepository;
    private final GenerationCommandFactory commandFactory;
    private final GenerationCommandPublisher commandPublisher;
    private final MediaStorageService storageService;
    private final AgentTeamGenerationClient agentTeamGenerationClient;
    private final GenerationJobStore jobStore;
    private final ObjectMapper objectMapper;

    public GenerationService(GenerationJobRepository jobRepository,
                             GenerationOutputRepository outputRepository,
                             GenerationCommandFactory commandFactory,
                             GenerationCommandPublisher commandPublisher,
                             MediaStorageService storageService,
                             AgentTeamGenerationClient agentTeamGenerationClient,
                             GenerationJobStore jobStore,
                             ObjectMapper objectMapper) {
        this.jobRepository = jobRepository;
        this.jobStore = jobStore;
        this.outputRepository = outputRepository;
        this.commandFactory = commandFactory;
        this.commandPublisher = commandPublisher;
        this.storageService = storageService;
        this.agentTeamGenerationClient = agentTeamGenerationClient;
        this.objectMapper = objectMapper;
    }

    public GenerationJobResponse createVideo(
            CreateVideoRequest request, String userEmail, String callerToken) {
        VideoOptionsRequest options = request.options().normalized();
        GenerationJob job = newJob(MediaType.VIDEO, request.prompt(), null, optionsJson(options),
            userEmail);
        job.setAgentId(request.agentId());
        List<JsonNode> storyboards = request.agentId() == null || request.agentId().isBlank()
            ? List.of()
            : agentTeamGenerationClient.generateStoryboards(
                request.agentId(), job.getPrompt(), options.clipDurationSeconds(),
                options.language(), options.videoCount(), callerToken);
        String payload = commandFactory.videoCommand(job, options, storyboards);
        jobRepository.save(job);
        try {
            commandPublisher.publishVideo(job.getJobId(), payload);
        } catch (RuntimeException e) {
            job.setStatus(JobStatus.FAILED);
            job.setStage("QUEUED");
            job.setErrorCode("COMMAND_REJECTED");
            job.setErrorMessage(e.getMessage());
            jobRepository.save(job);
            throw e;
        }
        return toResponse(job, List.of());
    }

    public GenerationJobResponse createImage(CreateImageRequest request, String userEmail) {
        ImageOptionsRequest options = request.options().normalized();
        GenerationJob job = newJob(MediaType.IMAGE, request.prompt(), request.negativePrompt(),
            optionsJson(options), userEmail);
        String payload = commandFactory.imageCommand(job, options);
        jobRepository.save(job);
        try {
            commandPublisher.publishImage(job.getJobId(), payload);
        } catch (RuntimeException e) {
            job.setStatus(JobStatus.FAILED);
            job.setStage("VALIDATING");
            job.setErrorCode("COMMAND_REJECTED");
            job.setErrorMessage(e.getMessage());
            jobRepository.save(job);
            throw e;
        }
        return toResponse(job, List.of());
    }

    /**
     * Relance le job avec les mêmes options : l'executionVersion est incrémentée,
     * donc les résultats d'une exécution précédente deviennent caduques et sont ignorés.
     */
    public GenerationJobResponse retry(String jobId, String userEmail, String callerToken) {
        GenerationJob job = jobStore.requeue(jobId, userEmail);

        JsonNode options = parseOptions(job.getOptionsJson());
        VideoOptionsRequest videoOptions = job.getMediaType() == MediaType.VIDEO
            ? objectMapper.convertValue(options, VideoOptionsRequest.class)
            : null;
        List<JsonNode> storyboards;
        try {
            storyboards = videoOptions != null && job.getAgentId() != null
                ? agentTeamGenerationClient.generateStoryboards(
                    job.getAgentId(), job.getPrompt(), videoOptions.clipDurationSeconds(),
                    videoOptions.language(), videoOptions.videoCount(), callerToken)
                : List.of();
        } catch (PlatformApiException e) {
            jobStore.markPreparationFailed(job.getJobId(), e.getCode(), e.getMessage());
            throw e;
        }
        String payload = job.getMediaType() == MediaType.VIDEO
            ? commandFactory.videoCommand(job, videoOptions, storyboards)
            : commandFactory.imageCommand(job, objectMapper.convertValue(options, ImageOptionsRequest.class));
        try {
            if (job.getMediaType() == MediaType.VIDEO) {
                commandPublisher.publishVideo(job.getJobId(), payload);
            } else {
                commandPublisher.publishImage(job.getJobId(), payload);
            }
        } catch (RuntimeException e) {
            jobStore.markCommandRejected(job.getJobId(), job.getStage(), e.getMessage());
            throw e;
        }
        return toResponse(job, List.of());
    }

    @Transactional(readOnly = true)
    public GenerationJobResponse get(String jobId, String userEmail) {
        GenerationJob job = requireJob(jobId, userEmail);
        return toResponse(job, outputs(job.getJobId(), job.getExecutionVersion()));
    }

    @Transactional(readOnly = true)
    public List<GenerationOutputResponse> outputs(String jobId, String userEmail) {
        GenerationJob job = requireJob(jobId, userEmail);
        return outputs(job.getJobId(), job.getExecutionVersion());
    }

    @Transactional(readOnly = true)
    public MediaStorageService.PresignedDownload downloadUrl(String jobId, int outputIndex, String userEmail) {
        GenerationJob job = requireJob(jobId, userEmail);
        if (job.getStatus() != JobStatus.DONE) {
            throw new PublishNotAllowedException("JOB_NOT_READY",
                "Le job " + jobId + " est " + job.getStatus() + " : aucune sortie à télécharger.");
        }
        GenerationOutput output = outputRepository
            .findByJobIdAndExecutionVersionAndOutputIndex(jobId, job.getExecutionVersion(), outputIndex)
            .orElseThrow(() -> ResourceNotFoundException.of("Sortie", jobId + "#" + outputIndex));
        return storageService.presignedDownload(output);
    }

    @Transactional(readOnly = true)
    public PageResponse<GenerationJobResponse> list(String userEmail, int page, int size) {
        Page<GenerationJob> jobs = jobRepository.findByUserEmailOrderByCreatedAtDesc(userEmail,
            PageRequest.of(Math.max(0, page), Math.min(Math.max(size, 1), 100)));
        return new PageResponse<>(
            jobs.getContent().stream().map(job -> toResponse(job, List.of())).toList(),
            jobs.getNumber(),
            jobs.getSize(),
            jobs.getTotalElements(),
            jobs.getTotalPages());
    }

    // ── interne ────────────────────────────────────────────────────────────────

    private GenerationJob newJob(MediaType mediaType, String prompt, String negativePrompt,
                                 String optionsJson, String userEmail) {
        return GenerationJob.builder()
            .jobId(UUID.randomUUID().toString())
            .userEmail(userEmail)
            .mediaType(mediaType)
            .status(JobStatus.QUEUED)
            .stage("QUEUED")
            .progress(0)
            .prompt(prompt.trim())
            .negativePrompt(negativePrompt != null && !negativePrompt.isBlank()
                ? negativePrompt.trim() : null)
            .optionsJson(optionsJson)
            .executionVersion(1)
            .build();
    }

    private GenerationJob requireJob(String jobId, String userEmail) {
        return jobRepository.findByJobIdAndUserEmail(jobId, userEmail)
            .orElseThrow(() -> ResourceNotFoundException.of("Job", jobId));
    }

    private List<GenerationOutputResponse> outputs(String jobId, Integer version) {
        return outputRepository.findByJobIdAndExecutionVersionOrderByOutputIndex(jobId, version).stream()
            .map(output -> new GenerationOutputResponse(
                output.getOutputIndex(),
                output.getBucket(),
                output.getObjectKey(),
                output.getSizeBytes() != null ? output.getSizeBytes() : 0L,
                output.getSha256(),
                output.getContentType()))
            .toList();
    }

    private String optionsJson(Object options) {
        try {
            return objectMapper.writeValueAsString(options);
        } catch (Exception e) {
            throw new IllegalStateException("Options de génération non sérialisables", e);
        }
    }

    private JsonNode parseOptions(String optionsJson) {
        try {
            return objectMapper.readTree(optionsJson);
        } catch (Exception e) {
            throw new IllegalStateException("Options de génération illisibles pour le job", e);
        }
    }

    private JsonNode safeOptions(String optionsJson) {
        if (optionsJson == null || optionsJson.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(optionsJson);
        } catch (Exception e) {
            log.warn("Options de génération illisibles pour le job, omises de la réponse", e);
            return null;
        }
    }

    GenerationJobResponse toResponse(GenerationJob job, List<GenerationOutputResponse> outputs) {
        var error = job.getErrorCode() == null && job.getErrorMessage() == null
            ? null
            : new GenerationJobResponse.ErrorInfo(job.getErrorCode(), job.getErrorMessage());
        return new GenerationJobResponse(
            job.getJobId(),
            job.getMediaType(),
            job.getStatus(),
            job.getStage(),
            job.getProgress() != null ? job.getProgress() : 0,
            job.getPrompt(),
            job.getNegativePrompt(),
            safeOptions(job.getOptionsJson()),
            job.getExecutionVersion(),
            job.getProvider(),
            job.getProviderTaskId(),
            error,
            job.getCreatedAt(),
            job.getUpdatedAt(),
            job.getCompletedAt(),
            outputs);
    }
}
