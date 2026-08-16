package com.creativeai.agentteam.model;

import com.creativeai.agentteam.model.enums.MemoryType;
import com.creativeai.agentteam.model.enums.MessageRole;
import jakarta.persistence.*;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "agent_memories", indexes = {
    @Index(name = "idx_mem_user_agent",  columnList = "user_id, agent_id"),
    @Index(name = "idx_mem_session",     columnList = "session_id"),
    @Index(name = "idx_mem_team",        columnList = "team_id"),
    @Index(name = "idx_mem_seq",         columnList = "user_id, agent_id, sequence_number")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AgentMemory extends BaseEntity {

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Column(name = "agent_id", nullable = false, length = 36)
    private String agentId;

    @Column(name = "session_id", length = 100)
    private String sessionId;

    @Column(name = "team_id", length = 36)
    private String teamId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private MessageRole role;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "tool_name", length = 100)
    private String toolName;

    @Column(name = "sequence_number", nullable = false)
    private long sequenceNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "memory_type", nullable = false, length = 15)
    @Builder.Default
    private MemoryType memoryType = MemoryType.SHORT_TERM;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String metadata;
}
