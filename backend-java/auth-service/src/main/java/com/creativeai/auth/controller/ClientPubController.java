package com.creativeai.auth.controller;

import com.creativeai.auth.dto.request.ClientPubRequest;
import com.creativeai.auth.dto.response.ClientPubResponse;
import com.creativeai.auth.service.ClientPubService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/clients-pub")
@RequiredArgsConstructor
public class ClientPubController {

    private final ClientPubService service;

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<ClientPubResponse> create(@Valid @RequestBody ClientPubRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<ClientPubResponse> update(@PathVariable String id, @Valid @RequestBody ClientPubRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/{id}")
    public ResponseEntity<ClientPubResponse> findById(@PathVariable String id) { return ResponseEntity.ok(service.findById(id)); }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<List<ClientPubResponse>> findAll(@RequestParam(defaultValue = "false") boolean deleted) {
        return ResponseEntity.ok(service.findAll(deleted));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) { service.delete(id); return ResponseEntity.noContent().build(); }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/restore")
    public ResponseEntity<ClientPubResponse> restore(@PathVariable String id) { return ResponseEntity.ok(service.restore(id)); }
}
