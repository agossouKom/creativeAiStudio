package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.AgentTask;
import com.creativeai.agentteam.model.enums.TaskSource;
import com.creativeai.agentteam.model.enums.TaskStatus;
import com.creativeai.agentteam.orchestrator.AgentOrchestrator;
import com.creativeai.agentteam.repository.AgentTaskRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.test.util.ReflectionTestUtils;
import reactor.core.publisher.Flux;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;

/**
 * Une tâche sociale doit s'exécuter même quand la whitelist de l'agent est
 * étroite.
 *
 * <p>Régression du 2026-10-03 en prod : l'agent « Studio » n'avait que
 * post_social, list_media et get_current_date. Sa tâche « Répondre au commentaire
 * de Labibpro Bénin Officiel » lui demandait pourtant reply_facebook_comment ;
 * l'orchestrateur a retiré l'outil de la liste, l'agent a conclu « je n'ai rien à
 * faire » et la tâche est passée en succès sans qu'aucune réponse ne parte.
 *
 * <p>Ici, le scheduler ajoute les outils de réponse en plus de ceux de l'agent,
 * et referme la tâche, qui restait IN_PROGRESS indéfiniment.
 */
@ExtendWith(MockitoExtension.class)
class TaskSchedulerServiceSocialToolsTest {

    @Mock private AgentTaskRepository taskRepo;
    @Mock private AgentOrchestrator   orchestrator;

    private TaskSchedulerService scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new TaskSchedulerService(taskRepo, orchestrator, new ObjectMapper());
        ReflectionTestUtils.setField(scheduler, "minioPublicUrl", "http://minio.local");
        ReflectionTestUtils.setField(scheduler, "staleAfterMinutes", 30L);
        lenient().when(taskRepo.claimTask(anyString(), any(LocalDateTime.class))).thenReturn(1);
        lenient().when(orchestrator.chatWithTools(anyString(), anyString(), anyString(),
                anyString(), any(), ArgumentMatchers.<Collection<String>>any()))
            .thenReturn(Flux.empty());
    }

    @Test
    void uneTacheFacebookReçoitLOutilDeRepondreSurFacebook() {
        run(
            socialTask("{\"postId\":\"1181996944992363_122140217031356653\","
                + "\"platform\":\"FACEBOOK\",\"commentId\":\"1144026701282704\"}"));

        assertEquals(
            List.of("reply_facebook_comment", "get_facebook_comments"),
            toolsPassedToOrchestrator());
    }

    @Test
    void uneTacheInstagramReçoitLOutilDeRepondreSurInstagram() {
        run(
            socialTask("{\"mediaId\":\"18150446455536315\","
                + "\"platform\":\"INSTAGRAM\",\"commentId\":\"17900000000000000\"}"));

        assertEquals(List.of("reply_instagram_comment"), toolsPassedToOrchestrator());
    }

    /**
     * Les pollers deposent la plateforme dans le payload et laissent
     * {@code platforms} vide. Sans cette lecture, on ne saurait pas quel outil
     * passer et la tâche resterait sans moyen d'agir.
     */
    @Test
    void laPlateformeeEstLueDansLePayloadQuandLeChampPlatformsEstVide() {
        AgentTask task = socialTask("{\"platform\":\"INSTAGRAM\"}");
        assertTrue(task.getPlatforms() == null || task.getPlatforms().isBlank());

        run(task);

        assertEquals(List.of("reply_instagram_comment"), toolsPassedToOrchestrator());
    }

    @Test
    void unePlateformeInconnueCouvreLesDeuxOutilsDeReponse() {
        run(socialTask("{}"));

        assertEquals(
            List.of("reply_facebook_comment", "reply_instagram_comment", "get_facebook_comments"),
            toolsPassedToOrchestrator());
    }

    @Test
    void uneTacheSansAgentAssigneEchoueSansExecuter() {
        AgentTask task = socialTask("{\"platform\":\"FACEBOOK\"}");
        task.setAssignedAgentId(null);
        lenient().when(taskRepo.findByIdAndDeletedFalse(task.getId()))
            .thenReturn(java.util.Optional.of(task));

        run(task);

        verify(orchestrator, org.mockito.Mockito.never()).chatWithTools(anyString(), anyString(),
            anyString(), anyString(), any(), ArgumentMatchers.<Collection<String>>any());
        assertEquals(TaskStatus.FAILED, task.getStatus());
    }

    @Test
    void uneTacheSocialeEstClotureeApresLeRun() {
        AgentTask task = socialTask("{\"platform\":\"FACEBOOK\"}");
        lenient().when(taskRepo.findByIdAndDeletedFalse(task.getId()))
            .thenReturn(java.util.Optional.of(task));

        run(task);

        // Sans ce DONE, la tâche restait IN_PROGRESS pour toujours : le succès du
        // flux ne touche pas au statut et personne ne demande à l'agent de la
        // clore (vérifié en base sur ed3e3ec9, restée IN_PROGRESS).
        assertEquals(TaskStatus.DONE, task.getStatus());
        verify(taskRepo, atLeastOnce()).save(task);
    }

    @Test
    void uneTacheNonSocialePasseParLeCheminNominal() {
        AgentTask task = socialTask("{\"platform\":\"FACEBOOK\"}");
        task.setSource(TaskSource.MANUAL);

        run(task);

        verify(orchestrator, org.mockito.Mockito.never()).chatWithTools(anyString(), anyString(),
            anyString(), anyString(), any(), ArgumentMatchers.<Collection<String>>any());
        verify(orchestrator).chat(eq("agent-1"), eq("user-1"), anyString(), anyString(),
            eq("task-1"));
    }

    @SuppressWarnings("unchecked")
    private List<String> toolsPassedToOrchestrator() {
        ArgumentCaptor<Collection<String>> captor = ArgumentCaptor.forClass(Collection.class);
        verify(orchestrator).chatWithTools(anyString(), anyString(), anyString(), anyString(),
            any(), captor.capture());
        return List.copyOf(captor.getValue());
    }

    private void run(AgentTask task) {
        lenient().when(taskRepo.findPendingSocialMediaTasks()).thenReturn(List.of(task));
        scheduler.processSocialMediaTasks();
    }

    private AgentTask socialTask(String payload) {
        AgentTask task = new AgentTask();
        task.setId("task-1");
        task.setUserId("user-1");
        task.setAssignedAgentId("agent-1");
        task.setTitle("Répondre au commentaire");
        task.setSource(TaskSource.SOCIAL_MEDIA);
        task.setPayload(payload);
        task.setStatus(TaskStatus.PENDING);
        return task;
    }
}