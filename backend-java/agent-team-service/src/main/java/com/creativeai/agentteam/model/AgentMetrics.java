package com.creativeai.agentteam.model;

import jakarta.persistence.*;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "agent_metrics", indexes = {
    @Index(name = "idx_metrics_agent_date", columnList = "agent_id, metric_date", unique = true)
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AgentMetrics extends BaseEntity {

    @Column(name = "agent_id", nullable = false, length = 36)
    private String agentId;

    @Column(name = "metric_date", nullable = false)
    private LocalDate metricDate;

    @Builder.Default
    @Column(name = "total_requests", nullable = false)
    private long totalRequests = 0;

    @Builder.Default
    @Column(name = "successful_requests", nullable = false)
    private long successfulRequests = 0;

    @Builder.Default
    @Column(name = "failed_requests", nullable = false)
    private long failedRequests = 0;

    @Builder.Default
    @Column(name = "total_tokens_used", nullable = false)
    private long totalTokensUsed = 0;

    @Builder.Default
    @Column(name = "avg_response_time_ms", nullable = false)
    private double avgResponseTimeMs = 0;

    @Builder.Default
    @Column(name = "estimated_cost_eur", nullable = false)
    private double estimatedCostEur = 0;

    @Builder.Default
    @Column(name = "tasks_completed", nullable = false)
    private long tasksCompleted = 0;

    @Builder.Default
    @Column(name = "tasks_escalated", nullable = false)
    private long tasksEscalated = 0;

    @Builder.Default
    @Column(name = "tasks_failed", nullable = false)
    private long tasksFailed = 0;

    @Builder.Default
    @Column(name = "media_assets_generated", nullable = false)
    private long mediaAssetsGenerated = 0;

    @Builder.Default
    @Column(name = "documents_indexed", nullable = false)
    private long documentsIndexed = 0;

    /** JSON map: { "toolName": usageCount } */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tool_usage_count", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String toolUsageCount;
}
