package com.creativeai.agentteam.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "cv_workspace_settings")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CvWorkspaceSettings extends BaseEntity {

    @Column(name = "user_id", nullable = false, unique = true, length = 36)
    private String userId;

    /** recruiter | candidate | hr */
    @Column(name = "mode", nullable = false, length = 20)
    @Builder.Default
    private String mode = "recruiter";
}
