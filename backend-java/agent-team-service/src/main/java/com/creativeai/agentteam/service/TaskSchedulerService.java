package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.AgentTask;
import reactor.core.publisher.Flux;

import com.creativeai.agentteam.model.enums.TaskSource;
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

    /**
     * Délai au-delà duquel une tâche IN_PROGRESS est considérée comme orpheline et
     * remise en PENDING. Un agent qui plante, ou un conteneur qui redémarre
     * entre le claim et la fin, laisserait sinon la tâche bloquée pour toujours.
     */
    @Value("${agent.task-stale-after-minutes:30}")
    private long staleAfterMinutes;

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
                markFailed(task.getId());
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
                markFailed(task.getId());
            }
        }
    }

    /**
     * Remet en PENDING les tâches qu'aucun agent n'a terminées dans les temps.
     * Le claim atomique de {@link #dispatchTask} rend la tâche invisible aux deux
     * pollers pendant son exécution ; sans ce rattrapage, un agent mort la
     * laisserait IN_PROGRESS à jamais.
     */
    @Scheduled(fixedDelay = 300000, initialDelay = 300000)
    @Transactional
    public void releaseStaleTasks() {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(staleAfterMinutes);
        int released = taskRepo.releaseStuckTasks(threshold);
        if (released > 0) {
            log.warn("[TASK-SCHEDULER] {} tâche(s) IN_PROGRESS depuis plus de {} min remise(s) en PENDING",
                released, staleAfterMinutes);
        }
    }

    /**
     * Prend la responsabilité d'une tâche avant de l'exécuter, puis la lance.
     *
     * <p>Le passage en IN_PROGRESS est un UPDATE conditionnel sur le statut :
     * seul le poller dont l'écriture modifie réellement une ligne reçoit 1 et
     * continue. L'autre reçoit 0 et saute la tâche. C'est ce qui rend la
     * publication sociale idempotente entre les deux pollers, qui lisent les
     * mêmes lignes à la même seconde.
     *
     * <p>Le {@code taskId} est transmis à l'orchestrateur : sans lui, la tâche
     * restait IN_PROGRESS même en cas de succès, l'agent devant appeler
     * lui-même {@code update_task_status} pour la clore.
     */
    private void dispatchTask(AgentTask task) {
        String agentId = task.getAssignedAgentId();
        if (agentId == null || agentId.isBlank()) {
            log.warn("[TASK-SCHEDULER] Tâche {} sans agentId assigné — ignorée", task.getId());
            markFailed(task.getId());
            return;
        }

        if (taskRepo.claimTask(task.getId(), LocalDateTime.now()) == 0) {
            // Claim perdu : un autre poller, ou une passe précédente, a déjà
            // pris cette tâche. Ne surtout pas exécuter — pour une tâche sociale
            // cela publierait deux fois.
            log.debug("[TASK-SCHEDULER] Tâche {} déjà claimée — ignorée", task.getId());
            return;
        }

        String prompt = buildPrompt(task);
        String sessionId = "scheduled-" + task.getId();

        log.info("[TASK-SCHEDULER] Démarrage tâche id={} title='{}' agent={}",
                 task.getId(), task.getTitle(), agentId);

        List<String> requiredTools = requiredToolsFor(task);
        // Chemin nominal inchangé quand rien n'est exigé en plus : seule une tâche
        // sociale passe par chatWithTools, qui ajoute les outils au lieu de
        // remplacer ceux de l'agent.
        Flux<String> run = requiredTools.isEmpty()
                ? orchestrator.chat(agentId, task.getUserId(), prompt, sessionId, task.getId())
                : orchestrator.chatWithTools(agentId, task.getUserId(), prompt, sessionId,
                        task.getId(), requiredTools);

        run.subscribe(
                token -> {},
                err -> {
                    log.error("[TASK-SCHEDULER] Erreur exécution tâche {}: {}", task.getId(), err.getMessage());
                    updateStatus(task.getId(), TaskStatus.FAILED);
                },
                () -> {
                    log.info("[TASK-SCHEDULER] Tâche {} exécutée avec succès", task.getId());
                    // Une tâche sociale n'a pas de rapport à livrer : rien ne
                    // demande à l'agent de la clore, et le « succès » ci-dessus
                    // ne touche pas au statut. Résultat, la tâche restait
                    // IN_PROGRESS pour toujours — vérifié en prod le 2026-10-03
                    // sur la tâche ed3e3ec9, restée IN_PROGRESS après un run
                    // terminé sans rien publier.
                    if (isSocialTask(task)) {
                        updateStatus(task.getId(), TaskStatus.DONE);
                    }
                }
            );
    }

    private boolean isSocialTask(AgentTask task) {
        return task.getSource() != null && TaskSource.SOCIAL_MEDIA.name().equals(task.getSource().name());
    }

    /**
     * Outils qu'une tâche sociale doit avoir sous la main, déduits de la
     * plateforme visée et du type de la tâche.
     *
     * <p>Sans cela, une whitelist d'agent étroite suffit à rendre la tâche
     * inexécutable : l'agent reçoit « utilise reply_facebook_comment », n'a pas
     * l'outil, conclut « je n'ai rien à faire » et la tâche passe en succès sans
     * avoir rien publié. Constaté en prod le 2026-10-03 sur l'agent « Studio ».
     */
    private List<String> requiredToolsFor(AgentTask task) {
        if (!isSocialTask(task)) {
            return List.of();
        }
        // La plateforme est dans `platforms` pour une tâche programmée, mais les
        // pollers la déposent dans `payload` en créant la tâche : il faut lire les
        // deux, sinon on retombe sur le cas « plateforme inconnue » alors qu'on la
        // connaît parfaitement.
        String haystack = (task.getPlatforms() == null ? "" : task.getPlatforms())
                + " " + (task.getPayload() == null ? "" : task.getPayload());
        boolean instagram = haystack.contains("INSTAGRAM");
        boolean facebook  = haystack.contains("FACEBOOK");
        if (!instagram && !facebook) {
            // Plateforme non renseignée : on couvre les deux, ce qui reste
            // inoffensif puisque ces outils refusent ce qu'ils ne gèrent pas.
            return List.of("reply_facebook_comment", "reply_instagram_comment", "get_facebook_comments");
        }
        return instagram
            ? List.of("reply_instagram_comment")
            : List.of("reply_facebook_comment", "get_facebook_comments");
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

        if (isSemiAutomatic(task)) {
            sb.append("\nMODE SEMI-AUTOMATIQUE : c'est TOI qui décides qui exécute réellement cette tâche. Utilise select_agent pour choisir le meilleur agent disponible (n'importe quel agent de l'équipe est autorisé), justifie brièvement ton choix, puis délègue avec delegate_to_agent.\n");
        } else {
            sb.append("\nMODE MANUEL : ne prends AUCUNE initiative sur l'exécutant. N'utilise PAS select_agent. Réalise la tâche par l'agent dont la compétence correspond au type, ou exécute toi-même si cela relève de ton rôle de coordinateur.\n");
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

    /**
     * Échec de dispatch : la tâche est déjà IN_PROGRESS (claim effectué), un save
     * sur l'entité sélectionnée avant le claim écraserait le statut de tout le
     * monde — d'où une relecture par id.
     */
    private void markFailed(String taskId) {
        updateStatus(taskId, TaskStatus.FAILED);
    }

    private boolean isSemiAutomatic(AgentTask task) {
        if (task.getPayload() == null || task.getPayload().isBlank()) return false;
        try {
            return objectMapper.readTree(task.getPayload()).path("semiAutomatic").asBoolean(false);
        } catch (Exception e) {
            log.warn("[TASK-SCHEDULER] Impossible de lire semiAutomatic pour tâche {}: {}", task.getId(), e.getMessage());
            return false;
        }
    }
}
