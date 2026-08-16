package com.creativeai.search.controller;

import com.creativeai.search.service.SearchOrchestrator;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/search")
@RequiredArgsConstructor
@Tag(name = "Moteur de Recherche AI", description = "Endpoints pour l'analyse multimédia (Audio, Vidéo, Visage)")
public class SearchController {

    private final SearchOrchestrator orchestrator;

    @Operation(summary = "Lancer une recherche audio", description = "Analyse une empreinte sonore pour identifier un média")
    @PostMapping("/audio")
    public ResponseEntity<Map<String, Object>> searchAudio(
            @RequestParam("file") MultipartFile file,
            @RequestHeader("X-User-Name") String userEmail) throws Exception {

        String jobId = orchestrator.dispatchAudioSearch(file, userEmail);
        return ResponseEntity.accepted().body(Map.of(
                "jobId",   jobId,
                "status",  "PROCESSING",
                "message", "Analyse audio démarrée. Abonnez-vous à /topic/search/" + jobId
        ));
    }

    @Operation(summary = "Lancer une recherche vidéo", description = "Analyse les frames d'une vidéo pour détection de contenu")
    @PostMapping("/video")
    public ResponseEntity<Map<String, Object>> searchVideo(
            @RequestParam("file") MultipartFile file,
            @RequestHeader("X-User-Name") String userEmail) throws Exception {

        String jobId = orchestrator.dispatchVideoSearch(file, userEmail);
        return ResponseEntity.accepted().body(Map.of(
                "jobId", jobId, "status", "PROCESSING",
                "message", "Analyse vidéo démarrée. Suivez /topic/search/" + jobId
        ));
    }

    @Operation(summary = "Lancer une recherche de personne", description = "Identification faciale ou recherche par critères textuels")
    @PostMapping("/person")
    public ResponseEntity<Map<String, Object>> searchPerson(
            @RequestParam(value = "image",  required = false) MultipartFile image,
            @RequestParam(value = "query",  required = false) String query,
            @RequestParam(value = "phone",  required = false) String phone,
            @RequestHeader("X-User-Name") String userEmail) throws Exception {

        String jobId = orchestrator.dispatchFaceSearch(image, query, phone, userEmail);
        return ResponseEntity.accepted().body(Map.of(
                "jobId", jobId, "status", "PROCESSING",
                "message", "Identification démarrée. Suivez /topic/search/" + jobId
        ));
    }

    @Operation(summary = "Vérifier le statut d'un job", description = "Récupère les résultats finaux d'une analyse IA")
    @GetMapping("/status/{jobId}")
    public ResponseEntity<Map<String, Object>> getStatus(@PathVariable String jobId) throws Exception {
        return ResponseEntity.ok(orchestrator.getJobResult(jobId));
    }

    @Operation(summary = "Récupérer l'historique de recherche", description = "Renvoie l'historique des requêtes de l'utilisateur connecté")
    @GetMapping("/history")
    public ResponseEntity<java.util.List<com.creativeai.search.model.SearchHistory>> getHistory(
            @RequestHeader("X-User-Name") String userEmail) {
        return ResponseEntity.ok(orchestrator.getHistory(userEmail));
    }
}
