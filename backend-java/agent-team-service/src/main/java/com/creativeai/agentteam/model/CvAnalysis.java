package com.creativeai.agentteam.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "cv_analyses", indexes = {
    @Index(name = "idx_cv_analysis_user",    columnList = "user_id"),
    @Index(name = "idx_cv_analysis_user_ws", columnList = "user_id, workspace_mode"),
    @Index(name = "idx_cv_analysis_date",    columnList = "user_id, analyzed_at")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CvAnalysis extends BaseEntity {

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Column(name = "file_name", nullable = false, length = 500)
    private String fileName;

    @Column(name = "file_size", nullable = false)
    @Builder.Default
    private long fileSize = 0;

    @Column(name = "analyzed_at", nullable = false)
    private LocalDateTime analyzedAt;

    @Column(name = "target_job", length = 200)
    private String targetJob;

    /** Pipeline status : pending / selected / waiting / rejected / favorite */
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private String status = "pending";

    @Column(name = "notes", columnDefinition = "text")
    @Builder.Default
    private String notes = "";

    /** Contexte métier : recruiter / candidate / hr */
    @Column(name = "workspace_mode", nullable = false, length = 20)
    @Builder.Default
    private String workspaceMode = "recruiter";

    @Column(name = "global_score", nullable = false)
    @Builder.Default
    private int globalScore = 0;

    @Column(name = "global_label", length = 100)
    private String globalLabel;

    @Column(name = "ats_pct", nullable = false)
    @Builder.Default
    private int atsPct = 0;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    @Builder.Default
    private String sections = "[]";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    @Builder.Default
    private String keywords = "[]";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    @Builder.Default
    private String strengths = "[]";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    @Builder.Default
    private String improvements = "[]";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "suggested_jobs", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    @Builder.Default
    private String suggestedJobs = "[]";
}
