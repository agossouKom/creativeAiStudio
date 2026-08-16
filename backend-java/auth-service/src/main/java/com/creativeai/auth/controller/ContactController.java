package com.creativeai.auth.controller;

import com.creativeai.auth.dto.request.ContactRequest;
import com.creativeai.auth.dto.response.ContactResponse;
import com.creativeai.auth.service.ContactService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/contacts")
@RequiredArgsConstructor
public class ContactController {

    private final ContactService service;

    @PostMapping
    public ResponseEntity<ContactResponse> create(@Valid @RequestBody ContactRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{id}/reply")
    public ResponseEntity<ContactResponse> reply(@PathVariable String id, @Valid @RequestBody com.creativeai.auth.dto.request.ContactReplyRequest req) {
        return ResponseEntity.ok(service.reply(id, req));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/{id}")
    public ResponseEntity<ContactResponse> findById(@PathVariable String id) { return ResponseEntity.ok(service.findById(id)); }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<List<ContactResponse>> findAll(@RequestParam(defaultValue = "false") boolean deleted) {
        return ResponseEntity.ok(service.findAll(deleted));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) { service.delete(id); return ResponseEntity.noContent().build(); }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/restore")
    public ResponseEntity<ContactResponse> restore(@PathVariable String id) { return ResponseEntity.ok(service.restore(id)); }
}
