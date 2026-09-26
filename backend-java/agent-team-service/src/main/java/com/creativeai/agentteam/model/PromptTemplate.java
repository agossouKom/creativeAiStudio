package com.creativeai.agentteam.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.creativeai.agentteam.model.enums.PromptType;
import jakarta.persistence.*;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.*;

@Entity
@Table(name = "prompt_templates", indexes = {
    @Index(name = "idx_prompt_agent",  columnList = "agent_id"),
    @Index(name = "idx_prompt_type",   columnList = "type"),
    @Index(name = "idx_prompt_active", columnList = "agent_id, type, active")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PromptTemplate extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agent_id", nullable = false)
    @JsonIgnore
    private Agent agent;

    @Column(nullable = false, length = 150)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PromptType type;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    /** Variables disponibles dans le template JSON array ex: ["email_body","user_name"] */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "variables_json", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String variablesJson;

    @Builder.Default
    @Column(nullable = false)
    private int version = 1;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

    @Column(length = 500)
    private String description;
}
