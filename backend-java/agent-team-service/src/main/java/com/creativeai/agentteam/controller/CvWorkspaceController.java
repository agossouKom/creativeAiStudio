package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.CvAnalysis;
import com.creativeai.agentteam.service.CvWorkspaceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cv-workspace")
@RequiredArgsConstructor
public class CvWorkspaceController {

    private final CvWorkspaceService svc;

    /** Liste tous les CV analysés de l'utilisateur courant. */
    @GetMapping
    public List<CvAnalysis> list(@AuthenticationPrincipal String userId) {
        return svc.list(userId);
    }

    /** Sauvegarde une nouvelle analyse CV. */
    @PostMapping
    public ResponseEntity<CvAnalysis> save(
            @AuthenticationPrincipal String userId,
            @RequestBody CvAnalysis body) {
        body.setUserId(userId);
        if (body.getAnalyzedAt() == null) body.setAnalyzedAt(LocalDateTime.now());
        return ResponseEntity.status(HttpStatus.CREATED).body(svc.save(body));
    }

    /** Met à jour le statut pipeline d'un CV. */
    @PutMapping("/{id}/status")
    public CvAnalysis updateStatus(
            @AuthenticationPrincipal String userId,
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        return svc.updateStatus(id, userId, body.get("status"));
    }

    /** Met à jour les notes d'un CV. */
    @PutMapping("/{id}/notes")
    public CvAnalysis updateNotes(
            @AuthenticationPrincipal String userId,
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        return svc.updateNotes(id, userId, body.getOrDefault("notes", ""));
    }

    /** Supprime (soft-delete) un CV du workspace. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal String userId,
            @PathVariable String id) {
        svc.delete(id, userId);
        return ResponseEntity.noContent().build();
    }

    /** Vide tout le workspace de l'utilisateur. */
    @DeleteMapping
    public ResponseEntity<Void> clearAll(@AuthenticationPrincipal String userId) {
        svc.clearAll(userId);
        return ResponseEntity.noContent().build();
    }

    /** Récupère le mode workspace (recruiter / candidate / hr). */
    @GetMapping("/settings")
    public Map<String, String> getSettings(@AuthenticationPrincipal String userId) {
        return svc.getSettings(userId);
    }

    /** Sauvegarde le mode workspace choisi. */
    @PutMapping("/settings")
    public ResponseEntity<Void> saveSettings(
            @AuthenticationPrincipal String userId,
            @RequestBody Map<String, String> body) {
        svc.saveSettings(userId, body.getOrDefault("mode", "recruiter"));
        return ResponseEntity.ok().build();
    }
}
