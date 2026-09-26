package com.creativeai.agentteam.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.creativeai.agentteam.model.enums.ToneStyle;
import jakarta.persistence.*;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.*;

@Entity
@Table(name = "agent_configs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AgentConfig extends BaseEntity {

    // @JsonIgnore : fermeture de la boucle Agent <-> AgentConfig, cf. Agent.config
    @JsonIgnore
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agent_id", nullable = false, unique = true)
    private Agent agent;

    @Builder.Default
    @Column(nullable = false)
    private double temperature = 0.7;

    @Builder.Default
    @Column(name = "max_tokens", nullable = false)
    private int maxTokens = 2048;

    @Builder.Default
    @Column(name = "context_window_size", nullable = false)
    private int contextWindowSize = 8192;

    @Builder.Default
    @Column(name = "max_memory_messages", nullable = false)
    private int maxMemoryMessages = 30;

    @Builder.Default
    @Column(name = "max_iterations", nullable = false)
    private int maxIterations = 10;

    @Builder.Default
    @Column(name = "response_language", length = 10)
    private String responseLanguage = "fr";

    @Builder.Default
    @Column(name = "timezone", length = 50)
    private String timezone = "Europe/Paris";

    @Builder.Default
    @Column(name = "streaming_enabled", nullable = false)
    private boolean streamingEnabled = true;

    @Builder.Default
    @Column(name = "auto_escalate_enabled", nullable = false)
    private boolean autoEscalateEnabled = true;

    @Builder.Default
    @Column(name = "auto_reply_enabled", nullable = false)
    private boolean autoReplyEnabled = false;

    @Builder.Default
    @Column(name = "task_timeout_seconds", nullable = false)
    private int taskTimeoutSeconds = 120;

    @Builder.Default
    @Column(name = "rate_limit_rpm", nullable = false)
    private int rateLimitRpm = 60;

    @Builder.Default
    @Column(name = "retry_max_attempts", nullable = false)
    private int retryMaxAttempts = 3;

    @Builder.Default
    @Column(name = "retry_delay_seconds", nullable = false)
    private int retryDelaySeconds = 5;

    /** Plages horaires actives format JSON ex: {"MON":["09:00","18:00"]} */
    @Column(name = "working_hours_json", columnDefinition = "text")
    private String workingHoursJson;

    /** Paramètres custom par type d'agent (JSON) */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "custom_params", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String customParams;
}
