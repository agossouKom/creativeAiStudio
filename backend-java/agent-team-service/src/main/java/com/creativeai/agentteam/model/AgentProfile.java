package com.creativeai.agentteam.model;

import com.creativeai.agentteam.model.enums.ToneStyle;
import jakarta.persistence.*;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.*;

@Entity
@Table(name = "agent_profiles")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AgentProfile extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agent_id", nullable = false, unique = true)
    private Agent agent;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(length = 500)
    private String bio;

    @Column(columnDefinition = "text")
    private String persona;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false, length = 20)
    private ToneStyle tone = ToneStyle.PROFESSIONAL;

    @Column(name = "welcome_message", columnDefinition = "text")
    private String welcomeMessage;

    /** JSON array de capabilities ex: ["email", "summarize"] */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "capabilities_json", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String capabilitiesJson;

    /** JSON array de restrictions */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "restrictions_json", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String restrictionsJson;

    /** Voix de la marque (JSON) : ton, valeurs, keywords interdits */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "brand_voice_json", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String brandVoiceJson;
}
