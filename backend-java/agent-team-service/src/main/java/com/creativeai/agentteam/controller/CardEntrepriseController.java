package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.CardEntreprise;
import com.creativeai.agentteam.service.CardEntrepriseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/card-entreprises")
@RequiredArgsConstructor
public class CardEntrepriseController {

    private final CardEntrepriseService svc;

    @GetMapping
    public List<CardEntreprise> list(@AuthenticationPrincipal String userId) {
        return svc.list(userId);
    }

    @PostMapping
    public ResponseEntity<CardEntreprise> save(
            @AuthenticationPrincipal String userId,
            @RequestBody CardEntreprise body) {
        body.setUserId(userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(svc.save(body));
    }

    @PutMapping("/{id}")
    public CardEntreprise update(
            @AuthenticationPrincipal String userId,
            @PathVariable String id,
            @RequestBody CardEntreprise body) {
        return svc.update(id, userId, body);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal String userId,
            @PathVariable String id) {
        svc.delete(id, userId);
        return ResponseEntity.noContent().build();
    }
}
