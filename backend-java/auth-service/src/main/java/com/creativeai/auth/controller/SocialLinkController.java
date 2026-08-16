package com.creativeai.auth.controller;

import com.creativeai.auth.dto.request.SocialLinkRequest;
import com.creativeai.auth.dto.response.SocialLinkResponse;
import com.creativeai.auth.model.SocialLink;
import com.creativeai.auth.service.SocialLinkService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for SocialLink CRUD.
 * Base path : /api/social-links
 *
 * Endpoints:
 *   POST   /                         → create
 *   PUT    /{id}                     → update
 *   GET    /{id}                     → findById
 *   GET    /                         → findAll
 *   GET    /by-owner?type=US|CLIENT  → findByOwnerType
 *   GET    /active?type=US|CLIENT    → findActiveByOwnerType (public – no auth)
 *   PATCH  /{id}/toggle              → toggleActive
 *   DELETE /{id}                     → delete
 */
@RestController
@RequestMapping("/api/social-links")
@RequiredArgsConstructor
public class SocialLinkController {

    private final SocialLinkService service;

    // ── Create ──────────────────────────────────────────────────────────────────
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<SocialLinkResponse> create(@Valid @RequestBody SocialLinkRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req));
    }

    // ── Update ──────────────────────────────────────────────────────────────────
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<SocialLinkResponse> update(
            @PathVariable String id,
            @Valid @RequestBody SocialLinkRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    // ── Read ────────────────────────────────────────────────────────────────────
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/{id}")
    public ResponseEntity<SocialLinkResponse> findById(@PathVariable String id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<List<SocialLinkResponse>> findAll() {
        return ResponseEntity.ok(service.findAll());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/by-owner")
    public ResponseEntity<List<SocialLinkResponse>> findByOwnerType(
            @RequestParam SocialLink.OwnerType type) {
        return ResponseEntity.ok(service.findByOwnerType(type));
    }

    /** Public endpoint – used to display social links on the public-facing site */
    @GetMapping("/active")
    public ResponseEntity<List<SocialLinkResponse>> findActive(
            @RequestParam(required = false) SocialLink.OwnerType type) {
        if (type != null) return ResponseEntity.ok(service.findActiveByOwnerType(type));
        return ResponseEntity.ok(service.findAll().stream()
                .filter(SocialLinkResponse::isActive).toList());
    }

    // ── Toggle active ───────────────────────────────────────────────────────────
    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/toggle")
    public ResponseEntity<SocialLinkResponse> toggle(@PathVariable String id) {
        return ResponseEntity.ok(service.toggleActive(id));
    }

    // ── Delete ──────────────────────────────────────────────────────────────────
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
