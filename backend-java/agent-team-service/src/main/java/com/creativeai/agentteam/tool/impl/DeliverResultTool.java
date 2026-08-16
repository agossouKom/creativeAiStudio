package com.creativeai.agentteam.tool.impl;

import com.creativeai.agentteam.dto.request.InboxMessageRequest;
import com.creativeai.agentteam.model.AgentTask;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.MessageDirection;
import com.creativeai.agentteam.model.enums.TaskStatus;
import com.creativeai.agentteam.model.enums.TaskType;
import com.creativeai.agentteam.repository.AgentTaskRepository;
import com.creativeai.agentteam.service.DocxGeneratorService;
import com.creativeai.agentteam.service.InboxService;
import com.creativeai.agentteam.tool.AgentTool;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.EnumSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Utilisé par le Scrum Manager après l'exécution d'une tâche :
 * crée un rapport de clôture dans l'inbox du patron (date, heure, durée, statut)
 * et ferme la tâche automatiquement.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DeliverResultTool implements AgentTool {

    private final InboxService          inboxService;
    private final AgentTaskRepository   taskRepo;
    private final DocxGeneratorService  docxGenerator;
    private final ObjectMapper          objectMapper;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm:ss");

    private static final Set<TaskType> FILE_GENERATING_TYPES = EnumSet.of(
        TaskType.PRESENTATION_CREATE,
        TaskType.DOCUMENT_PDF,
        TaskType.ACCOUNTING_REPORT,
        TaskType.SOCIAL_CONTENT,
        TaskType.REPORT_GENERATE,
        TaskType.CV_CREATE,
        TaskType.DOCUMENT_SUMMARIZE,
        TaskType.CONTENT_GENERATE
    );

    @Override public String getName() { return "deliver_result"; }

    @Override
    public String getDescription() {
        return "Crée un rapport de clôture dans l'inbox du patron avec les détails d'exécution "
             + "(date, heure de début/fin, durée, statut, résultat) et ferme automatiquement la tâche. "
             + "À utiliser par le Scrum Manager dès que l'agent a terminé son exécution.";
    }

    @Override
    public String getParametersSchema() {
        return """
            {
              "taskId":         "string (optionnel) — ID de la tâche à clôturer",
              "title":          "string (obligatoire) — titre/objet du rapport de clôture",
              "result":         "string (obligatoire) — résumé du résultat exécuté par l'agent",
              "conversationId": "string (optionnel) — ID de conversation pour grouper les échanges",
              "agentName":      "string (optionnel) — nom de l'agent qui a exécuté la tâche"
            }
            """;
    }

    @Override
    public String execute(String scrumAgentId, String userId, Map<String, Object> params) {
        String taskId         = (String) params.get("taskId");
        String title          = (String) params.get("title");
        String result         = (String) params.get("result");
        String conversationId = (String) params.get("conversationId");
        String agentName      = (String) params.getOrDefault("agentName", "Agent");

        if (title  == null || title.isBlank())  return "{\"error\":\"Paramètre 'title' obligatoire\"}";
        if (result == null || result.isBlank())  return "{\"error\":\"Paramètre 'result' obligatoire\"}";

        LocalDateTime now = LocalDateTime.now();

        // Fermeture de la tâche et collecte des métriques temporelles
        TaskClosureInfo closure = closeTask(taskId, now);

        // Génération du fichier DOCX si la tâche produit un document
        String fileUrl  = null;
        String fileName = null;
        if (closure.needsFile()) {
            DocxGeneratorService.GeneratedFile generated = docxGenerator.generate(title, agentName, result);
            if (generated != null) {
                fileUrl  = generated.url();
                fileName = generated.name();
            }
        }

        String subject = "Clôture — " + title;
        String body    = buildReport(agentName, title, result, closure, now, fileUrl);

        log.info("[DELIVER_RESULT] scrumAgent={} → patron={} | title='{}' | taskId={} | file={}",
                 scrumAgentId, userId, title, taskId, fileName);

        try {
            InboxMessageRequest req = new InboxMessageRequest(
                scrumAgentId,
                null,
                ChannelType.AGENT_INTERNAL,
                MessageDirection.OUTBOUND,
                "scrum-" + scrumAgentId,
                userId,
                subject,
                body,
                conversationId,
                null,
                buildMetadata(scrumAgentId, taskId),
                fileUrl,
                fileName
            );

            var msg = inboxService.createMessage(userId, req);
            inboxService.markAsDelivered(userId, msg.id(), scrumAgentId);

            var result_map = new java.util.HashMap<>(Map.of(
                "success",    true,
                "messageId",  msg.id(),
                "taskClosed", closure.closed(),
                "duration",   closure.durationLabel(),
                "message",    "Rapport de clôture déposé dans l'inbox du patron."
            ));
            if (fileUrl != null) {
                result_map.put("fileUrl",  fileUrl);
                result_map.put("fileName", fileName);
            }

            return objectMapper.writeValueAsString(result_map);
        } catch (Exception e) {
            log.error("[DELIVER_RESULT] Erreur livraison: {}", e.getMessage(), e);
            return "{\"success\":false,\"error\":\"" + e.getMessage().replace("\"", "'") + "\"}";
        }
    }

    // ── Fermeture de tâche ────────────────────────────────────────────────────

    private TaskClosureInfo closeTask(String taskId, LocalDateTime completedAt) {
        if (taskId == null || taskId.isBlank()) return TaskClosureInfo.unknown();

        Optional<AgentTask> opt = taskRepo.findByIdAndDeletedFalse(taskId);
        if (opt.isEmpty()) return TaskClosureInfo.unknown();

        AgentTask task = opt.get();
        LocalDateTime startedAt = task.getStartedAt() != null ? task.getStartedAt() : completedAt;

        task.setStatus(TaskStatus.DONE);
        task.setCompletedAt(completedAt);
        if (task.getStartedAt() == null) task.setStartedAt(completedAt);
        taskRepo.save(task);

        Duration duration = Duration.between(startedAt, completedAt);
        boolean needsFile = task.getType() != null && FILE_GENERATING_TYPES.contains(task.getType());
        return new TaskClosureInfo(true, task.getTitle(), startedAt, completedAt, formatDuration(duration), needsFile);
    }

    // ── Construction du rapport ───────────────────────────────────────────────

    private String buildReport(String agentName, String title, String result,
                                TaskClosureInfo c, LocalDateTime now, String fileUrl) {
        String dateSection = c.closed()
            ? """
              | Début       | %s à %s |
              | Fin         | %s à %s |
              | Durée       | %s       |
              | Statut      | ✅ DONE  |
              """.formatted(
                  c.startedAt().format(DATE_FMT), c.startedAt().format(TIME_FMT),
                  c.completedAt().format(DATE_FMT), c.completedAt().format(TIME_FMT),
                  c.durationLabel())
            : """
              | Date        | %s       |
              | Heure       | %s       |
              | Statut      | ✅ DONE  |
              """.formatted(now.format(DATE_FMT), now.format(TIME_FMT));

        String taskSection = (c.closed() && c.taskTitle() != null)
            ? "\n**Tâche :** " + c.taskTitle() + "\n"
            : "";

        String fileSection = (fileUrl != null)
            ? "\n### Fichier généré\n[📄 Télécharger le document](" + fileUrl + ")\n"
            : "";

        return """
            ## Rapport de clôture — %s

            **Agent :** %s%s

            ### Résultat
            %s

            ### Détails d'exécution
            %s%s
            ---
            *Rapport généré automatiquement par votre équipe d'agents IA.*
            """.formatted(title, agentName, taskSection, result, dateSection, fileSection);
    }

    private String buildMetadata(String scrumAgentId, String taskId) {
        String tid = (taskId != null) ? ",\"taskId\":\"" + taskId + "\"" : "";
        return "{\"deliveredBy\":\"" + scrumAgentId + "\",\"type\":\"TASK_CLOSURE\"" + tid + "}";
    }

    private String formatDuration(Duration d) {
        long h = d.toHours();
        long m = d.toMinutesPart();
        long s = d.toSecondsPart();
        if (h > 0) return "%dh %02dm %02ds".formatted(h, m, s);
        if (m > 0) return "%dm %02ds".formatted(m, s);
        return "%ds".formatted(s);
    }

    // ── Value object interne ──────────────────────────────────────────────────

    private record TaskClosureInfo(
            boolean closed,
            String taskTitle,
            LocalDateTime startedAt,
            LocalDateTime completedAt,
            String durationLabel,
            boolean needsFile) {

        static TaskClosureInfo unknown() {
            return new TaskClosureInfo(false, null, null, null, "N/A", false);
        }
    }
}
