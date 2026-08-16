package com.creativeai.auth.controller;

import com.creativeai.auth.dto.request.CategorieRequest;
import com.creativeai.auth.dto.response.CategorieResponse;
import com.creativeai.auth.service.CategorieService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategorieController {

    private final CategorieService service;

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<CategorieResponse> create(@Valid @RequestBody CategorieRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<CategorieResponse> update(@PathVariable String id, @Valid @RequestBody CategorieRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/{id}")
    public ResponseEntity<CategorieResponse> findById(@PathVariable String id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<List<CategorieResponse>> findAll(@RequestParam(required = false) Boolean deleted) {
        return ResponseEntity.ok(service.findAll(deleted));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/bulk")
    public ResponseEntity<List<CategorieResponse>> createBulk(@RequestBody List<String> libelles) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createBulk(libelles));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/restore")
    public ResponseEntity<CategorieResponse> restore(@PathVariable String id) {
        return ResponseEntity.ok(service.restore(id));
    }
}
