package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.AgentTask;
import com.creativeai.agentteam.model.enums.TaskStatus;
import com.creativeai.agentteam.orchestrator.AgentOrchestrator;
import com.creativeai.agentteam.repository.AgentTaskRepository;
import org.springframework.beans.factory.annotation.Value;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.List;

/**
 * Exécute les tâches planifiées (source=SCHEDULED, status=PENDING) dont la date est dépassée.
 * Tourne toutes les minutes — même pattern que WorkflowSchedulerService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "agent.task-scheduler-enabled", matchIfMissing = true)
public class TaskSchedulerService {

    private final AgentTaskRepository taskRepo;
    private final AgentOrchestrator   orchestrator;
    private final ObjectMapper        objectMapper;

    @Value("${minio.public-url:http://localhost:9400}")
    private String minioPublicUrl;

    @Scheduled(cron = "0 * * * * *")
    @Transactional
    public void processScheduledTasks() {
        List<AgentTask> due = taskRepo.findDueScheduledTasks(LocalDateTime.now());

        if (due.isEmpty()) return;

        log.info("[TASK-SCHEDULER] {} tâche(s) planifiée(s) à déclencher", due.size());

        for (AgentTask task : due) {
            try {
                dispatchTask(task);
            } catch (Exception e) {
                log.error("[TASK-SCHEDULER] Erreur dispatch tâche id={} title='{}': {}",
                          task.getId(), task.getTitle(), e.getMessage(), e);
                task.setStatus(TaskStatus.FAILED);
                taskRepo.save(task);
            }
        }
    }

    @Scheduled(fixedDelay = 30000)
    @Transactional
    public void processSocialMediaTasks() {
        List<AgentTask> pending = taskRepo.findPendingSocialMediaTasks();

        if (pending.isEmpty()) return;

        log.info("[TASK-SCHEDULER] {} tâche(s) SOCIAL_MEDIA en attente", pending.size());

        for (AgentTask task : pending) {
            try {
                dispatchTask(task);
            } catch (Exception e) {
                log.error("[TASK-SCHEDULER] Erreur dispatch social task id={}: {}", task.getId(), e.getMessage());
                task.setStatus(TaskStatus.FAILED);
                taskRepo.save(task);
            }
        }
    }

    private void dispatchTask(AgentTask task) {
        String agentId = task.getAssignedAgentId();
        if (agentId == null || agentId.isBlank()) {
            log.warn("[TASK-SCHEDULER] Tâche {} sans agentId assigné — ignorée", task.getId());
            task.setStatus(TaskStatus.FAILED);
            taskRepo.save(task);
            return;
        }

        task.setStatus(TaskStatus.IN_PROGRESS);
        task.setStartedAt(LocalDateTime.now());
        taskRepo.save(task);

        String prompt = buildPrompt(task);
        String sessionId = "scheduled-" + task.getId();

        log.info("[TASK-SCHEDULER] Démarrage tâche id={} title='{}' agent={}",
                 task.getId(), task.getTitle(), agentId);

        orchestrator.chat(agentId, task.getUserId(), prompt, sessionId, null)
            .subscribe(
                token -> {},
                err -> {
                    log.error("[TASK-SCHEDULER] Erreur exécution tâche {}: {}", task.getId(), err.getMessage());
                    updateStatus(task.getId(), TaskStatus.FAILED);
                },
                () -> log.info("[TASK-SCHEDULER] Tâche {} exécutée avec succès", task.getId())
            );
    }

    private String buildPrompt(AgentTask task) {
        StringBuilder sb = new StringBuilder();
        boolean isSocial = task.getSource() != null &&
            task.getSource().name().equals("SOCIAL_MEDIA");

        sb.append(isSocial ? "[RÉPONSE AUTOMATIQUE — RÉSEAUX SOCIAUX]\n"
                           : "[TÂCHE PLANIFIÉE — EXÉCUTION AUTOMATIQUE]\n");
        sb.append("Tâche ID : ").append(task.getId()).append("\n");
        sb.append("Titre : ").append(task.getTitle()).append("\n");

        if (task.getDescription() != null && !task.getDescription().isBlank()) {
            sb.append("Description : ").append(task.getDescription()).append("\n");
        }
        if (task.getExpectedResult() != null && !task.getExpectedResult().isBlank()) {
            sb.append("Résultat attendu : ").append(task.getExpectedResult()).append("\n");
        }
        if (task.getContacts() != null && !task.getContacts().isBlank()) {
            sb.append("Contacts / Destinataires : ").append(task.getContacts()).append("\n");
        }
        if (task.isConfidential()) {
            sb.append("⚠ Cette tâche est CONFIDENTIELLE — ne pas divulguer son contenu.\n");
        }

        // Injection du snapshot produit avec URLs d'images
        if (task.getProductSnapshot() != null && !task.getProductSnapshot().isBlank()) {
            try {
                List<Map<String, Object>> products = objectMapper.readValue(
                    task.getProductSnapshot(), new TypeReference<>() {});
                if (!products.isEmpty()) {
                    sb.append("\n=== PRODUITS À PROMOUVOIR ===\n");
                    for (Map<String, Object> p : products) {
                        sb.append("- Nom : ").append(p.getOrDefault("nom", "")).append("\n");
                        sb.append("  Description : ").append(p.getOrDefault("description", "")).append("\n");
                        Object prix = p.get("prix");
                        if (prix != null) sb.append("  Prix : ").append(prix).append("\n");
                        Object photos = p.get("photos");
                        if (photos instanceof List<?> photoList && !photoList.isEmpty()) {
                            sb.append("  Images disponibles :\n");
                            for (Object url : photoList) {
                                String imageUrl = String.valueOf(url)
                                    .replace("http://localhost:9400", minioPublicUrl);
                                sb.append("    • ").append(imageUrl).append("\n");
                            }
                            sb.append("  → Utilise une de ces images dans post_social (paramètre mediaUrls).\n");
                        }
                    }
                    sb.append("==============================\n");
                }
            } catch (Exception e) {
                log.warn("[TASK-SCHEDULER] Impossible de parser productSnapshot pour tâche {}: {}", task.getId(), e.getMessage());
            }
        }

        // Plateformes cibles
        if (task.getPlatforms() != null && !task.getPlatforms().isBlank()) {
            try {
                List<String> platforms = objectMapper.readValue(task.getPlatforms(), new TypeReference<>() {});
                if (!platforms.isEmpty()) {
                    sb.append("Plateformes cibles : ").append(String.join(", ", platforms)).append("\n");
                }
            } catch (Exception ignored) {}
        }

        if (isSocial) {
            sb.append("\nExécute cette tâche maintenant en utilisant les outils de réseaux sociaux disponibles.");
        } else {
            sb.append("\nExécute cette tâche maintenant. ");
            sb.append("Une fois terminé, utilise deliver_result pour déposer le rapport dans l'inbox.");
        }

        return sb.toString();
    }

    private void updateStatus(String taskId, TaskStatus status) {
        taskRepo.findByIdAndDeletedFalse(taskId).ifPresent(t -> {
            t.setStatus(status);
            taskRepo.save(t);
        });
    }
}
