package com.creativeai.auth.dto.agent;
import java.time.LocalDateTime;
public record CredentialResponse(String id, String provider, String displayName, String maskedKey, boolean active, LocalDateTime lastUsedAt) {}
