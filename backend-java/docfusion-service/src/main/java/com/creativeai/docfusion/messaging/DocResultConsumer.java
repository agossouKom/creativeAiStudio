package com.creativeai.docfusion.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.creativeai.docfusion.model.DocJob;
import com.creativeai.docfusion.repository.DocJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class DocResultConsumer {

    private final StringRedisTemplate    redis;
    private final SimpMessagingTemplate  ws;
    private final DocJobRepository       jobRepo;
    private final ObjectMapper           mapper = new ObjectMapper();

    @KafkaListener(topics = "creativeai.docfusion.results", groupId = "docfusion-results")
    public void onResult(String jsonPayload) {
        String jobId = "UNKNOWN";
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = mapper.readValue(jsonPayload, Map.class);
            jobId = (String) payload.get("jobId");
            String status = (String) payload.getOrDefault("status", "DONE");

            log.info("[KAFKA] Résultat DocFusion job {} — status: {}", jobId, status);

            // Mise à jour Redis (TTL 1h)
            redis.opsForValue().set("docfusion:result:" + jobId, jsonPayload, Duration.ofHours(1));

            // Mise à jour PostgreSQL
            final String fJobId = jobId;
            final String fStatus = status;
            jobRepo.findByJobId(fJobId).ifPresent(job -> {
                job.setStatus(fStatus);
                job.setCompletedAt(LocalDateTime.now());
                if ("DONE".equals(fStatus)) {
                    job.setResultUrl((String) payload.get("resultUrl"));
                    Object text = payload.get("text");
                    if (text != null) job.setResultText(text.toString());
                } else {
                    job.setErrorMsg((String) payload.get("error"));
                }
                jobRepo.save(job);
            });

            // Notification WebSocket
            ws.convertAndSend("/topic/docfusion/" + jobId, Map.of(
                    "jobId", jobId,
                    "status", status,
                    "result", payload
            ));

        } catch (Exception e) {
            log.error("[KAFKA] Erreur traitement résultat DocFusion job {}: {}", jobId, e.getMessage());
        }
    }
}
