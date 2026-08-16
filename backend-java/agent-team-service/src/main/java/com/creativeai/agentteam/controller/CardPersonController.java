package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.CardPerson;
import com.creativeai.agentteam.service.CardPersonService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/card-persons")
@RequiredArgsConstructor
public class CardPersonController {

    private final CardPersonService svc;

    @GetMapping
    public List<CardPerson> list(
            @AuthenticationPrincipal String userId,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String entreprise) {
        return svc.list(userId, category, entreprise);
    }

    @GetMapping("/entreprises")
    public List<String> entreprises(
            @AuthenticationPrincipal String userId,
            @RequestParam(required = false) String category) {
        return svc.listEntreprises(userId, category);
    }

    @PostMapping
    public ResponseEntity<CardPerson> save(
            @AuthenticationPrincipal String userId,
            @RequestBody CardPerson body) {
        body.setUserId(userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(svc.save(body));
    }

    @PostMapping("/bulk")
    public ResponseEntity<List<CardPerson>> saveBulk(
            @AuthenticationPrincipal String userId,
            @RequestBody List<CardPerson> persons) {
        persons.forEach(p -> p.setUserId(userId));
        return ResponseEntity.status(HttpStatus.CREATED).body(svc.saveBulk(persons));
    }

    @PutMapping("/{id}")
    public CardPerson update(
            @AuthenticationPrincipal String userId,
            @PathVariable String id,
            @RequestBody CardPerson body) {
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
