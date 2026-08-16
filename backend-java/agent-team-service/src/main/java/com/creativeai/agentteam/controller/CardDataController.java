package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.CardDto;
import com.creativeai.agentteam.service.CardDataService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/card-data")
@RequiredArgsConstructor
public class CardDataController {

    private final CardDataService svc;

    @GetMapping
    public List<CardDto> list(
            @AuthenticationPrincipal String userId,
            @RequestParam(required = false) String category) {
        return svc.list(userId, category);
    }

    @PostMapping
    public ResponseEntity<CardDto> save(
            @AuthenticationPrincipal String userId,
            @RequestBody CardDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(svc.save(userId, dto));
    }

    @PostMapping("/bulk")
    public ResponseEntity<List<CardDto>> saveBulk(
            @AuthenticationPrincipal String userId,
            @RequestBody List<CardDto> dtos) {
        return ResponseEntity.status(HttpStatus.CREATED).body(svc.saveBulk(userId, dtos));
    }

    @PutMapping("/{id}")
    public CardDto update(
            @AuthenticationPrincipal String userId,
            @PathVariable String id,
            @RequestBody CardDto dto) {
        return svc.update(id, userId, dto);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal String userId,
            @PathVariable String id) {
        svc.delete(id, userId);
        return ResponseEntity.noContent().build();
    }
}
