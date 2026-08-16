package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.CardDesign;
import com.creativeai.agentteam.service.CardDesignService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@RestController
@RequestMapping("/api/card-designs")
@RequiredArgsConstructor
public class CardDesignController {

    private final CardDesignService svc;

    @GetMapping
    public List<CardDesign> list(
            @AuthenticationPrincipal String userId,
            @RequestParam(required = false) String category) {
        return svc.list(userId, category);
    }

    @PostMapping
    public ResponseEntity<CardDesign> save(
            @AuthenticationPrincipal String userId,
            @RequestBody CardDesign body) {
        body.setUserId(userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(svc.save(body));
    }

    @PutMapping("/{id}")
    public CardDesign update(
            @AuthenticationPrincipal String userId,
            @PathVariable String id,
            @RequestBody CardDesign body) {
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
