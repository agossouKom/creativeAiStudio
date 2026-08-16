package com.creativeai.auth.model;

import com.creativeai.auth.model.enums.MessageRole;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "agent_memories", indexes = {
    @Index(name = "idx_mem_user",          columnList = "user_id"),
    @Index(name = "idx_mem_user_agent_seq", columnList = "user_id, agent_id, sequence_number")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
@EqualsAndHashCode(callSuper = true)
public class AgentMemory extends BaseEntity {

    @Column(name = "user_id", nullable = false, length = 150)
    private String userId;

    @Column(name = "agent_id", nullable = false, length = 50)
    private String agentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MessageRole role;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    /** Populated when role = TOOL_RESULT */
    @Column(name = "tool_name", length = 100)
    private String toolName;

    @Column(name = "sequence_number", nullable = false)
    private Long sequenceNumber;
}
