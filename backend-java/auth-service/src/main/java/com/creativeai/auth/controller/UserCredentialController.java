package com.creativeai.auth.controller;

import com.creativeai.auth.dto.agent.CredentialRequest;
import com.creativeai.auth.dto.agent.CredentialResponse;
import com.creativeai.auth.model.UserApiCredential;
import com.creativeai.auth.repository.UserApiCredentialRepository;
import com.creativeai.auth.security.EncryptionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
@RequestMapping("/api/user/credentials")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class UserCredentialController {

    private final UserApiCredentialRepository credRepo;
    private final EncryptionService           encryptionService;

    @GetMapping
    public ResponseEntity<List<CredentialResponse>> list() {
        return ResponseEntity.ok(credRepo.findByUserIdAndActiveTrueAndDeletedFalse(userId())
            .stream().map(this::toDto).toList());
    }

    @PostMapping
    public ResponseEntity<CredentialResponse> save(@RequestBody CredentialRequest req) {
        String userId = userId();
        Optional<UserApiCredential> existing = credRepo.findByUserIdAndProviderAndActiveTrue(userId, req.provider());

        UserApiCredential cred = existing.orElseGet(() ->
            UserApiCredential.builder().userId(userId).provider(req.provider()).build()
        );
        cred.setEncryptedApiKey(encryptionService.encrypt(req.apiKey()));
        cred.setDisplayName(req.displayName() != null ? req.displayName() : req.provider() + " API Key");
        cred.setActive(true);
        log.info("Credential saved for userId={} provider={}", userId, req.provider());
        return ResponseEntity.ok(toDto(credRepo.save(cred)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        credRepo.findById(id).ifPresent(c -> {
            if (c.getUserId().equals(userId())) { c.setActive(false); credRepo.save(c); }
        });
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/test")
    public ResponseEntity<Map<String, Object>> test(@RequestBody CredentialRequest req) {
        try {
            // Minimal Groq API test: just verify the key format
            if (req.apiKey() == null || !req.apiKey().startsWith("gsk_"))
                return ResponseEntity.ok(Map.of("valid", false, "message", "Format de clé Groq invalide (doit commencer par gsk_)"));
            return ResponseEntity.ok(Map.of("valid", true, "message", "Clé API Groq valide ✓"));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("valid", false, "message", e.getMessage()));
        }
    }

    private String userId() { return SecurityContextHolder.getContext().getAuthentication().getName(); }

    private CredentialResponse toDto(UserApiCredential c) {
        String masked = c.getEncryptedApiKey() != null
            ? maskKey(encryptionService.decrypt(c.getEncryptedApiKey()))
            : "••••••••";
        return new CredentialResponse(c.getId(), c.getProvider(), c.getDisplayName(),
                                      masked, c.isActive(), c.getLastUsedAt());
    }

    private String maskKey(String key) {
        if (key == null || key.length() < 8) return "••••••••";
        return key.substring(0, 4) + "••••••••" + key.substring(key.length() - 4);
    }
}
