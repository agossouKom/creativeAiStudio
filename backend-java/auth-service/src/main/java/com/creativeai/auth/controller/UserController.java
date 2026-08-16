package com.creativeai.auth.controller;

import com.creativeai.auth.dto.request.UserUpdateRequest;
import com.creativeai.auth.dto.response.UserResponse;
import com.creativeai.auth.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<List<UserResponse>> findAll(@RequestParam(required = false) Boolean deleted) {
        return ResponseEntity.ok(userService.findAll(deleted));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/all-sessions")
    public ResponseEntity<List<com.creativeai.auth.dto.response.UserSessionResponse>> findAllSessions() {
        return ResponseEntity.ok(userService.findAllSessions());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/revoke-session/{sessionId}")
    public ResponseEntity<Void> revokeSession(@PathVariable String sessionId) {
        userService.revokeSession(sessionId);
        return ResponseEntity.ok().build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<UserResponse> create(@Valid @RequestBody com.creativeai.auth.dto.request.UserCreateRequest req) {
        return ResponseEntity.ok(userService.create(req));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> findById(@PathVariable String id) {
        return ResponseEntity.ok(userService.findById(id));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<UserResponse> update(@PathVariable String id, @Valid @RequestBody UserUpdateRequest req) {
        return ResponseEntity.ok(userService.update(id, req));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}")
    public ResponseEntity<UserResponse> patch(@PathVariable String id, @RequestBody UserUpdateRequest req) {
        return ResponseEntity.ok(userService.update(id, req));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        userService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/restore")
    public ResponseEntity<UserResponse> restore(@PathVariable String id) {
        return ResponseEntity.ok(userService.restore(id));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{id}/revoke-sessions")
    public ResponseEntity<Void> revokeSessions(@PathVariable String id) {
        userService.revokeAllSessions(id);
        return ResponseEntity.ok().build();
    }
}
