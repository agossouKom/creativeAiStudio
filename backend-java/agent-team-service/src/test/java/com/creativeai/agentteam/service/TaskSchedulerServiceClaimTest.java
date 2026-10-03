package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.AgentTask;
import com.creativeai.agentteam.model.enums.TaskSource;
import com.creativeai.agentteam.model.enums.TaskStatus;
import com.creativeai.agentteam.orchestrator.AgentOrchestrator;
import com.creativeai.agentteam.repository.AgentTaskRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.verification.VerificationMode;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import reactor.core.publisher.Flux;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Un même tick ne doit jamais exécuter deux fois la même tâche.
 *
 * <p>Les deux pollers lisent les mêmes lignes PENDING : le poller des tâches
 * planifiées ({@code @Scheduled(cron)}) et celui des tâches sociales
 * ({@code fixedDelay}). Sans exclusion mutuelle, une tâche SOCIAL_MEDIA qui
 * satisfait les deux critères est réclamée par les deux dans la même seconde et
 * l'agent s'exécute deux fois — donc, pour une tâche sociale, deux
 * publications sur le réseau.
 *
 * <p>Le claim est un UPDATE conditionnel porté par la base : seul celui dont
 * l'écriture modifie réellement une ligne obtient 1 et continue.
 */
@ExtendWith(MockitoExtension.class)
class TaskSchedulerServiceClaimTest {

    @Mock private AgentTaskRepository taskRepo;
    @Mock private AgentOrchestrator   orchestrator;

