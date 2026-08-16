package com.creativeai.auth.controller;

import com.creativeai.auth.dto.request.VenteRequest;
import com.creativeai.auth.dto.response.VenteResponse;
import com.creativeai.auth.service.VenteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ventes")
@RequiredArgsConstructor
public class VenteController {

    private final VenteService service;

    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @PostMapping
    public ResponseEntity<VenteResponse> create(@Valid @RequestBody VenteRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req));
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @GetMapping("/{id}")
    public ResponseEntity<VenteResponse> findById(@PathVariable String id) { return ResponseEntity.ok(service.findById(id)); }

    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @GetMapping
    public ResponseEntity<List<VenteResponse>> findAll(@RequestParam(defaultValue = "false") boolean deleted) {
        return ResponseEntity.ok(service.findAll(deleted));
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @GetMapping("/client/{clientId}")
    public ResponseEntity<List<VenteResponse>> findByClient(@PathVariable String clientId) {
        return ResponseEntity.ok(service.findByClient(clientId));
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) { service.delete(id); return ResponseEntity.noContent().build(); }

    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @PatchMapping("/{id}/restore")
    public ResponseEntity<VenteResponse> restore(@PathVariable String id) { return ResponseEntity.ok(service.restore(id)); }
}
