package com.creativeai.auth.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import com.creativeai.auth.dto.request.EntrepriseRequest;
import com.creativeai.auth.dto.response.EntrepriseResponse;
import com.creativeai.auth.service.EntrepriseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/entreprise")
@RequiredArgsConstructor
public class EntrepriseController {

    private final EntrepriseService service;

    @PostMapping
    public ResponseEntity<EntrepriseResponse> create(@Valid @RequestBody EntrepriseRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<EntrepriseResponse> update(@PathVariable String id,
            @Valid @RequestBody EntrepriseRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<EntrepriseResponse> findById(@PathVariable String id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<EntrepriseResponse>> findAll(@RequestParam(defaultValue = "false") boolean deleted) {
        return ResponseEntity.ok(service.findAll(deleted));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/restore")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<EntrepriseResponse> restore(@PathVariable String id) {
        return ResponseEntity.ok(service.restore(id));
    }
}