    private TaskSchedulerService scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new TaskSchedulerService(taskRepo, orchestrator, new ObjectMapper());
        ReflectionTestUtils.setField(scheduler, "minioPublicUrl", "http://minio.local");
        ReflectionTestUtils.setField(scheduler, "staleAfterMinutes", 30L);
        // Lenient : plusieurs tests vérifient justement que l'orchestrateur
        // n'est JAMAIS appelé, et un stub strict y serait signalé inutile.
        lenient().when(orchestrator.chat(anyString(), anyString(), anyString(), anyString(), any()))
            .thenReturn(Flux.empty());
        // Une tâche sociale passe par chatWithTools, qui ajoute les outils de
        // réponse aux commentaires à ceux de l'agent (sinon une whitelist
        // étroite rend la tâche inexécutable).
        lenient().when(orchestrator.chatWithTools(anyString(), anyString(), anyString(), anyString(),
                any(), anyCollection()))
            .thenReturn(Flux.empty());
    }

    private AgentTask task(String id, TaskSource source) {
        AgentTask task = new AgentTask();
        task.setId(id);
        task.setUserId("user-1");
        task.setAssignedAgentId("agent-1");
        task.setTitle("Publier l'offre");
        task.setSource(source);
        task.setStatus(TaskStatus.PENDING);
        return task;
    }

    // ── Le double-dispatch ───────────────────────────────────────────────────

    /**
     * Cas central : la tâche est lue par les deux pollers, mais seul le premier
     * obtient le claim. Le second ne doit surtout pas lancer l'agent — c'est
     * exactement la publication en double.
     */

    /**
     * Vérifie l'appel à l'orchestrateur quelle que soit l'entrée utilisée :
     * {@code chat} pour une tâche sans outil supplémentaire, {@code chatWithTools}
     * pour une tâche sociale.
     */
    private void verifyOrchestratorCalled(String sessionId, VerificationMode mode) {
        verify(orchestrator, mode).chatWithTools(anyString(), anyString(), anyString(),
            eq(sessionId), any(), anyCollection());
    }

    @Test
    void uneTacheDejaReclameeNestPasExecuteeUneSecondeFois() {
        AgentTask shared = task("task-1", TaskSource.SOCIAL_MEDIA);
        when(taskRepo.findPendingSocialMediaTasks()).thenReturn(List.of(shared));
        when(taskRepo.findDueScheduledTasks(any())).thenReturn(List.of(shared));

        // Premier poller : il gagne le claim.
        when(taskRepo.claimTask(eq("task-1"), any(LocalDateTime.class))).thenReturn(1);
        scheduler.processSocialMediaTasks();
        verifyOrchestratorCalled("scheduled-task-1", times(1));

        // Second poller, même tick : le claim conditionnel ne modifie plus rien.
        when(taskRepo.claimTask(eq("task-1"), any(LocalDateTime.class))).thenReturn(0);
        scheduler.processScheduledTasks();

        // Toujours une seule exécution.
        verifyOrchestratorCalled("scheduled-task-1", times(1));
    }

    @Test
    void uneTacheNonReclameeNestPasExecutee() {
        when(taskRepo.findPendingSocialMediaTasks())
            .thenReturn(List.of(task("task-1", TaskSource.SOCIAL_MEDIA)));
        when(taskRepo.claimTask(anyString(), any(LocalDateTime.class))).thenReturn(0);

        scheduler.processSocialMediaTasks();

        verify(orchestrator, never()).chat(anyString(), anyString(), anyString(), anyString(), any());
    }

    // ── Le taskId doit remonter ──────────────────────────────────────────────

    /**
     * Sans taskId transmis, l'orchestrateur ne peut pas clore la tâche et celle-ci
     * reste IN_PROGRESS indéfiniment, même après une exécution réussie.
     */
    @Test
    void leTaskIdEstTransmisALOrchestrateur() {
        when(taskRepo.findPendingSocialMediaTasks())
            .thenReturn(List.of(task("task-42", TaskSource.SOCIAL_MEDIA)));
        when(taskRepo.claimTask(eq("task-42"), any(LocalDateTime.class))).thenReturn(1);

        scheduler.processSocialMediaTasks();

        verify(orchestrator).chatWithTools(eq("agent-1"), eq("user-1"), anyString(),
            eq("scheduled-task-42"), eq("task-42"), anyCollection());
    }

    @Test
    void uneTacheSansAgentAssigneEchoueSansExecuter() {
        AgentTask orphan = task("task-1", TaskSource.SOCIAL_MEDIA);
        orphan.setAssignedAgentId(null);
        when(taskRepo.findPendingSocialMediaTasks()).thenReturn(List.of(orphan));

        scheduler.processSocialMediaTasks();

        verify(orchestrator, never()).chat(anyString(), anyString(), anyString(), anyString(), any());
        // Marquée en échec par relecture, pas par un save qui écraserait le statut
        // d'un éventuel claim concurrent.
        verify(taskRepo).findByIdAndDeletedFalse("task-1");
    }

    // ── Le rattrapage des tâches orphelines ───────────────────────────────────

    /**
     * Le claim rend la tâche invisible des deux pollers pendant son exécution.
     * Sans reaper, un agent mort la laisserait IN_PROGRESS à jamais.
     */
    @Test
    void lesTachesBloqueesSontRemisesEnPending() {
        when(taskRepo.releaseStuckTasks(any(LocalDateTime.class))).thenReturn(2);

        scheduler.releaseStaleTasks();

        ArgumentCaptor<LocalDateTime> captor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(taskRepo).releaseStuckTasks(captor.capture());
        // Le seuil doit être antérieur d'exactement staleAfterMinutes.
        long deltaSeconds = java.time.Duration.between(
            captor.getValue(), LocalDateTime.now()).getSeconds();
        assertTrue(Math.abs(deltaSeconds - 1800) < 60, "seuil inattendu : " + captor.getValue());
    }

    @Test
    void aucuneTacheOrphelineNeDeclencheDEexecution() {
        when(taskRepo.releaseStuckTasks(any(LocalDateTime.class))).thenReturn(0);

        scheduler.releaseStaleTasks();

        verify(orchestrator, never()).chat(anyString(), anyString(), anyString(), anyString(), any());
    }

    // ── Le prompt conserve son contenu ───────────────────────────────────────

    @Test
    void lePromptResteCompletApresLesCorrectifs() {
        AgentTask task = task("task-1", TaskSource.SOCIAL_MEDIA);
        task.setDescription("Publier la promotion du trimestre");
        task.setPlatforms("[\"FACEBOOK\",\"INSTAGRAM\"]");
        when(taskRepo.findPendingSocialMediaTasks()).thenReturn(List.of(task));
        when(taskRepo.claimTask(anyString(), any(LocalDateTime.class))).thenReturn(1);

        scheduler.processSocialMediaTasks();

        ArgumentCaptor<String> prompt = ArgumentCaptor.forClass(String.class);
        verify(orchestrator).chatWithTools(eq("agent-1"), eq("user-1"), prompt.capture(),
            anyString(), eq("task-1"), anyCollection());
        assertTrue(prompt.getValue().contains("Publier la promotion du trimestre"));
        assertTrue(prompt.getValue().contains("FACEBOOK, INSTAGRAM"));
        assertTrue(prompt.getValue().contains("[RÉPONSE AUTOMATIQUE"));
    }
}
