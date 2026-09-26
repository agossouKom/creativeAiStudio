package com.creativeai.generation.service;

import com.creativeai.generation.messaging.GenerationResultMapper;
import com.creativeai.generation.messaging.GenerationResultMapper.ResultUpdate;
import com.creativeai.generation.messaging.GenerationResultMapper.StoredOutput;
import com.creativeai.generation.model.GenerationJob;
import com.creativeai.generation.model.GenerationOutput;
import com.creativeai.generation.model.JobStatus;
import com.creativeai.generation.repository.GenerationJobRepository;
import com.creativeai.generation.repository.GenerationOutputRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
public class GenerationResultService {

    private final GenerationJobRepository jobRepository;
    private final GenerationOutputRepository outputRepository;
    private final ObjectMapper objectMapper;
    private final GenerationResultMapper mapper;

    public GenerationResultService(GenerationJobRepository jobRepository,
                                   GenerationOutputRepository outputRepository,
                                   ObjectMapper objectMapper) {
        this.jobRepository = jobRepository;
        this.outputRepository = outputRepository;
        this.objectMapper = objectMapper;
        this.mapper = new GenerationResultMapper(objectMapper);
    }

    /**
     * Un message dont le userId ne correspond pas au propriétaire du job, ou dont
     * l'executionVersion est périmée (relance antérieure), est ignoré : seule la
     * version courante du job peut écrire dans son historique.
     *
     * Un résultat sans userId, ou portant sur un job inexistant, est rejeté
     * (exception) : l'erreur handler le retente puis l'envoie en DLQ plutôt que
     * de le laisser disparaître en silence.
     */
    @Transactional
    public void apply(String payload) {
        JsonNode root;
        try {
            root = objectMapper.readTree(payload);
        } catch (Exception e) {
            throw new IllegalArgumentException("Résultat de génération illisible", e);
        }
        String jobId = text(root, "jobId");
        String userId = text(root, "userId");
        Integer version = root.hasNonNull("executionVersion") ? root.get("executionVersion").asInt() : null;
        if (jobId == null) {
            throw new IllegalArgumentException("Résultat de génération sans jobId");
        }

        GenerationJob job = jobRepository.findByJobId(jobId).orElse(null);
        if (job == null) {
            throw new IllegalStateException("Résultat de génération pour un job inconnu: " + jobId);
        }
        if (userId == null) {
            throw new IllegalStateException(
                "Résultat de génération sans userId pour le job " + jobId + ": refusé");
        }
        if (!userId.equals(job.getUserEmail())) {
            throw new IllegalStateException("Résultat de génération rejeté: userId ne correspond pas au job " + jobId);
        }
        if (version == null) {
            throw new IllegalArgumentException("Résultat de génération sans executionVersion pour le job " + jobId);
        }
        if (!version.equals(job.getExecutionVersion())) {
            log.info("Résultat de génération ignoré (version {} périmée pour le job {} en version {})",
                version, jobId, job.getExecutionVersion());
            return;
        }

        ResultUpdate update = mapper.map(payload);
        job.setStatus(update.status());
        if (update.stage() != null) {
            job.setStage(update.stage());
        }
        if (update.progress() != null) {
            job.setProgress(update.progress());
        }
        if (update.provider() != null) {
            job.setProvider(update.provider());
        }
        if (update.providerTaskId() != null) {
            job.setProviderTaskId(update.providerTaskId());
        }

        if (update.status() == JobStatus.FAILED) {
            job.setErrorCode(update.errorCode());
            job.setErrorMessage(update.errorMessage());
            job.setCompletedAt(LocalDateTime.now());
        }
        if (update.status() == JobStatus.DONE) {
            job.setErrorCode(null);
            job.setErrorMessage(null);
            job.setCompletedAt(LocalDateTime.now());
            replaceOutputs(jobId, version, update.outputs());
        }
        jobRepository.save(job);
    }

    private void replaceOutputs(String jobId, Integer version, List<StoredOutput> outputs) {
        outputRepository.deleteByJobIdAndExecutionVersion(jobId, version);
        outputRepository.flush();
        for (StoredOutput output : outputs) {
            outputRepository.save(GenerationOutput.builder()
                .jobId(jobId)
                .executionVersion(version)
                .outputIndex(output.index())
                .bucket(output.bucket())
                .objectKey(output.objectKey())
                .sizeBytes(output.sizeBytes() != null ? output.sizeBytes() : 0L)
                .sha256(output.sha256())
                .contentType(output.contentType())
                .build());
        }
    }

    private String text(JsonNode node, String field) {
        if (node == null) {
            return null;
        }
        JsonNode value = node.get(field);
        if (value == null || value.isNull() || !value.isTextual()) {
            return null;
        }
        String normalized = value.asText().trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
