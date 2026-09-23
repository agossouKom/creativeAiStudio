package com.creativeai.agentteam.model;

import com.creativeai.agentteam.model.enums.LlmType;
import jakarta.persistence.*;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.*;

@Entity
@Table(name = "llm_providers", indexes = {
    @Index(name = "idx_llm_agent",   columnList = "agent_id"),
    @Index(name = "idx_llm_primary", columnList = "agent_id, is_primary")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LlmProvider extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agent_id")
    private Agent agent;

    /** Provider rattaché au compte utilisateur (userId = email JWT). agentId est alors null. */
    @Column(name = "user_id", length = 100)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LlmType type;

    @Column(name = "model_id", nullable = false, length = 100)
    private String modelId;

    @Column(name = "base_url", length = 300)
    private String baseUrl;

    /** Clé API chiffrée AES-256-GCM : "base64(iv):base64(ciphertext)" */
    @Column(name = "encrypted_api_key", columnDefinition = "text")
    private String encryptedApiKey;

    @Column(name = "display_name", length = 100)
    private String displayName;

    @Builder.Default
    @Column(nullable = false)
    private double temperature = 0.7;

    @Builder.Default
    @Column(name = "max_tokens", nullable = false)
    private int maxTokens = 2048;

    @Builder.Default
    @Column(name = "top_p", nullable = false)
    private double topP = 1.0;

    @Builder.Default
    @Column(name = "streaming_enabled", nullable = false)
    private boolean streamingEnabled = true;

    @Builder.Default
    @Column(name = "request_timeout_seconds", nullable = false)
    private int requestTimeoutSeconds = 60;

    @Builder.Default
    @Column(name = "rate_limit_rpm", nullable = false)
    private int rateLimitRpm = 30;

    @Builder.Default
    @Column(name = "is_primary", nullable = false)
    private boolean primary = false;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

    /** Paramètres additionnels JSON (ex: system_fingerprint, seed) */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "extra_params", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String extraParams;
}
