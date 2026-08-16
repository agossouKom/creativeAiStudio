package com.creativeai.search.messaging.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.creativeai.search.model.SearchHistory;
import com.creativeai.search.repository.SearchHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Map;

/** Consomme les résultats publiés par les workers Python dans le topic 'creativeai.results' */
@Slf4j
@Component
@RequiredArgsConstructor
public class SearchResultConsumer {

    private final StringRedisTemplate   redis;
    private final SimpMessagingTemplate wsTemplate;
    private final SearchHistoryRepository historyRepo;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @KafkaListener(topics = "creativeai.results", groupId = "search-service-results")
    public void onResult(String jsonPayload) {
        String jobId = "UNKNOWN";
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = objectMapper.readValue(jsonPayload, Map.class);
            jobId  = (String) payload.get("jobId");
            String status = (String) payload.getOrDefault("status", "DONE");

            log.info("[KAFKA] Résultat reçu pour job {} — status: {}", jobId, status);

            // 1. Sauvegarder le résultat dans Redis (TTL 30 min)
            redis.opsForValue().set(
                    "result:" + jobId, jsonPayload,
                    java.time.Duration.ofMinutes(30)
            );

            // 2. Mettre à jour l'historique persistant dans PostgreSQL
            final String finalJobId = jobId;
            final String finalStatus = status;
            try {
                historyRepo.findByJobId(finalJobId).ifPresent(h -> {
                    h.setStatus(finalStatus.equalsIgnoreCase("FAILED") ? SearchHistory.SearchStatus.FAILED : SearchHistory.SearchStatus.DONE);
                    h.setResultJson(jsonPayload);
                    h.setCompletedAt(LocalDateTime.now());
                    historyRepo.save(h);
                    log.info("[DB] Historique de recherche mis à jour en base pour job {}", finalJobId);
                });
            } catch (Exception dbEx) {
                log.error("[DB] Impossible de mettre à jour l'historique en base pour le job {}: {}", jobId, dbEx.getMessage());
            }

            // 3. Pousser le résultat vers le frontend via WebSocket
            wsTemplate.convertAndSend("/topic/search/" + jobId, Map.of(
                    "jobId",   jobId,
                    "status",  status,
                    "result",  payload
            ));

            log.info("[WS] Résultat envoyé au client pour job {}", jobId);

        } catch (Exception e) {
            log.error("[KAFKA] Erreur traitement résultat job {}: {}", jobId, e.getMessage());
        }
    }
}
