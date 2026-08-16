package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_api_credentials", indexes = {
    @Index(name = "idx_cred_user",          columnList = "user_id"),
    @Index(name = "idx_cred_user_provider",  columnList = "user_id, provider", unique = true)
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
@EqualsAndHashCode(callSuper = true)
public class UserApiCredential extends BaseEntity {

    @Column(name = "user_id", nullable = false, length = 150)
    private String userId;

    /** e.g. "groq", "openai", "anthropic" */
    @Column(nullable = false, length = 50)
    private String provider;

    /** AES-256-GCM encrypted value: "base64(iv):base64(ciphertext)" */
    @Column(name = "encrypted_api_key", nullable = false, length = 1024)
    private String encryptedApiKey;

    @Column(name = "display_name", length = 100)
    private String displayName;

    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;
}
