package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.SubscriptionUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface SubscriptionUsageRepository extends JpaRepository<SubscriptionUsage, String> {

    Optional<SubscriptionUsage> findByUserIdAndPeriod(String userId, String period);

    /** Incrément atomique — évite les race conditions sur compteur. */
    @Modifying
    @Query(value = """
        INSERT INTO subscription_usage (id, user_id, period, tasks_used, created_at, updated_at)
        VALUES (gen_random_uuid(), :userId, :period, 1, NOW(), NOW())
        ON CONFLICT (user_id, period)
        DO UPDATE SET tasks_used = subscription_usage.tasks_used + 1,
                      updated_at = NOW()
        """, nativeQuery = true)
    void incrementTaskUsage(@Param("userId") String userId, @Param("period") String period);
}
