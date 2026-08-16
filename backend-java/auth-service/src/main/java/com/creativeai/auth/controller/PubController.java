package com.creativeai.auth.controller;

import com.creativeai.auth.dto.request.PubRequest;
import com.creativeai.auth.dto.response.PubResponse;
import com.creativeai.auth.service.PubService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pubs")
@RequiredArgsConstructor
public class PubController {

    private final PubService service;

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<PubResponse> create(@Valid @RequestBody PubRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<PubResponse> update(@PathVariable String id, @Valid @RequestBody PubRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/{id}")
    public ResponseEntity<PubResponse> findById(@PathVariable String id) { return ResponseEntity.ok(service.findById(id)); }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<List<PubResponse>> findAll(@RequestParam(defaultValue = "false") boolean deleted) {
        return ResponseEntity.ok(service.findAll(deleted));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/client/{clientPubId}")
    public ResponseEntity<List<PubResponse>> findByClient(@PathVariable String clientPubId) {
        return ResponseEntity.ok(service.findByClient(clientPubId));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) { service.delete(id); return ResponseEntity.noContent().build(); }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/restore")
    public ResponseEntity<PubResponse> restore(@PathVariable String id) { return ResponseEntity.ok(service.restore(id)); }

    @GetMapping("/front")
    public ResponseEntity<List<PubResponse>> findForFront() {
        return ResponseEntity.ok(service.findAll(false));
    }
}
