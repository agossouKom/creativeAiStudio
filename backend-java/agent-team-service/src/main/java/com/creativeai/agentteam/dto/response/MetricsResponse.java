package com.creativeai.agentteam.dto.response;

import com.creativeai.agentteam.model.AgentMetrics;
import java.time.LocalDate;

public record MetricsResponse(
    String agentId, LocalDate metricDate,
    long totalRequests, long successfulRequests, long failedRequests,
    long totalTokensUsed, double avgResponseTimeMs, double estimatedCostEur,
    long tasksCompleted, long tasksEscalated, long tasksFailed,
    long mediaAssetsGenerated, long documentsIndexed,
    String toolUsageCount
) {
    public static MetricsResponse from(AgentMetrics m) {
        return new MetricsResponse(m.getAgentId(), m.getMetricDate(),
            m.getTotalRequests(), m.getSuccessfulRequests(), m.getFailedRequests(),
            m.getTotalTokensUsed(), m.getAvgResponseTimeMs(), m.getEstimatedCostEur(),
            m.getTasksCompleted(), m.getTasksEscalated(), m.getTasksFailed(),
            m.getMediaAssetsGenerated(), m.getDocumentsIndexed(), m.getToolUsageCount());
    }
}
