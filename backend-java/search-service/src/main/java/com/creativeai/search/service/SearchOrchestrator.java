package com.creativeai.search.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.creativeai.search.messaging.kafka.SearchJobProducer;
import com.creativeai.search.model.SearchHistory;
import com.creativeai.search.repository.SearchHistoryRepository;
import com.creativeai.search.util.SearchFileValidator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SearchOrchestrator {

    private final SearchJobProducer         jobProducer;
    private final StringRedisTemplate       redis;
    private final SimpMessagingTemplate   wsTemplate;
    private final ObjectMapper            objectMapper;
    private final SearchHistoryRepository   historyRepo;

    /**
     * Dispatch une recherche audio vers Kafka via MinIO (Claim Check).
     */
    public String dispatchAudioSearch(MultipartFile file, SearchFileValidator.Validated meta, String userEmail) throws Exception {
        // Le producer s'occupe de l'upload MinIO et de l'envoi Kafka
        String jobId = jobProducer.dispatchAudio(file, meta, userEmail);

        // Statut initial dans Redis
        redis.opsForValue().set("job:" + jobId, "PROCESSING", Duration.ofMinutes(15));

        // Enregistrement de l'historique
        try {
            SearchHistory h = SearchHistory.builder()
                    .jobId(jobId)
                    .userEmail(userEmail != null ? userEmail : "anonymous@creativeaistudio.ai")
                    .type(SearchHistory.SearchType.AUDIO)
                    .fileName(meta.storedName())
                    .status(SearchHistory.SearchStatus.PROCESSING)
                    .createdAt(LocalDateTime.now())
                    .build();
            historyRepo.save(h);
        } catch (Exception e) {
            log.error("Erreur d'enregistrement historique audio: {}", e.getMessage());
        }

        // Feedback WS
        wsTemplate.convertAndSend("/topic/search/" + jobId,
                Map.of("jobId", jobId, "status", "PROCESSING",
                        "message", "Upload terminé. Analyse audio en cours (Kafka)..."));

        return jobId;
    }

    public String dispatchVideoSearch(MultipartFile file, SearchFileValidator.Validated meta, String userEmail) throws Exception {
        String jobId = jobProducer.dispatchVideo(file, meta, userEmail);
        redis.opsForValue().set("job:" + jobId, "PROCESSING", Duration.ofMinutes(15));

        try {
            SearchHistory h = SearchHistory.builder()
                    .jobId(jobId)
                    .userEmail(userEmail != null ? userEmail : "anonymous@creativeaistudio.ai")
                    .type(SearchHistory.SearchType.VIDEO)
                    .fileName(meta.storedName())
                    .status(SearchHistory.SearchStatus.PROCESSING)
                    .createdAt(LocalDateTime.now())
                    .build();
            historyRepo.save(h);
        } catch (Exception e) {
            log.error("Erreur d'enregistrement historique vidéo: {}", e.getMessage());
        }

        wsTemplate.convertAndSend("/topic/search/" + jobId,
                Map.of("jobId", jobId, "status", "PROCESSING", "message", "Analyse vidéo démarrée..."));
        return jobId;
    }

    public String dispatchFaceSearch(MultipartFile image, SearchFileValidator.Validated meta, String query,
                                     String phone, String userEmail) throws Exception {
        String jobId = jobProducer.dispatchFace(image, meta, query, phone, userEmail);
        redis.opsForValue().set("job:" + jobId, "PROCESSING", Duration.ofMinutes(15));

        try {
            SearchHistory h = SearchHistory.builder()
                    .jobId(jobId)
                    .userEmail(userEmail != null ? userEmail : "anonymous@creativeaistudio.ai")
                    .type(SearchHistory.SearchType.PERSON)
                    .fileName(meta != null ? meta.storedName() : null)
                    .query(query != null ? query : (phone != null ? "Phone: " + phone : "Face search"))
                    .status(SearchHistory.SearchStatus.PROCESSING)
                    .createdAt(LocalDateTime.now())
                    .build();
            historyRepo.save(h);
        } catch (Exception e) {
            log.error("Erreur d'enregistrement historique face: {}", e.getMessage());
        }

        wsTemplate.convertAndSend("/topic/search/" + jobId,
                Map.of("jobId", jobId, "status", "PROCESSING", "message", "Identification lancée..."));
        return jobId;
    }

    /** Récupère le résultat depuis Redis (posé par les workers Python via callback). */
    public Map<String, Object> getJobResult(String jobId) throws Exception {
        String raw = redis.opsForValue().get("result:" + jobId);
        if (raw == null) {
            String status = redis.opsForValue().get("job:" + jobId);
            return Map.of("jobId", jobId, "status", status != null ? status : "UNKNOWN");
        }
        return objectMapper.readValue(raw, Map.class);
    }

    /** Récupère l'historique complet pour un utilisateur */
    public java.util.List<SearchHistory> getHistory(String userEmail) {
        return historyRepo.findByUserEmailOrderByCreatedAtDesc(userEmail != null ? userEmail : "anonymous@creativeaistudio.ai");
    }
}
