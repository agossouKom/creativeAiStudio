package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.AgentMetrics;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AgentMetricsRepository extends JpaRepository<AgentMetrics, String> {
    Optional<AgentMetrics> findByAgentIdAndMetricDate(String agentId, LocalDate date);
    List<AgentMetrics>     findByAgentIdAndMetricDateBetweenOrderByMetricDateAsc(String agentId, LocalDate from, LocalDate to);

    @Query("SELECT SUM(m.totalTokensUsed) FROM AgentMetrics m WHERE m.agentId = :agentId AND m.metricDate >= :from")
    Long sumTokensFrom(String agentId, LocalDate from);

    @Query("SELECT SUM(m.estimatedCostEur) FROM AgentMetrics m WHERE m.agentId = :agentId AND m.metricDate >= :from")
    Double sumCostFrom(String agentId, LocalDate from);
}
