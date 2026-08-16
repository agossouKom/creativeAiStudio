package com.creativeai.auth.controller;

import com.creativeai.auth.dto.request.HistoriqueRechercheRequest;
import com.creativeai.auth.dto.response.HistoriqueRechercheResponse;
import com.creativeai.auth.service.HistoriqueRechercheService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/historique")
@RequiredArgsConstructor
public class HistoriqueRechercheController {

    private final HistoriqueRechercheService service;

    /** Record a new search event (typically called by search-service internally) */
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    @PostMapping
    public ResponseEntity<HistoriqueRechercheResponse> create(@Valid @RequestBody HistoriqueRechercheRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req));
    }

    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    @GetMapping("/{id}")
    public ResponseEntity<HistoriqueRechercheResponse> findById(@PathVariable String id) {
        return ResponseEntity.ok(service.findById(id));
    }

    /** All history (admin) */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<List<HistoriqueRechercheResponse>> findAll(@RequestParam(defaultValue = "false") boolean deleted) {
        return ResponseEntity.ok(service.findAll(deleted));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/restore")
    public ResponseEntity<HistoriqueRechercheResponse> restore(@PathVariable String id) {
        return ResponseEntity.ok(service.restore(id));
    }

    /** Full history for a specific user */
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    @GetMapping("/client/{clientId}")
    public ResponseEntity<List<HistoriqueRechercheResponse>> findByClient(@PathVariable String clientId) {
        return ResponseEntity.ok(service.findByClient(clientId));
    }

    /** Searches that returned results */
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    @GetMapping("/client/{clientId}/found")
    public ResponseEntity<List<HistoriqueRechercheResponse>> findFound(@PathVariable String clientId) {
        return ResponseEntity.ok(service.findByClientFound(clientId));
    }

    /** Searches with no results */
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    @GetMapping("/client/{clientId}/not-found")
    public ResponseEntity<List<HistoriqueRechercheResponse>> findNotFound(@PathVariable String clientId) {
        return ResponseEntity.ok(service.findByClientNotFound(clientId));
    }

    /** Soft-delete one entry */
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** Clear all history for a user */
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    @DeleteMapping("/client/{clientId}")
    public ResponseEntity<Void> clearForClient(@PathVariable String clientId) {
        service.clearForClient(clientId);
        return ResponseEntity.noContent().build();
    }
}
