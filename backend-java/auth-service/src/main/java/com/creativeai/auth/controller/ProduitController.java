package com.creativeai.auth.controller;

import com.creativeai.auth.dto.request.ProduitRequest;
import com.creativeai.auth.dto.response.ProduitResponse;
import com.creativeai.auth.service.ProduitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/produits")
@RequiredArgsConstructor
public class ProduitController {

    private final ProduitService service;

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<ProduitResponse> create(@Valid @RequestBody ProduitRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<ProduitResponse> update(@PathVariable String id, @Valid @RequestBody ProduitRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/{id}")
    public ResponseEntity<ProduitResponse> findById(@PathVariable String id) { return ResponseEntity.ok(service.findById(id)); }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<List<ProduitResponse>> findAll(@RequestParam(defaultValue = "false") boolean deleted) {
        return ResponseEntity.ok(service.findAll(deleted));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/categorie/{categorieId}")
    public ResponseEntity<List<ProduitResponse>> findByCategorie(@PathVariable String categorieId) {
        return ResponseEntity.ok(service.findByCategorie(categorieId));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) { service.delete(id); return ResponseEntity.noContent().build(); }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/restore")
    public ResponseEntity<ProduitResponse> restore(@PathVariable String id) { return ResponseEntity.ok(service.restore(id)); }

    @GetMapping("/front")
    public ResponseEntity<List<ProduitResponse>> findForFront() {
        return ResponseEntity.ok(service.findAll(false));
    }
}
