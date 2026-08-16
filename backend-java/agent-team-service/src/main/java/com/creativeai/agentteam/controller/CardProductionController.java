package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.CardProduction;
import com.creativeai.agentteam.service.CardProductionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/card-productions")
@RequiredArgsConstructor
public class CardProductionController {

    private final CardProductionService svc;

    @GetMapping
    public List<CardProduction> list(
            @AuthenticationPrincipal String userId,
            @RequestParam(required = false) String entreprise) {
        if (entreprise != null && !entreprise.isBlank()) {
            return svc.listByUserAndEntreprise(userId, entreprise);
        }
        return svc.listByUser(userId);
    }

    @PostMapping
    public ResponseEntity<CardProduction> create(
            @AuthenticationPrincipal String userId,
            @RequestBody CardProduction body) {
        body.setUserId(userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(svc.save(body));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal String userId,
            @PathVariable String id) {
        svc.delete(id, userId);
        return ResponseEntity.noContent().build();
    }
}
