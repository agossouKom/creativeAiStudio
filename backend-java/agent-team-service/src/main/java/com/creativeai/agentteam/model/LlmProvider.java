package com.creativeai.agentteam.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
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
    @JsonIgnore
    private Agent agent;

    /** Provider rattaché au compte utilisateur (userId = email JWT). agentId est alors null. */
    @Column(name = "user_id", length = 100)
    private String userId;

    /** Provider partagé par les agents d'une équipe ; clé chiffrée comme les autres scopes. */
    @Column(name = "team_id", length = 36)
    private String teamId;

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

    /**
     * Modèle par défaut de la plateforme, défini par un administrateur.
     *
     * <p>Un seul provider actif peut porter ce drapeau (index unique partiel en
     * base). Il sert de repli pour tout compte qui n'a configuré ni provider
     * d'agent, ni d'équipe, ni de compte, et il est automatiquement recopié
     * dans le compte lorsqu'un utilisateur s'inscrit, afin qu'il puisse
     * démarrer immédiatement.
     */
    @Builder.Default
    @Column(name = "is_platform_default", nullable = false)
    private boolean platformDefault = false;

    /**
     * Provider copié automatiquement sur une équipe qui n'en avait pas encore.
     *
     * <p>Ce marqueur n'est pas décoratif. L'ordre de résolution est
     * agent &gt; équipe &gt; compte, donc un provider d'équipe l'emporte
     * toujours sur un choix personnel de l'utilisateur. Sans cette
     * distinction, attribuer le provider de la plateforme à chaque nouvelle
     * équipe reviendrait à interdire à l'utilisateur d'utiliser le modèle qu'il
     * a lui-même enregistré : son choix resterait dans son espace de travail
     * sans jamais être appelé.
     *
     * <p>Les providers auto-assignés sont donc proposés après ceux du compte.
     * Un choix explicite de l'utilisateur prime toujours.
     */
    @Builder.Default
    @Column(name = "auto_assigned", nullable = false)
    private boolean autoAssigned = false;

    /** Paramètres additionnels JSON (ex: system_fingerprint, seed) */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "extra_params", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String extraParams;
}
