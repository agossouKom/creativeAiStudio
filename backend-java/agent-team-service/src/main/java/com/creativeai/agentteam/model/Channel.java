package com.creativeai.agentteam.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.PlatformType;
import jakarta.persistence.*;
import org.hibernate.annotations.ColumnTransformer;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "channels", indexes = {
    @Index(name = "idx_channel_agent",  columnList = "agent_id"),
    @Index(name = "idx_channel_type",   columnList = "type"),
    @Index(name = "idx_channel_status", columnList = "status")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Channel extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agent_id", nullable = false)
    @JsonIgnore
    private Agent agent;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ChannelType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform_type", length = 20)
    private PlatformType platformType;

    @Column(name = "display_name", nullable = false, length = 150)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    @Builder.Default
    private ChannelStatus status = ChannelStatus.DISCONNECTED;

    /** Credentials chiffrées AES-256-GCM (JSON) */
    @Column(name = "encrypted_credentials", columnDefinition = "text")
    private String encryptedCredentials;

    /** Config spécifique (labels Gmail, webhooks, etc.) JSON */
    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "CAST(? AS TEXT)::jsonb")
    private String config;

    @Column(name = "last_sync_at")
    private LocalDateTime lastSyncAt;

    @Column(name = "token_expires_at")
    private LocalDateTime tokenExpiresAt;

    @Column(name = "account_id", length = 200)
    private String accountId;

    @Column(name = "account_name", length = 200)
    private String accountName;

    /** Métriques (followers, engagement…) JSON */
    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "CAST(? AS TEXT)::jsonb")
    private String metrics;
}
