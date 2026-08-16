package com.creativeai.auth.controller;

import com.creativeai.auth.dto.request.ResultatRechercheRequest;
import com.creativeai.auth.dto.response.ResultatRechercheResponse;
import com.creativeai.auth.model.enums.Abonnement;
import com.creativeai.auth.model.enums.MediaType;
import com.creativeai.auth.service.ResultatRechercheService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import com.creativeai.auth.model.User;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/resultats")
@RequiredArgsConstructor
public class ResultatRechercheController {

    private final ResultatRechercheService service;

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<ResultatRechercheResponse> create(@Valid @RequestBody ResultatRechercheRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<ResultatRechercheResponse> update(@PathVariable String id,
                                                            @Valid @RequestBody ResultatRechercheRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/{id}")
    public ResponseEntity<ResultatRechercheResponse> findById(
            @PathVariable String id,
            @RequestParam(required = false, defaultValue = "FREE") Abonnement abonnement) {
        return ResponseEntity.ok(service.findById(id, abonnement));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<List<ResultatRechercheResponse>> findAll(
            @RequestParam(defaultValue = "false") boolean deleted,
            @RequestParam(required = false, defaultValue = "FREE") Abonnement abonnement) {
        return ResponseEntity.ok(service.findAll(deleted, abonnement));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/search")
    public ResponseEntity<List<ResultatRechercheResponse>> search(
            @RequestParam String q,
            @RequestParam(required = false, defaultValue = "FREE") Abonnement abonnement) {
        return ResponseEntity.ok(service.search(q, abonnement));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/type/{mediaType}")
    public ResponseEntity<List<ResultatRechercheResponse>> findByType(
            @PathVariable MediaType mediaType,
            @RequestParam(required = false, defaultValue = "FREE") Abonnement abonnement) {
        return ResponseEntity.ok(service.findByMediaType(mediaType, abonnement));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) { service.delete(id); return ResponseEntity.noContent().build(); }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/restore")
    public ResponseEntity<ResultatRechercheResponse> restore(@PathVariable String id) {
        return ResponseEntity.ok(service.restore(id));
    }

    @GetMapping("/front")
    public ResponseEntity<List<ResultatRechercheResponse>> findForFront(Authentication auth) {
        Abonnement niveau = Abonnement.FREE;
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof User user) {
            niveau = user.getAbonnement();
        }
        return ResponseEntity.ok(service.findAll(false, niveau));
    }
}
