package com.creativeai.generation.service;

import com.creativeai.generation.exception.PublishNotAllowedException;
import com.creativeai.generation.exception.ResourceNotFoundException;
import com.creativeai.generation.model.GenerationJob;
import com.creativeai.generation.model.JobStatus;
import com.creativeai.generation.repository.GenerationJobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Écriture des jobs dans des transactions indépendantes, commitées avant
 * l'envoi de la commande Kafka.
 *
 * En effet le worker peut répondre très vite : si le job n'était visible qu'au
 * commit de la transaction appelante, le message de résultat pourrait être
 * consommé avant que la ligne existe et serait alors jeté. Chaque écriture est
 * donc validée dans sa propre transaction, et un échec d'envoi de commande est
 * enregistré sans annuler l'historique du job.
 */
@Component
@RequiredArgsConstructor
public class GenerationJobStore {

    private final GenerationJobRepository repository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public GenerationJob create(GenerationJob job) {
        return repository.save(job);
    }

    /**
     * Repasse un job en QUEUED avec une nouvelle executionVersion. Les résultats
     * de la version précédente deviennent caduques.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public GenerationJob requeue(String jobId, String userEmail) {
        GenerationJob job = repository.findByJobIdAndUserEmail(jobId, userEmail)
            .orElseThrow(() -> ResourceNotFoundException.of("Job", jobId));
        if (job.getStatus() == JobStatus.PROCESSING || job.getStatus() == JobStatus.QUEUED) {
            throw new PublishNotAllowedException("JOB_RUNNING",
                "Le job " + jobId + " est encore " + job.getStatus() + ".");
        }
        job.setExecutionVersion(job.getExecutionVersion() + 1);
        job.setStatus(JobStatus.QUEUED);
        job.setStage("QUEUED");
        job.setProgress(0);
        job.setErrorCode(null);
        job.setErrorMessage(null);
        job.setProviderTaskId(null);
        job.setCompletedAt(null);
        job.setUpdatedAt(LocalDateTime.now());
        return repository.save(job);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public GenerationJob markCommandRejected(String jobId, String stage, String errorMessage) {
        GenerationJob job = repository.findByJobId(jobId)
            .orElseThrow(() -> ResourceNotFoundException.of("Job", jobId));
        job.setStatus(JobStatus.FAILED);
        job.setStage(stage);
        job.setErrorCode("COMMAND_REJECTED");
        job.setErrorMessage(errorMessage != null && errorMessage.length() > 1000
            ? errorMessage.substring(0, 1000) : errorMessage);
        job.setCompletedAt(LocalDateTime.now());
        job.setUpdatedAt(LocalDateTime.now());
        return repository.save(job);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public GenerationJob markPreparationFailed(String jobId, String errorCode, String errorMessage) {
        GenerationJob job = repository.findByJobId(jobId)
            .orElseThrow(() -> ResourceNotFoundException.of("Job", jobId));
        job.setStatus(JobStatus.FAILED);
        job.setStage("PREPARING_STORYBOARD");
        job.setErrorCode(errorCode);
        job.setErrorMessage(errorMessage != null && errorMessage.length() > 1000
            ? errorMessage.substring(0, 1000) : errorMessage);
        job.setCompletedAt(LocalDateTime.now());
        job.setUpdatedAt(LocalDateTime.now());
        return repository.save(job);
    }
}
