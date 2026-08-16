package com.creativeai.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Table(name = "scheduled_email_tasks", indexes = {
    @Index(name = "idx_sched_user",     columnList = "user_id"),
    @Index(name = "idx_sched_next_run", columnList = "active, next_run_at")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
@EqualsAndHashCode(callSuper = true)
public class ScheduledEmailTask extends BaseEntity {

    @Column(name = "user_id", nullable = false, length = 150)
    private String userId;

    @Column(nullable = false, length = 200)
    private String name;

    /** The instruction given to the agent on each run */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String prompt;

    /** null = one-shot, otherwise cron expression e.g. "0 8 * * MON" */
    @Column(name = "cron_expression", length = 100)
    private String cronExpression;

    @Column(name = "next_run_at", nullable = false)
    private LocalDateTime nextRunAt;

    @Column(name = "last_run_at")
    private LocalDateTime lastRunAt;

    @Column(name = "last_run_result", columnDefinition = "TEXT")
    private String lastRunResult;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

    @Builder.Default
    @Column(name = "run_count", nullable = false)
    private int runCount = 0;
}
